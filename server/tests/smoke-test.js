import { db } from '../db/database.js';
import { LOGIN_LOCKED, PARAM_ERROR, PASSWORD_CHANGE_REQUIRED } from '../utils/errorCodes.js';
import { createPasswordHash } from '../utils/password.js';

const DEFAULT_BASE_URL = 'http://localhost:3000';
const baseUrl = (process.env.SMOKE_BASE_URL || process.env.API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 5000);
const passedChecks = [];
const SMOKE_INITIAL_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || 'Smoke-Initial!2026Aa1';
const SMOKE_CHANGED_PASSWORD = process.env.SMOKE_CHANGED_ADMIN_PASSWORD || 'Smoke-Changed!2026Aa1';
let defaultAuthHeaders = {};

function pass(name, detail = '') {
  passedChecks.push({ name, detail });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function requestPayload(name, path, options = {}) {
  if (typeof fetch !== 'function') {
    throw new Error('当前 Node 版本不支持原生 fetch，请使用 Node 18+ 后再运行 smoke test。');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const url = new URL(path, `${baseUrl}/`).toString();

  try {
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        ...(options.skipAuth ? {} : defaultAuthHeaders),
        ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
      body: options.body ? (isFormData ? options.body : JSON.stringify(options.body)) : undefined,
      signal: controller.signal,
    });
    const responseText = await response.text();
    let payload;

    try {
      payload = JSON.parse(responseText);
    } catch {
      throw new Error(`${name} 返回非 JSON 内容：HTTP ${response.status}`);
    }

    return { payload, response };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`${name} 超时：${timeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function setDefaultAuthToken(token) {
  defaultAuthHeaders = token ? { Authorization: `Bearer ${token}` } : {};
}

function prepareSmokeAdminPassword() {
  db.prepare(
    `UPDATE users
     SET password_hash = @passwordHash,
         must_change_password = 1,
         updated_at = @updatedAt
     WHERE username = 'admin'`,
  ).run({
    passwordHash: createPasswordHash(SMOKE_INITIAL_PASSWORD),
    updatedAt: new Date().toISOString(),
  });

  db.prepare('DELETE FROM auth_sessions').run();
  db.prepare('DELETE FROM auth_login_attempts').run();
}

async function requestJson(name, path, options = {}) {
  const { payload, response } = await requestPayload(name, path, options);

  if (!response.ok || payload.code !== 0) {
    throw new Error(`${name} 失败：HTTP ${response.status} code=${payload.code} message=${payload.message || 'unknown'}`);
  }

  return payload.data || {};
}

async function requestExpectedError(name, path, expectedCode, options = {}) {
  const { payload } = await requestPayload(name, path, options);

  assert(payload.code === expectedCode, `${name} 错误码不匹配，期望 ${expectedCode}，实际 ${payload.code}`);
  assert(payload.message, `${name} 未返回错误 message`);
  pass(name, `code=${payload.code}`);

  return payload;
}

async function checkList(name, path, options = {}) {
  const data = await requestJson(name, path, options);
  assert(Array.isArray(data.list), `${name} 未返回 list 数组`);
  assert(data.list.length > 0, `${name} list 为空，请先运行 npm run server:seed`);
  pass(name, `${data.list.length} 条`);
  return data.list;
}

async function checkDetail(name, path, key, id, options = {}) {
  const data = await requestJson(name, path, options);
  assert(data[key]?.id === id, `${name} 返回详情 ID 不匹配，期望 ${id}`);
  pass(name, id);
  return data[key];
}

async function run() {
  console.log(`Local API smoke test: ${baseUrl}`);
  prepareSmokeAdminPassword();

  const health = await requestJson('健康检查 API', '/api/health');
  assert(health.status === 'ok', '健康检查 API 未返回 status=ok');
  pass('健康检查 API', '/api/health');

  await requestExpectedError('Auth API: unauthenticated protected GET blocked', '/api/dashboard/overview', 40101);
  await requestExpectedError('Auth API: current user unauthorized', '/api/auth/me', 40101);
  await requestExpectedError('Auth API: login invalid password', '/api/auth/login', 40101, {
    method: 'POST',
    body: { username: 'admin', password: 'wrong-password' },
  });
  for (let index = 1; index < 5; index += 1) {
    await requestExpectedError(`Auth API: login rate limit failure ${index}`, '/api/auth/login', 40101, {
      method: 'POST',
      body: { username: 'lock-smoke-user', password: `wrong-password-${index}` },
    });
  }
  await requestExpectedError('Auth API: login rate limit locked', '/api/auth/login', LOGIN_LOCKED, {
    method: 'POST',
    body: { username: 'lock-smoke-user', password: 'wrong-password-5' },
  });
  const loginResult = await requestJson('Auth API: login', '/api/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: SMOKE_INITIAL_PASSWORD },
  });
  assert(loginResult.mock === false && loginResult.user?.id && loginResult.token, 'Auth API: login did not return real session');
  assert(loginResult.permissions?.includes('settings:user:read'), 'Auth API: login did not return RBAC permissions');
  assert(loginResult.user?.mustChangePassword === true, 'Auth API: login did not return mustChangePassword=true for seeded admin');
  pass('Auth API: login', loginResult.user.username);
  const authOptions = {
    headers: { Authorization: `Bearer ${loginResult.token}` },
  };
  await requestExpectedError('Auth API: initial password blocks protected GET', '/api/dashboard/overview', PASSWORD_CHANGE_REQUIRED, authOptions);
  const passwordChangeResult = await requestJson('Auth API: change password', '/api/auth/change-password', {
    method: 'POST',
    body: { oldPassword: SMOKE_INITIAL_PASSWORD, newPassword: SMOKE_CHANGED_PASSWORD },
    ...authOptions,
  });
  assert(passwordChangeResult.success === true, 'Auth API: change password did not return success=true');
  assert(passwordChangeResult.user?.mustChangePassword === false, 'Auth API: change password did not clear mustChangePassword');
  pass('Auth API: change password', passwordChangeResult.changedAt);
  const currentUser = await requestJson('Auth API: current user', '/api/auth/me', authOptions);
  assert(currentUser.user?.id, 'Auth API: current user did not return user');
  assert(currentUser.user?.mustChangePassword === false, 'Auth API: current user still requires password change');
  pass('Auth API: current user', currentUser.user.username);
  const dashboard = await requestJson('Dashboard API: overview', '/api/dashboard/overview', authOptions);
  assert(dashboard.overview?.stats?.length > 0, 'Dashboard API: overview did not return stats');
  pass('Dashboard API: overview', `${dashboard.overview.stats.length} stats`);
  const refreshResult = await requestJson('Auth API: refresh', '/api/auth/refresh', {
    method: 'POST',
    ...authOptions,
  });
  assert(refreshResult.sessionExpiresAt, 'Auth API: refresh did not return sessionExpiresAt');
  pass('Auth API: refresh', refreshResult.sessionExpiresAt);
  const logoutResult = await requestJson('Auth API: logout', '/api/auth/logout', {
    method: 'POST',
    ...authOptions,
  });
  assert(logoutResult.success === true, 'Auth API: logout did not return success=true');
  pass('Auth API: logout', logoutResult.loggedOutAt);
  const reloginResult = await requestJson('Auth API: relogin for protected APIs', '/api/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: SMOKE_CHANGED_PASSWORD },
  });
  setDefaultAuthToken(reloginResult.token);
  const protectedOptions = {
    headers: { Authorization: `Bearer ${reloginResult.token}` },
  };
  async function uploadSmokeFile(name, { content, mimeType, fileName, module, businessId, fileType }) {
    const formData = new FormData();
    formData.append('file', new Blob([content], { type: mimeType }), fileName);
    formData.append('module', module);
    formData.append('businessId', businessId);
    formData.append('fileType', fileType);

    const result = await requestJson(name, '/api/files/upload', {
      method: 'POST',
      body: formData,
      ...protectedOptions,
    });

    assert(result.file?.fileId, `${name} did not return fileId`);
    assert(result.mock === false, `${name} did not return mock=false`);
    assert(result.file.fileUrl?.startsWith(`/uploads/${module}/`), `${name} did not return module uploads URL`);
    pass(name, result.file.fileId);

    return result;
  }

  await requestExpectedError('File API: upload unauthorized', '/api/files/upload', 40101, {
    method: 'POST',
    skipAuth: true,
  });
  const uploadFormData = new FormData();
  uploadFormData.append('file', new Blob(['smoke test image placeholder'], { type: 'image/png' }), 'smoke-demo.png');
  uploadFormData.append('module', 'product');
  uploadFormData.append('businessId', 'P001');
  uploadFormData.append('fileType', 'image');
  const uploadResult = await requestJson('File API: real local upload', '/api/files/upload', {
    method: 'POST',
    body: uploadFormData,
    ...protectedOptions,
  });
  assert(uploadResult.file?.fileId, 'File API: mock upload did not return fileId');
  assert(uploadResult.mock === false, 'File API: real local upload did not return mock=false');
  assert(uploadResult.file.fileUrl?.startsWith('/uploads/'), 'File API: real local upload did not return uploads URL');
  pass('File API: real local upload', uploadResult.file.fileId);
  const uploadedResponse = await fetch(new URL(uploadResult.file.fileUrl, `${baseUrl}/`).toString());
  assert(uploadedResponse.ok, 'File API: uploaded file static URL is not accessible');
  pass('File API: uploaded static file', uploadResult.file.fileUrl);
  const ticketAttachmentFormData = new FormData();
  ticketAttachmentFormData.append('file', new Blob(['smoke test ticket log'], { type: 'text/plain' }), 'ticket-log.txt');
  ticketAttachmentFormData.append('module', 'ticket');
  ticketAttachmentFormData.append('businessId', 'new-ticket');
  ticketAttachmentFormData.append('fileType', 'document');
  const ticketAttachmentUpload = await requestJson('File API: ticket attachment upload', '/api/files/upload', {
    method: 'POST',
    body: ticketAttachmentFormData,
    ...protectedOptions,
  });
  assert(ticketAttachmentUpload.file?.fileId, 'File API: ticket attachment upload did not return fileId');
  pass('File API: ticket attachment upload', ticketAttachmentUpload.file.fileId);
  const avatarImageUpload = await uploadSmokeFile('File API: avatar image upload', {
    content: 'smoke avatar image',
    mimeType: 'image/png',
    fileName: 'avatar-photo.png',
    module: 'avatar',
    businessId: 'A001',
    fileType: 'image',
  });
  const avatarVideoUpload = await uploadSmokeFile('File API: avatar video upload', {
    content: 'smoke avatar video',
    mimeType: 'video/mp4',
    fileName: 'avatar-video.mp4',
    module: 'avatar',
    businessId: 'A001',
    fileType: 'video',
  });
  assert(avatarVideoUpload.file.fileType === 'video', 'File API: avatar video upload fileType mismatch');
  const avatarAudioUpload = await uploadSmokeFile('File API: avatar audio upload', {
    content: 'smoke avatar audio',
    mimeType: 'audio/mpeg',
    fileName: 'avatar-audio.mp3',
    module: 'avatar',
    businessId: 'A001',
    fileType: 'audio',
  });
  assert(avatarAudioUpload.file.fileType === 'audio', 'File API: avatar audio upload fileType mismatch');
  const avatarAuthorizationUpload = await uploadSmokeFile('File API: avatar authorization upload', {
    content: 'smoke avatar authorization',
    mimeType: 'application/pdf',
    fileName: 'avatar-authorization.pdf',
    module: 'avatar_authorization',
    businessId: 'A001',
    fileType: 'document',
  });
  const systemLogoUpload = await uploadSmokeFile('File API: system logo upload', {
    content: 'smoke system logo',
    mimeType: 'image/png',
    fileName: 'system-logo.png',
    module: 'settings',
    businessId: 'basic',
    fileType: 'logo',
  });
  assert(avatarImageUpload.file.fileType === 'image', 'File API: avatar image upload fileType mismatch');
  assert(avatarAuthorizationUpload.file.fileType === 'document', 'File API: avatar authorization upload fileType mismatch');
  assert(systemLogoUpload.file.fileType === 'logo', 'File API: system logo upload fileType mismatch');

  const products = await checkList('商品 API：商品列表', '/api/products');
  await checkDetail('商品 API：商品详情', `/api/products/${products[0].id}`, 'product', products[0].id);
  await checkList('商品 API：商品组列表', '/api/product-groups');
  await requestExpectedError('商品 API：创建商品未登录拦截', '/api/products', 40101, {
    method: 'POST',
    body: { name: 'Smoke auth guard product' },
    skipAuth: true,
  });
  await requestExpectedError('商品 API：创建商品参数校验', '/api/products', 40001, {
    method: 'POST',
    body: { name: '' },
    ...protectedOptions,
  });

  const avatars = await checkList('数字人 API：数字人列表', '/api/avatars');
  await checkDetail('数字人 API：数字人详情', `/api/avatars/${avatars[0].id}`, 'avatar', avatars[0].id);
  await checkList('数字人 API：动作库列表', '/api/avatar-actions');

  const liveRooms = await checkList('直播管理 API：直播间列表', '/api/live-rooms');
  await checkDetail('直播管理 API：直播间详情', `/api/live-rooms/${liveRooms[0].id}`, 'liveRoom', liveRooms[0].id);
  await checkList('直播管理 API：直播任务列表', '/api/live-tasks');

  await checkList('直播间搭建 API：背景方案列表', '/api/studio/backgrounds');
  await checkList('直播间搭建 API：布局模板列表', '/api/studio/layouts');
  const outputStatus = await requestJson('直播间搭建 API：输出状态', '/api/studio/output-status');
  assert(outputStatus.outputStatus?.id, '直播间搭建 API：输出状态未返回 outputStatus');
  pass('直播间搭建 API：输出状态', outputStatus.outputStatus.id);
  const generatedBackground = await requestJson('直播间搭建 API：Mock 背景生成', '/api/studio/backgrounds/generate-mock', {
    method: 'POST',
    body: {
      category: 'Smoke Test',
      visualStyle: 'Mock',
      ratio: '9:16',
      mainColor: '#2563eb',
      prompt: 'Smoke test mock background generation. No external image API call.',
    },
    ...protectedOptions,
  });
  assert(generatedBackground.background?.id, '直播间搭建 API：Mock 背景生成未返回 background');
  pass('直播间搭建 API：Mock 背景生成', generatedBackground.background.id);

  const interactionComments = await checkList('Interaction API: comments', '/api/interaction/comments');
  const simulatedComment = await requestJson('Interaction API: simulate comment', '/api/dev/interaction/comments/simulate', {
    method: 'POST',
    body: {
      liveRoomId: 'LR001',
      content: 'Smoke test mock comment. No real live platform or WebSocket call.',
      productName: 'Smoke Test Product',
    },
    ...protectedOptions,
  });
  assert(simulatedComment.comment?.id, 'Interaction API: simulate comment did not return comment');
  pass('Interaction API: simulate comment', simulatedComment.comment.id);
  const interactionQuestions = await checkList('Interaction API: questions', '/api/interaction/questions');
  const replyResult = await requestJson('Interaction API: question reply', `/api/interaction/questions/${interactionQuestions[0].id}/reply`, {
    method: 'POST',
    body: { replyText: 'Smoke test mock reply. No real AI call.' },
    ...protectedOptions,
  });
  assert(replyResult.question?.aiReply, 'Interaction API: question reply did not return aiReply');
  pass('Interaction API: question reply', replyResult.question.id);
  const queueResult = await requestJson('Interaction API: add question to queue', `/api/interaction/questions/${interactionQuestions[0].id}/add-to-queue`, {
    method: 'POST',
    body: { mock: true },
    ...protectedOptions,
  });
  assert(queueResult.question?.status, 'Interaction API: add question to queue did not return status');
  pass('Interaction API: add question to queue', queueResult.question.id);
  const manualTakeoverState = await requestJson('Interaction API: manual takeover state', '/api/interaction/manual-takeover');
  assert(manualTakeoverState.manualTakeover?.currentLiveRoom, 'Interaction API: manual takeover state did not return currentLiveRoom');
  pass('Interaction API: manual takeover state', manualTakeoverState.manualTakeover.currentLiveRoom);
  const manualSpeechResult = await requestJson('Interaction API: manual speech mock', '/api/interaction/manual-speech', {
    method: 'POST',
    body: {
      speechText: 'Smoke test manual speech. No digital human broadcast.',
      broadcastMode: '立即插队 Mock',
    },
    ...protectedOptions,
  });
  assert(manualSpeechResult.mock === true, 'Interaction API: manual speech mock did not return mock=true');
  pass('Interaction API: manual speech mock', manualSpeechResult.status);

  const delayCurrent = await requestJson('Delay Control API: current speech', '/api/delay-control/current');
  assert(delayCurrent.delayControl?.currentSpeech?.text, 'Delay Control API: current speech did not return currentSpeech');
  pass('Delay Control API: current speech', delayCurrent.delayControl.currentSpeech.id);
  const delayQueue = await checkList('Delay Control API: speech queue', '/api/delay-control/queue');
  const patchedSpeech = await requestJson('Delay Control API: patch speech queue item', `/api/delay-control/queue/${delayQueue[0].id}`, {
    method: 'PATCH',
    body: {
      riskLevel: '中',
      reviewStatus: '待审核',
      scheduledTime: '20:30:00',
    },
    ...protectedOptions,
  });
  assert(patchedSpeech.speechItem?.id === delayQueue[0].id, 'Delay Control API: patch speech queue item did not return speechItem');
  pass('Delay Control API: patch speech queue item', patchedSpeech.speechItem.id);
  const approvedSpeech = await requestJson('Delay Control API: approve speech item', `/api/delay-control/queue/${delayQueue[0].id}/approve`, {
    method: 'POST',
    body: { approvedBy: 'smoke-test' },
    ...protectedOptions,
  });
  assert(approvedSpeech.reviewStatus, 'Delay Control API: approve speech item did not return reviewStatus');
  pass('Delay Control API: approve speech item', approvedSpeech.reviewStatus);
  const rejectedSpeech = await requestJson('Delay Control API: reject speech item', `/api/delay-control/queue/${delayQueue[0].id}/reject`, {
    method: 'POST',
    body: { reason: 'smoke test mock reject' },
    ...protectedOptions,
  });
  assert(rejectedSpeech.reviewStatus, 'Delay Control API: reject speech item did not return reviewStatus');
  pass('Delay Control API: reject speech item', rejectedSpeech.reviewStatus);
  const insertedSpeech = await requestJson('Delay Control API: insert speech item', `/api/delay-control/queue/${delayQueue[0].id}/insert`, {
    method: 'POST',
    body: { position: 1 },
    ...protectedOptions,
  });
  assert(insertedSpeech.reviewStatus, 'Delay Control API: insert speech item did not return reviewStatus');
  pass('Delay Control API: insert speech item', insertedSpeech.reviewStatus);
  const subtitleData = await requestJson('Delay Control API: subtitles', '/api/delay-control/subtitles');
  assert(subtitleData.subtitles?.currentSubtitle?.text, 'Delay Control API: subtitles did not return currentSubtitle');
  pass('Delay Control API: subtitles', subtitleData.subtitles.currentSubtitle.id);
  const savedSubtitleStyle = await requestJson('Delay Control API: save subtitle settings', '/api/delay-control/subtitles/settings', {
    method: 'PUT',
    body: { fontSize: 30, position: '底部' },
    ...protectedOptions,
  });
  assert(savedSubtitleStyle.subtitleStyle?.fontSize === 30, 'Delay Control API: save subtitle settings did not persist fontSize');
  pass('Delay Control API: save subtitle settings', `${savedSubtitleStyle.subtitleStyle.fontSize}px`);
  const delaySettings = await requestJson('Delay Control API: settings', '/api/delay-control/settings');
  assert(delaySettings.settings?.delayMode, 'Delay Control API: settings did not return delayMode');
  pass('Delay Control API: settings', delaySettings.settings.delayMode);
  const savedDelaySettings = await requestJson('Delay Control API: save settings', '/api/delay-control/settings', {
    method: 'PUT',
    body: {
      delayMode: delaySettings.settings.delayMode,
      delaySeconds: 6,
      reviewRules: { smokeTestReviewRule: true },
      queueRules: { smokeTestQueueRule: true },
    },
    ...protectedOptions,
  });
  assert(savedDelaySettings.settings?.delaySeconds === 6, 'Delay Control API: save settings did not persist delaySeconds');
  pass('Delay Control API: save settings', `${savedDelaySettings.settings.delaySeconds}s`);
  const deletedSpeech = await requestJson('Delay Control API: delete speech item', `/api/delay-control/queue/${delayQueue[delayQueue.length - 1].id}`, {
    method: 'DELETE',
    body: { reason: 'smoke test mock delete' },
    ...protectedOptions,
  });
  assert(deletedSpeech.id === delayQueue[delayQueue.length - 1].id, 'Delay Control API: delete speech item did not return deleted id');
  pass('Delay Control API: delete speech item', deletedSpeech.id);

  const controlOverview = await requestJson('Live Control Room API: overview', '/api/live/control-room/overview');
  assert(controlOverview.task?.id, 'Live Control Room API: overview did not return task');
  assert(controlOverview.statusBar?.currentLiveRoom, 'Live Control Room API: overview did not return statusBar');
  pass('Live Control Room API: overview', controlOverview.task.id);
  const controlComments = await requestJson('Live Control Room API: comments', `/api/live/control-room/comments?taskId=${controlOverview.task.id}`);
  assert(Array.isArray(controlComments.list), 'Live Control Room API: comments did not return list');
  assert(controlComments.list.length > 0, 'Live Control Room API: comments list is empty');
  pass('Live Control Room API: comments', `${controlComments.list.length} 条`);
  const controlQuestions = await requestJson('Live Control Room API: questions', `/api/live/control-room/questions?taskId=${controlOverview.task.id}`);
  assert(Array.isArray(controlQuestions.list), 'Live Control Room API: questions did not return list');
  assert(controlQuestions.list.length > 0, 'Live Control Room API: questions list is empty');
  pass('Live Control Room API: questions', `${controlQuestions.list.length} 条`);
  const controlBroadcast = await requestJson('Live Control Room API: broadcast', `/api/live/control-room/broadcast?taskId=${controlOverview.task.id}`);
  assert(controlBroadcast.currentSpeech?.text, 'Live Control Room API: broadcast did not return currentSpeech');
  assert(Array.isArray(controlBroadcast.speechQueue), 'Live Control Room API: broadcast did not return speechQueue');
  pass('Live Control Room API: broadcast', controlBroadcast.currentSpeech.id);
  const controlManualSpeech = await requestJson('Live Control Room API: manual speech mock', '/api/live/control-room/manual-speech', {
    method: 'POST',
    body: {
      taskId: controlOverview.task.id,
      text: 'Smoke test live control room manual speech. No real broadcast.',
      tone: '专业',
      action: '看评论区',
      broadcastMode: '立即插队 Mock',
    },
    ...protectedOptions,
  });
  assert(controlManualSpeech.mock === true, 'Live Control Room API: manual speech mock did not return mock=true');
  pass('Live Control Room API: manual speech mock', controlManualSpeech.status);
  const controlSpeechItem = controlBroadcast.speechQueue[0];
  const controlSpeechPatch = await requestJson('Live Control Room API: speech queue operation', `/api/live/control-room/speech-queue/${controlSpeechItem.id}`, {
    method: 'PATCH',
    body: {
      operation: 'approve',
    },
    ...protectedOptions,
  });
  assert(controlSpeechPatch.speechItem?.id === controlSpeechItem.id, 'Live Control Room API: speech queue operation did not return speechItem');
  pass('Live Control Room API: speech queue operation', controlSpeechPatch.reviewStatus);

  const assistantSettings = await requestJson('AI 能力中心 API：AI 助理设置', '/api/ai/assistant');
  assert(assistantSettings.assistant?.assistantName, 'AI 能力中心 API：AI 助理设置未返回 assistantName');
  pass('AI 能力中心 API：AI 助理设置', assistantSettings.assistant.assistantName);
  const savedAssistantSettings = await requestJson('AI 能力中心 API：保存 AI 助理设置', '/api/ai/assistant', {
    method: 'PUT',
    body: {
      assistantName: 'Smoke Test AI Assistant',
      defaultMode: '直播中控建议模式',
      defaultTone: '专业',
      enabled: true,
      allowReadPageContext: true,
      allowFillForm: true,
      enableComplianceReminder: true,
      allowedContextScopes: ['商品信息', '直播间配置'],
    },
    ...protectedOptions,
  });
  assert(savedAssistantSettings.assistant?.assistantName === 'Smoke Test AI Assistant', 'AI 能力中心 API：保存 AI 助理设置未生效');
  pass('AI 能力中心 API：保存 AI 助理设置', savedAssistantSettings.assistant.assistantName);
  const aiModels = await checkList('AI 能力中心 API：模型服务列表', '/api/ai/models');
  const runtimePolicy = await requestJson('AI 能力中心 API：运行策略', '/api/ai/runtime-policy', protectedOptions);
  assert(runtimePolicy.policy?.defaultProvider === 'fake', 'AI 能力中心 API：运行策略 defaultProvider 不是 fake');
  assert(runtimePolicy.policy.realProviderEnabled === false, 'AI 能力中心 API：运行策略不应默认开启真实 provider');
  assert(runtimePolicy.guardrails?.budgetGuardEnabled === true, 'AI 能力中心 API：运行策略未返回预算保护状态');
  pass('AI 能力中心 API：运行策略', runtimePolicy.policy.mode);
  const updatedAiModel = await requestJson('AI 能力中心 API：保存模型配置 Mock', `/api/ai/models/${aiModels[0].id}`, {
    method: 'PUT',
    body: {
      baseUrl: aiModels[0].officialBaseUrl || '',
      modelName: aiModels[0].defaultModel,
      maxTokens: 1024,
      temperature: 0.6,
      enabled: true,
    },
    ...protectedOptions,
  });
  assert(updatedAiModel.model?.id === aiModels[0].id, 'AI 能力中心 API：保存模型配置未返回 model');
  pass('AI 能力中心 API：保存模型配置 Mock', updatedAiModel.model.id);
  const smokeFakeKey = 'fake-smoke-key-never-real-001';
  const savedCredential = await requestJson('AI 能力中心 API：保存模型凭证脱敏状态', `/api/ai/models/${aiModels[0].id}/credentials`, {
    method: 'PUT',
    body: {
      source: 'smoke_fake',
      apiKey: smokeFakeKey,
      baseUrl: aiModels[0].officialBaseUrl || '',
      modelName: aiModels[0].defaultModel,
      remark: 'Smoke test fake credential only',
    },
    ...protectedOptions,
  });
  assert(savedCredential.credential?.apiKeyConfigured === true, 'AI 能力中心 API：保存模型凭证未返回已配置状态');
  assert(savedCredential.credential.apiKeyMasked && savedCredential.credential.apiKeyMasked !== smokeFakeKey, 'AI 能力中心 API：模型凭证未脱敏');
  pass('AI 能力中心 API：保存模型凭证脱敏状态', savedCredential.credential.credentialRef);
  const credentialStatus = await requestJson('AI 能力中心 API：读取模型凭证脱敏状态', `/api/ai/models/${aiModels[0].id}/credentials`, protectedOptions);
  assert(credentialStatus.credential?.apiKeyConfigured === true, 'AI 能力中心 API：读取模型凭证未返回已配置状态');
  assert(credentialStatus.credential.apiKeyMasked === savedCredential.credential.apiKeyMasked, 'AI 能力中心 API：读取模型凭证脱敏状态不一致');
  pass('AI 能力中心 API：读取模型凭证脱敏状态', credentialStatus.credential.credentialRef);
  const modelTestResult = await requestJson('AI 能力中心 API：fake provider 测试模型连接', `/api/ai/models/${aiModels[0].id}/test`, {
    method: 'POST',
    body: { sourcePage: 'Smoke Test' },
    ...protectedOptions,
  });
  assert(modelTestResult.mock === true, 'AI 能力中心 API：测试模型连接不是 fake provider 结果');
  assert(modelTestResult.realProviderEnabled === false, 'AI 能力中心 API：测试模型连接不应开启真实 provider');
  assert(modelTestResult.tokens === 300, 'AI 能力中心 API：fake provider token 数不匹配');
  pass('AI 能力中心 API：fake provider 测试模型连接', modelTestResult.status);
  const realModelBlocked = await requestJson('AI 能力中心 API：真实 provider 测试拦截', `/api/ai/models/${aiModels[0].id}/test`, {
    method: 'POST',
    body: {
      sourcePage: 'Smoke Test',
      realProvider: true,
    },
    ...protectedOptions,
  });
  assert(realModelBlocked.blocked === true, 'AI 能力中心 API：真实 provider 测试未被拦截');
  assert(realModelBlocked.guardrail?.reason === 'real_provider_disabled', 'AI 能力中心 API：真实 provider 测试拦截原因不匹配');
  assert(realModelBlocked.realProviderEnabled === false, 'AI 能力中心 API：真实 provider 测试不应开启真实调用');
  pass('AI 能力中心 API：真实 provider 测试拦截', realModelBlocked.guardrail.reason);
  const productCopyGenerated = await requestJson('AI 能力中心 API：product_copy fake 生成', '/api/ai/generate', {
    method: 'POST',
    body: {
      scenario: 'product_copy',
      target: 'description',
      sourcePage: 'Smoke Test',
      productId: 'P001',
      options: {
        style: '数字人自然口吻',
        length: '中',
        complianceCheck: true,
      },
      realProvider: false,
    },
    ...protectedOptions,
  });
  assert(productCopyGenerated.content, 'AI 能力中心 API：product_copy fake 生成未返回 content');
  assert(productCopyGenerated.mock === true, 'AI 能力中心 API：product_copy fake 生成未返回 mock=true');
  assert(productCopyGenerated.provider === 'fake', 'AI 能力中心 API：product_copy fake 生成 provider 不是 fake');
  assert(productCopyGenerated.logId, 'AI 能力中心 API：product_copy fake 生成未返回 logId');
  pass('AI 能力中心 API：product_copy fake 生成', productCopyGenerated.logId);
  const productCopyRealBlocked = await requestJson('AI 能力中心 API：product_copy 真实 provider 拦截', '/api/ai/generate', {
    method: 'POST',
    body: {
      scenario: 'product_copy',
      target: 'description',
      sourcePage: 'Smoke Test',
      productId: 'P001',
      providerId: aiModels[0].id,
      realProvider: true,
    },
    ...protectedOptions,
  });
  assert(productCopyRealBlocked.blocked === true, 'AI 能力中心 API：product_copy 真实 provider 未被拦截');
  assert(productCopyRealBlocked.guardrail?.reason === 'real_provider_disabled', 'AI 能力中心 API：product_copy 真实 provider 拦截原因不匹配');
  assert(productCopyRealBlocked.realProviderEnabled === false, 'AI 能力中心 API：product_copy 真实 provider 不应开启真实调用');
  pass('AI 能力中心 API：product_copy 真实 provider 拦截', productCopyRealBlocked.guardrail.reason);
  await requestExpectedError('AI 能力中心 API：product_copy scenario 参数校验', '/api/ai/generate', 40001, {
    method: 'POST',
    body: {
      scenario: 'unknown',
      target: 'description',
    },
    ...protectedOptions,
  });
  const deletedCredential = await requestJson('AI 能力中心 API：删除模型凭证脱敏状态', `/api/ai/models/${aiModels[0].id}/credentials`, {
    method: 'DELETE',
    ...protectedOptions,
  });
  assert(deletedCredential.credential?.apiKeyConfigured === false, 'AI 能力中心 API：删除模型凭证未清除配置状态');
  pass('AI 能力中心 API：删除模型凭证脱敏状态', aiModels[0].id);
  const aiDefaults = await checkList('AI 能力中心 API：默认模型设置', '/api/ai/models/defaults');
  const savedAiDefault = await requestJson('AI 能力中心 API：保存默认模型设置', '/api/ai/models/defaults', {
    method: 'PATCH',
    body: {
      role: aiDefaults[0].id,
      providerId: aiModels[0].id,
      modelName: aiModels[0].defaultModel,
    },
    ...protectedOptions,
  });
  assert(savedAiDefault.defaultModel?.id === aiDefaults[0].id, 'AI 能力中心 API：保存默认模型设置未返回 defaultModel');
  pass('AI 能力中心 API：保存默认模型设置', savedAiDefault.defaultModel.id);
  const promptList = await checkList('AI 能力中心 API：Prompt 模板列表', '/api/ai/prompts');
  const updatedPrompt = await requestJson('AI 能力中心 API：更新 Prompt 模板', `/api/ai/prompts/${promptList[0].id}`, {
    method: 'PUT',
    body: {
      name: promptList[0].name,
      category: promptList[0].category,
      status: promptList[0].status,
      templateContent: `${promptList[0].templateContent}\n\nSmoke test update.`,
    },
    ...protectedOptions,
  });
  assert(updatedPrompt.prompt?.id === promptList[0].id, 'AI 能力中心 API：更新 Prompt 模板未返回 prompt');
  pass('AI 能力中心 API：更新 Prompt 模板', updatedPrompt.prompt.id);
  const copiedPrompt = await requestJson('AI 能力中心 API：复制 Prompt 模板', `/api/ai/prompts/${promptList[0].id}/copy`, {
    method: 'POST',
    ...protectedOptions,
  });
  assert(copiedPrompt.prompt?.id, 'AI 能力中心 API：复制 Prompt 模板未返回 prompt');
  pass('AI 能力中心 API：复制 Prompt 模板', copiedPrompt.prompt.id);
  const complianceKeywords = await checkList('AI 能力中心 API：合规词库', '/api/compliance/keywords', protectedOptions);
  assert(complianceKeywords.some((item) => item.text === '全网最低'), 'AI 能力中心 API：合规词库缺少 seed 词条');
  const complianceCheck = await requestJson('AI 能力中心 API：合规文本检查', '/api/compliance/check', {
    method: 'POST',
    body: {
      text: '这款商品全网最低，库存有限。',
      sourcePage: 'Smoke Test',
      scenario: 'manual_check',
      target: 'smoke_text',
    },
    ...protectedOptions,
  });
  assert(complianceCheck.result?.riskLevel === '高', 'AI 能力中心 API：合规文本检查未返回高风险');
  assert(complianceCheck.result?.action === 'block', 'AI 能力中心 API：合规文本检查未返回 block 动作');
  assert(complianceCheck.logId, 'AI 能力中心 API：合规文本检查未返回 logId');
  pass('AI 能力中心 API：合规文本检查', complianceCheck.result.action);
  await requestExpectedError('AI 能力中心 API：合规词条参数校验', '/api/compliance/keywords', 40001, {
    method: 'POST',
    body: { text: '' },
    ...protectedOptions,
  });
  const createdComplianceKeyword = await requestJson('AI 能力中心 API：新增合规词条', '/api/compliance/keywords', {
    method: 'POST',
    body: {
      text: '烟火测试禁用表达',
      category: 'Smoke Test',
      riskLevel: '中',
      action: 'warn',
      matchType: 'contains',
      enabled: true,
      description: 'Smoke test keyword only.',
    },
    ...protectedOptions,
  });
  assert(createdComplianceKeyword.keyword?.id, 'AI 能力中心 API：新增合规词条未返回 keyword');
  pass('AI 能力中心 API：新增合规词条', createdComplianceKeyword.keyword.id);
  await checkList('AI 能力中心 API：调用日志', '/api/ai/logs');
  const aiCostData = await requestJson('AI 能力中心 API：成本监控', '/api/ai/costs');
  assert(aiCostData.costs?.budgetSettings, 'AI 能力中心 API：成本监控未返回 budgetSettings');
  pass('AI 能力中心 API：成本监控', `${aiCostData.costs.todayCalls} calls`);
  const savedAiBudget = await requestJson('AI 能力中心 API：保存成本预算', '/api/ai/costs/budget', {
    method: 'PATCH',
    body: {
      dailyBudget: 150,
      monthlyBudget: 3200,
      overBudgetAlert: true,
      highCostModelAlert: true,
    },
    ...protectedOptions,
  });
  assert(savedAiBudget.budgetSettings?.dailyBudget === 150, 'AI 能力中心 API：保存成本预算未生效');
  pass('AI 能力中心 API：保存成本预算', `daily=${savedAiBudget.budgetSettings.dailyBudget}`);

  await checkList('系统设置 API：用户列表', '/api/settings/users', protectedOptions);
  await checkList('系统设置 API：角色列表', '/api/settings/roles', protectedOptions);
  const basicSettings = await requestJson('系统设置 API：基础设置', '/api/settings/basic', protectedOptions);
  assert(basicSettings.settings && typeof basicSettings.settings === 'object', '系统设置 API：基础设置未返回 settings 对象');
  pass('系统设置 API：基础设置', '/api/settings/basic');
  const basicSettingsValidation = await requestExpectedError('系统设置 API：基础设置参数校验', '/api/settings/basic', 40001, {
    method: 'PUT',
    body: { systemName: '' },
    ...protectedOptions,
  });
  assert(basicSettingsValidation.error?.field === 'systemName', '系统设置 API：基础设置参数校验未返回 field=systemName');
  assert(basicSettingsValidation.error?.reason === '系统名称不能为空', '系统设置 API：基础设置参数校验 reason 不匹配');
  const savedLogoSettings = await requestJson('系统设置 API：保存 Logo 引用', '/api/settings/basic', {
    method: 'PUT',
    body: {
      ...(basicSettings.settings || {}),
      systemName: basicSettings.settings?.systemName || '数字人直播带货中控系统',
      logo: systemLogoUpload.file,
    },
    ...protectedOptions,
  });
  assert(savedLogoSettings.settings?.logo?.fileId === systemLogoUpload.file.fileId, '系统设置 API：保存 Logo 引用未保留 fileId');
  pass('系统设置 API：保存 Logo 引用', savedLogoSettings.settings.logo.fileId);
  await checkList('系统设置 API：操作日志', '/api/settings/logs', protectedOptions);

  await checkList('帮助中心 API：FAQ', '/api/help/faq');
  await checkList('帮助中心 API：快速排查', '/api/help/troubleshooting');
  await checkList('帮助中心 API：工单列表', '/api/help/tickets');
  const createdTicket = await requestJson('帮助中心 API：创建带附件工单', '/api/help/tickets', {
    method: 'POST',
    body: {
      type: '执行端问题',
      urgency: '高',
      description: 'Smoke test ticket with local uploaded attachment.',
      attachmentIds: [ticketAttachmentUpload.file.fileId],
    },
    ...protectedOptions,
  });
  assert(createdTicket.ticket?.attachments?.length === 1, '帮助中心 API：创建带附件工单未返回附件');
  pass('帮助中心 API：创建带附件工单', createdTicket.ticket.id);
  await checkList('帮助中心 API：教程列表', '/api/help/tutorials');
  await checkList('帮助中心 API：系统状态', '/api/help/status');
  await checkList('帮助中心 API：更新日志', '/api/help/changelog');

  const executors = await checkList('执行端 API：执行端列表', '/api/executors');
  await checkDetail('执行端 API：执行端详情', `/api/executors/${executors[0].id}`, 'executor', executors[0].id);
  const obsList = await checkList('执行端 API：OBS 状态列表', '/api/executor-obs');
  const obsDetail = await requestJson('执行端 API：单执行端 OBS 状态', `/api/executor-obs/${obsList[0].executorId}`);
  assert(obsDetail.obsStatus?.executorId === obsList[0].executorId, '执行端 API：单执行端 OBS 状态返回 executorId 不匹配');
  pass('执行端 API：单执行端 OBS 状态', obsList[0].executorId);
  const heartbeats = await checkList('执行端 API：心跳日志', '/api/executor-heartbeats');
  assert(heartbeats[0].executorId, '执行端 API：心跳日志缺少 executorId');
  pass('执行端 API：心跳日志字段检查', heartbeats[0].executorId);
  const bindResult = await requestJson('执行端 API：绑定信息 Mock', '/api/executors/bind', {
    method: 'POST',
    body: { expiresInMinutes: 10 },
    ...protectedOptions,
  });
  assert(bindResult.code && bindResult.bindUrl, '执行端 API：绑定信息 Mock 未返回 code 或 bindUrl');
  pass('执行端 API：绑定信息 Mock', bindResult.code);
  const bindCodeResult = await requestJson('执行端协议 API：生成绑定码', '/api/executors/bind-code', {
    method: 'POST',
    body: { expiresInMinutes: 10 },
    ...protectedOptions,
  });
  assert(bindCodeResult.bindCode && bindCodeResult.expiresAt, '执行端协议 API：生成绑定码未返回 bindCode 或 expiresAt');
  pass('执行端协议 API：生成绑定码', bindCodeResult.bindCode);
  const registeredExecutor = await requestJson('执行端协议 API：绑定码注册换取 device token', '/api/executors/register', {
    method: 'POST',
    body: {
      bindCode: bindCodeResult.bindCode,
      name: 'Smoke Test Executor',
      deviceName: 'Smoke Test Local Agent',
      deviceId: 'SMOKE-EXECUTOR-001',
      os: 'Windows Mock',
      version: '0.1.0-smoke',
    },
    skipAuth: true,
  });
  assert(registeredExecutor.executor?.id, '执行端协议 API：注册未返回 executor');
  assert(registeredExecutor.deviceToken, '执行端协议 API：注册未返回 deviceToken');
  pass('执行端协议 API：绑定码注册换取 device token', registeredExecutor.executor.id);
  const deviceOptions = {
    headers: { Authorization: `Bearer ${registeredExecutor.deviceToken}` },
  };
  const heartbeatResult = await requestJson(
    '执行端协议 API：device token 心跳上报',
    `/api/executors/${registeredExecutor.executor.id}/heartbeat`,
    {
      method: 'POST',
      body: {
        onlineStatus: 'online',
        obsStatus: 'connected',
        virtualCameraStatus: 'enabled',
        cpuUsage: 12,
        memoryUsage: 34,
        networkLatency: 28,
        version: '0.1.0-smoke',
        timestamp: new Date().toISOString(),
      },
      ...deviceOptions,
    },
  );
  assert(heartbeatResult.heartbeat?.id, '执行端协议 API：心跳未返回 heartbeat');
  assert(heartbeatResult.executor?.lastHeartbeatAt, '执行端协议 API：心跳未刷新 lastHeartbeatAt');
  assert(heartbeatResult.executor?.status === '在线', '执行端协议 API：心跳未将 online 归一为 在线');
  assert(heartbeatResult.executor?.obsStatus === '已连接', '执行端协议 API：心跳未将 connected 归一为 已连接');
  pass('执行端协议 API：device token 心跳上报', heartbeatResult.heartbeat.id);
  const commandResult = await requestJson(
    '执行端协议 API：管理端写入待执行命令',
    `/api/executors/${registeredExecutor.executor.id}/restart`,
    {
      method: 'POST',
      body: { reason: 'smoke test command only' },
      ...protectedOptions,
    },
  );
  assert(commandResult.commandId, '执行端协议 API：管理端写入待执行命令未返回 commandId');
  pass('执行端协议 API：管理端写入待执行命令', commandResult.commandId);
  const pendingCommands = await requestJson(
    '执行端协议 API：执行端拉取待执行命令',
    `/api/executors/${registeredExecutor.executor.id}/commands/pending`,
    deviceOptions,
  );
  assert(Array.isArray(pendingCommands.list), '执行端协议 API：待执行命令未返回 list');
  assert(
    pendingCommands.list.some((item) => item.id === commandResult.commandId),
    '执行端协议 API：待执行命令中未包含刚写入的命令',
  );
  pass('执行端协议 API：执行端拉取待执行命令', `${pendingCommands.list.length} commands`);
  const commandAck = await requestJson(
    '执行端协议 API：执行端回执命令结果',
    `/api/executors/commands/${commandResult.commandId}/ack`,
    {
      method: 'POST',
      body: {
        status: 'succeeded',
        resultMessage: 'Smoke command acknowledged. No real local action executed.',
      },
      ...deviceOptions,
    },
  );
  assert(commandAck.command?.status === 'succeeded', '执行端协议 API：命令回执未更新 status');
  pass('执行端协议 API：执行端回执命令结果', commandAck.command.id);
  const speakCommand = await requestJson(
    '执行端协议 API：管理端下发 speak 播报命令',
    `/api/executors/${registeredExecutor.executor.id}/speak`,
    {
      method: 'POST',
      body: {
        text: 'Smoke test digital human speech line.',
        tone: 'natural',
        source: 'smoke_test',
      },
      ...protectedOptions,
    },
  );
  assert(speakCommand.commandId, '执行端协议 API：speak 命令未返回 commandId');
  pass('执行端协议 API：管理端下发 speak 播报命令', speakCommand.commandId);
  const speakPendingCommands = await requestJson(
    '执行端协议 API：执行端拉取 speak 待播命令',
    `/api/executors/${registeredExecutor.executor.id}/commands/pending`,
    deviceOptions,
  );
  assert(
    speakPendingCommands.list?.some((item) => item.id === speakCommand.commandId && item.commandType === 'speak'),
    '执行端协议 API：待执行命令中未包含 speak 命令',
  );
  pass('执行端协议 API：执行端拉取 speak 待播命令', speakCommand.commandId);
  const speakAck = await requestJson(
    '执行端协议 API：执行端回执 speak 播报结果',
    `/api/executors/commands/${speakCommand.commandId}/ack`,
    {
      method: 'POST',
      body: {
        status: 'succeeded',
        resultMessage: 'PrintAdapter simulated digital human speech successfully.',
        detail: {
          ok: true,
          adapter: 'print',
          startedAt: new Date().toISOString(),
          durationMs: 1280,
          message: 'PrintAdapter simulated digital human speech successfully.',
          commandType: 'speak',
          source: 'smoke_test',
        },
      },
      ...deviceOptions,
    },
  );
  assert(speakAck.command?.status === 'succeeded', '执行端协议 API：speak 回执未更新 status');
  assert(speakAck.command?.ackPayload?.detail?.adapter === 'print', '执行端协议 API：speak 回执未保存 adapter detail');
  pass('执行端协议 API：执行端回执 speak 播报结果', speakAck.command.id);
  db.prepare('UPDATE live_tasks SET executor_id = ?, executor_name = ?, updated_at = ? WHERE id = ?').run(
    registeredExecutor.executor.id,
    registeredExecutor.executor.name || 'Smoke Test Executor',
    new Date().toISOString(),
    'LT001',
  );
  const manualQueued = await requestJson('Live Control Room API: manual takeover enqueue speech', '/api/live/control-room/manual-speech', {
    method: 'POST',
    body: {
      taskId: 'LT001',
      text: 'Smoke test manual takeover enqueue line.',
      tone: '专业',
      action: '看评论区',
      deliveryMode: 'queue',
    },
    ...protectedOptions,
  });
  assert(manualQueued.speechItem?.source === 'manual_takeover', 'Live Control Room API: manual enqueue did not set source=manual_takeover');
  assert(manualQueued.speechItem?.broadcastStatus === '待下发', 'Live Control Room API: manual enqueue did not mark 待下发');
  pass('Live Control Room API: manual takeover enqueue speech', manualQueued.speechItem.id);
  const blockedManualDirect = await requestExpectedError(
    'Live Control Room API: high risk direct speak blocked by compliance',
    '/api/live/control-room/manual-speech',
    PARAM_ERROR,
    {
      method: 'POST',
      body: {
        taskId: 'LT001',
        text: 'Smoke test 高风险直发：这款商品全网最低。',
        tone: '热情',
        action: '微笑回应',
        deliveryMode: 'direct',
      },
      ...protectedOptions,
    },
  );
  assert(
    blockedManualDirect.error?.riskLevel === '高' &&
      blockedManualDirect.error?.matches?.some((item) => item.keyword === '全网最低'),
    'Live Control Room API: high risk direct speak did not return matched compliance detail',
  );
  const manualDirect = await requestJson('Live Control Room API: manual takeover direct speak', '/api/live/control-room/manual-speech', {
    method: 'POST',
    body: {
      taskId: 'LT001',
      text: 'Smoke test manual takeover direct speak line，最后一天请以页面规则为准。',
      tone: '热情',
      action: '微笑回应',
      deliveryMode: 'direct',
    },
    ...protectedOptions,
  });
  assert(manualDirect.commandId, 'Live Control Room API: manual direct speak did not return commandId');
  assert(manualDirect.speechItem?.broadcastStatus === '下发中', 'Live Control Room API: manual direct speak did not mark 下发中');
  assert(
    manualDirect.riskTips?.some((item) => item.keyword === '最后一天') && manualDirect.speechItem?.riskLevel === '中',
    'Live Control Room API: low or medium risk direct speak did not return riskTips',
  );
  pass('Live Control Room API: manual takeover direct speak', manualDirect.commandId);
  const manualDirectPending = await requestJson(
    'Live Control Room API: executor pulls manual direct speak command',
    `/api/executors/${registeredExecutor.executor.id}/commands/pending`,
    deviceOptions,
  );
  assert(
    manualDirectPending.list?.some((item) => item.id === manualDirect.commandId && item.payload?.speechQueueId === manualDirect.speechItem.id),
    'Live Control Room API: pending commands did not include manual direct speak command',
  );
  pass('Live Control Room API: executor pulls manual direct speak command', manualDirect.commandId);
  const manualDirectAck = await requestJson(
    'Live Control Room API: manual direct speak ack writes queue status',
    `/api/executors/commands/${manualDirect.commandId}/ack`,
    {
      method: 'POST',
      body: {
        status: 'succeeded',
        resultMessage: 'PrintAdapter manual takeover direct speak completed.',
        detail: {
          ok: true,
          adapter: 'print',
          startedAt: new Date().toISOString(),
          durationMs: 960,
          message: 'PrintAdapter manual takeover direct speak completed.',
          commandType: 'speak',
          source: 'manual_takeover_direct',
        },
      },
      ...deviceOptions,
    },
  );
  assert(manualDirectAck.command?.status === 'succeeded', 'Live Control Room API: manual direct speak ack did not update command');
  const manualBroadcasted = await requestJson(
    'Live Control Room API: manual direct queue status after ack',
    `/api/delay-control/queue?liveTaskId=LT001&broadcastStatus=已播报&pageSize=100`,
    protectedOptions,
  );
  assert(
    manualBroadcasted.list?.some((item) => item.id === manualDirect.speechItem.id && item.executorCommandId === manualDirect.commandId),
    'Live Control Room API: manual direct speech item was not marked 已播报 after ack',
  );
  pass('Live Control Room API: manual direct speak ack writes queue status', manualDirect.speechItem.id);
  db.prepare(
    `UPDATE speech_queue
     SET live_task_id = @liveTaskId,
         live_room_id = @liveRoomId,
         text = @text,
         review_status = @reviewStatus,
         broadcast_status = @broadcastStatus,
         risk_level = @riskLevel,
         executor_command_id = '',
         broadcast_result_json = '',
         broadcast_error_message = '',
         broadcast_started_at = '',
         broadcast_finished_at = '',
         updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id: 'SQ003',
    liveTaskId: 'LT001',
    liveRoomId: 'LR001',
    text: 'Smoke test 队列复检：这款商品全网最低。',
    reviewStatus: '已通过',
    broadcastStatus: '待下发',
    riskLevel: '低',
    updatedAt: new Date().toISOString(),
  });
  const blockedQueueDispatch = await requestExpectedError(
    'Delay Control API: high risk queue dispatch blocked by compliance',
    '/api/delay-control/queue/SQ003/dispatch',
    PARAM_ERROR,
    {
      method: 'POST',
      body: { reason: 'smoke high risk queue dispatch' },
      ...protectedOptions,
    },
  );
  assert(
    blockedQueueDispatch.error?.speechItem?.reviewStatus === '高风险待人工',
    'Delay Control API: blocked queue dispatch did not mark speech item 高风险待人工',
  );
  db.prepare(
    `UPDATE speech_queue
     SET live_task_id = @liveTaskId,
         review_status = @reviewStatus,
         broadcast_status = @broadcastStatus,
         executor_command_id = '',
         broadcast_result_json = '',
         broadcast_error_message = '',
         broadcast_started_at = '',
         broadcast_finished_at = '',
         updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id: 'SQ001',
    liveTaskId: 'LT001',
    reviewStatus: '已通过',
    broadcastStatus: '待下发',
    updatedAt: new Date().toISOString(),
  });
  const queueDispatch = await requestJson(
    'Delay Control API: dispatch approved speech item to executor',
    '/api/delay-control/queue/SQ001/dispatch',
    {
      method: 'POST',
      body: { reason: 'smoke queue dispatch' },
      ...protectedOptions,
    },
  );
  assert(queueDispatch.commandId, 'Delay Control API: dispatch did not return commandId');
  assert(queueDispatch.speechItem?.broadcastStatus === '下发中', 'Delay Control API: dispatch did not mark speech item as 下发中');
  pass('Delay Control API: dispatch approved speech item to executor', queueDispatch.commandId);
  const queuePendingCommands = await requestJson(
    'Delay Control API: executor pulls queued speak command',
    `/api/executors/${registeredExecutor.executor.id}/commands/pending`,
    deviceOptions,
  );
  assert(
    queuePendingCommands.list?.some((item) => item.id === queueDispatch.commandId && item.payload?.speechQueueId === 'SQ001'),
    'Delay Control API: pending commands did not include queue speak command',
  );
  pass('Delay Control API: executor pulls queued speak command', queueDispatch.commandId);
  const queueSpeakAck = await requestJson(
    'Delay Control API: queue speak ack writes broadcast status',
    `/api/executors/commands/${queueDispatch.commandId}/ack`,
    {
      method: 'POST',
      body: {
        status: 'succeeded',
        resultMessage: 'PrintAdapter queue speech completed.',
        detail: {
          ok: true,
          adapter: 'print',
          startedAt: new Date().toISOString(),
          durationMs: 1480,
          message: 'PrintAdapter queue speech completed.',
          commandType: 'speak',
          source: 'speech_queue',
        },
      },
      ...deviceOptions,
    },
  );
  assert(queueSpeakAck.command?.status === 'succeeded', 'Delay Control API: queue speak ack did not update command status');
  const broadcastedQueue = await requestJson(
    'Delay Control API: queue item broadcast status after ack',
    '/api/delay-control/queue?liveTaskId=LT001&broadcastStatus=已播报&pageSize=100',
    protectedOptions,
  );
  assert(
    broadcastedQueue.list?.some((item) => item.id === 'SQ001' && item.executorCommandId === queueDispatch.commandId),
    'Delay Control API: queue item was not marked 已播报 after ack',
  );
  pass('Delay Control API: queue item broadcast status after ack', 'SQ001 已播报');
  db.prepare(
    `UPDATE speech_queue
     SET review_status = @reviewStatus,
         broadcast_status = @broadcastStatus,
         scheduled_time = @scheduledTime,
         updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id: 'SQ005',
    reviewStatus: '已通过',
    broadcastStatus: '待下发',
    scheduledTime: '20:19:02',
    updatedAt: new Date().toISOString(),
  });
  const nextDispatch = await requestJson('Delay Control API: dispatch next approved speech item', '/api/delay-control/queue/dispatch-next', {
    method: 'POST',
    body: { liveTaskId: 'LT001' },
    ...protectedOptions,
  });
  assert(nextDispatch.commandId, 'Delay Control API: dispatch-next did not return commandId');
  assert(nextDispatch.speechItem?.broadcastStatus === '下发中', 'Delay Control API: dispatch-next did not mark item 下发中');
  pass('Delay Control API: dispatch next approved speech item', nextDispatch.commandId);
  const obsRefreshCommand = await requestJson(
    '执行端协议 API：管理端写入 OBS 刷新场景命令',
    `/api/executors/${registeredExecutor.executor.id}/obs/refresh-scenes`,
    {
      method: 'POST',
      body: { reason: 'smoke test obs scene refresh' },
      ...protectedOptions,
    },
  );
  assert(obsRefreshCommand.commandId, '执行端协议 API：OBS 刷新场景命令未返回 commandId');
  pass('执行端协议 API：管理端写入 OBS 刷新场景命令', obsRefreshCommand.commandId);
  const obsSceneAck = await requestJson(
    '执行端协议 API：OBS 场景回执写入',
    `/api/executors/commands/${obsRefreshCommand.commandId}/ack`,
    {
      method: 'POST',
      body: {
        status: 'succeeded',
        resultMessage: 'Smoke OBS scenes refreshed.',
        detail: {
          obsStatus: '已连接',
          obsVersion: 'OBS 31.0 Smoke',
          obsWebSocketVersion: '5.0 Smoke',
          currentScene: 'Smoke Scene',
          virtualCameraStatus: '未连接',
          sourceCount: 2,
          scenes: [
            {
              name: 'Smoke Scene',
              sources: [
                { name: 'Smoke Camera', type: 'input', sceneItemId: 1, enabled: true },
                { name: 'Smoke Text', type: 'text', sceneItemId: 2, enabled: true },
              ],
            },
          ],
          checkedAt: new Date().toISOString(),
        },
      },
      ...deviceOptions,
    },
  );
  assert(obsSceneAck.command?.status === 'succeeded', '执行端协议 API：OBS 场景回执未更新命令状态');
  pass('执行端协议 API：OBS 场景回执写入', obsSceneAck.command.id);
  const obsStatusAfterAck = await requestJson(
    '执行端协议 API：读取真实 OBS 场景回执',
    `/api/executor-obs/${registeredExecutor.executor.id}`,
    protectedOptions,
  );
  assert(obsStatusAfterAck.obsStatus?.obsStatus === '已连接', '执行端协议 API：OBS 状态未写入 已连接');
  assert(obsStatusAfterAck.obsStatus?.currentScene === 'Smoke Scene', '执行端协议 API：OBS 当前场景未写入');
  assert(
    obsStatusAfterAck.sceneSources?.some((item) => item.name === 'Smoke Camera' && item.sceneName === 'Smoke Scene'),
    '执行端协议 API：OBS 场景来源未写入',
  );
  pass('执行端协议 API：读取真实 OBS 场景回执', obsStatusAfterAck.obsStatus.currentScene);

  const liveSessionOpen = await requestJson('Live Session API：开播（stub 数字人）', '/api/live/sessions', {
    method: 'POST',
    body: { figureId: 'FIG-SMOKE', roomName: 'Smoke 直播间', mode: 'realtime' },
  });
  assert(liveSessionOpen.session?.id, 'Live Session API：开播未返回会话 id');
  assert(liveSessionOpen.session?.status === 'ready', 'Live Session API：开播状态非 ready');
  assert(liveSessionOpen.provider === 'stub', 'Live Session API：默认未走 stub provider');
  const liveSessionId = liveSessionOpen.session.id;
  pass('Live Session API：开播（stub 数字人）', liveSessionId);

  const liveSessionGet = await requestJson('Live Session API：查询会话', `/api/live/sessions/${liveSessionId}`);
  assert(liveSessionGet.session?.id === liveSessionId, 'Live Session API：查询会话 id 不一致');
  pass('Live Session API：查询会话', liveSessionGet.session.status);

  const liveSessionSpeak = await requestJson(
    'Live Session API：驱动数字人说话',
    `/api/live/sessions/${liveSessionId}/speak`,
    { method: 'POST', body: { text: '家人们，这是一段用于联调的测试播报，价格库存以页面为准。' } },
  );
  assert(liveSessionSpeak.ok === true, 'Live Session API：驱动未返回 ok');
  assert(liveSessionSpeak.spokenText, 'Live Session API：驱动未回显文本');
  pass('Live Session API：驱动数字人说话', liveSessionSpeak.sentenceId);

  const liveSessionClose = await requestJson('Live Session API：下播', `/api/live/sessions/${liveSessionId}/close`, {
    method: 'POST',
  });
  assert(liveSessionClose.session?.status === 'ended', 'Live Session API：下播后状态非 ended');
  pass('Live Session API：下播', liveSessionClose.session.status);

  const commentReply = await requestJson('AI 能力中心 API：弹幕回复（fake 兜底）', '/api/ai/comment-reply', {
    method: 'POST',
    body: { comment: '这个有优惠吗？什么时候发货？', productName: 'Smoke 商品' },
  });
  assert(typeof commentReply.reply === 'string' && commentReply.reply.length > 0, 'AI 能力中心 API：弹幕回复为空');
  pass('AI 能力中心 API：弹幕回复（fake 兜底）', `len=${commentReply.reply.length}`);

  console.log(`\nSmoke Test 通过：${passedChecks.length} 项`);
  passedChecks.forEach((item, index) => {
    const detail = item.detail ? ` - ${item.detail}` : '';
    console.log(`${String(index + 1).padStart(2, '0')}. ${item.name}${detail}`);
  });
}

run().catch((error) => {
  console.error('\nSmoke Test 失败');
  console.error(error.message);

  if (passedChecks.length) {
    console.error('\n已通过项目：');
    passedChecks.forEach((item, index) => {
      const detail = item.detail ? ` - ${item.detail}` : '';
      console.error(`${String(index + 1).padStart(2, '0')}. ${item.name}${detail}`);
    });
  }

  process.exit(1);
});
