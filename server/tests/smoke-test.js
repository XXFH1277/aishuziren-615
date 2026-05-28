const DEFAULT_BASE_URL = 'http://localhost:3000';
const baseUrl = (process.env.SMOKE_BASE_URL || process.env.API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 5000);
const passedChecks = [];

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

  const health = await requestJson('健康检查 API', '/api/health');
  assert(health.status === 'ok', '健康检查 API 未返回 status=ok');
  pass('健康检查 API', '/api/health');

  const dashboard = await requestJson('Dashboard API: overview', '/api/dashboard/overview');
  assert(dashboard.overview?.stats?.length > 0, 'Dashboard API: overview did not return stats');
  pass('Dashboard API: overview', `${dashboard.overview.stats.length} stats`);
  await requestExpectedError('Auth API: current user unauthorized', '/api/auth/me', 40101);
  await requestExpectedError('Auth API: login invalid password', '/api/auth/login', 40101, {
    method: 'POST',
    body: { username: 'admin', password: 'wrong-password' },
  });
  const loginResult = await requestJson('Auth API: login', '/api/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: 'admin123456' },
  });
  assert(loginResult.mock === false && loginResult.user?.id && loginResult.token, 'Auth API: login did not return real session');
  assert(loginResult.permissions?.includes('settings:user:read'), 'Auth API: login did not return RBAC permissions');
  pass('Auth API: login', loginResult.user.username);
  const authOptions = {
    headers: { Authorization: `Bearer ${loginResult.token}` },
  };
  const currentUser = await requestJson('Auth API: current user', '/api/auth/me', authOptions);
  assert(currentUser.user?.id, 'Auth API: current user did not return user');
  pass('Auth API: current user', currentUser.user.username);
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
    body: { username: 'admin', password: 'admin123456' },
  });
  const protectedOptions = {
    headers: { Authorization: `Bearer ${reloginResult.token}` },
  };
  await requestExpectedError('File API: upload unauthorized', '/api/files/upload', 40101, {
    method: 'POST',
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

  const products = await checkList('商品 API：商品列表', '/api/products');
  await checkDetail('商品 API：商品详情', `/api/products/${products[0].id}`, 'product', products[0].id);
  await checkList('商品 API：商品组列表', '/api/product-groups');
  await requestExpectedError('商品 API：创建商品参数校验', '/api/products', 40001, {
    method: 'POST',
    body: { name: '' },
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
  });
  assert(simulatedComment.comment?.id, 'Interaction API: simulate comment did not return comment');
  pass('Interaction API: simulate comment', simulatedComment.comment.id);
  const interactionQuestions = await checkList('Interaction API: questions', '/api/interaction/questions');
  const replyResult = await requestJson('Interaction API: question reply', `/api/interaction/questions/${interactionQuestions[0].id}/reply`, {
    method: 'POST',
    body: { replyText: 'Smoke test mock reply. No real AI call.' },
  });
  assert(replyResult.question?.aiReply, 'Interaction API: question reply did not return aiReply');
  pass('Interaction API: question reply', replyResult.question.id);
  const queueResult = await requestJson('Interaction API: add question to queue', `/api/interaction/questions/${interactionQuestions[0].id}/add-to-queue`, {
    method: 'POST',
    body: { mock: true },
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
  });
  assert(patchedSpeech.speechItem?.id === delayQueue[0].id, 'Delay Control API: patch speech queue item did not return speechItem');
  pass('Delay Control API: patch speech queue item', patchedSpeech.speechItem.id);
  const approvedSpeech = await requestJson('Delay Control API: approve speech item', `/api/delay-control/queue/${delayQueue[0].id}/approve`, {
    method: 'POST',
    body: { approvedBy: 'smoke-test' },
  });
  assert(approvedSpeech.reviewStatus, 'Delay Control API: approve speech item did not return reviewStatus');
  pass('Delay Control API: approve speech item', approvedSpeech.reviewStatus);
  const rejectedSpeech = await requestJson('Delay Control API: reject speech item', `/api/delay-control/queue/${delayQueue[0].id}/reject`, {
    method: 'POST',
    body: { reason: 'smoke test mock reject' },
  });
  assert(rejectedSpeech.reviewStatus, 'Delay Control API: reject speech item did not return reviewStatus');
  pass('Delay Control API: reject speech item', rejectedSpeech.reviewStatus);
  const insertedSpeech = await requestJson('Delay Control API: insert speech item', `/api/delay-control/queue/${delayQueue[0].id}/insert`, {
    method: 'POST',
    body: { position: 1 },
  });
  assert(insertedSpeech.reviewStatus, 'Delay Control API: insert speech item did not return reviewStatus');
  pass('Delay Control API: insert speech item', insertedSpeech.reviewStatus);
  const subtitleData = await requestJson('Delay Control API: subtitles', '/api/delay-control/subtitles');
  assert(subtitleData.subtitles?.currentSubtitle?.text, 'Delay Control API: subtitles did not return currentSubtitle');
  pass('Delay Control API: subtitles', subtitleData.subtitles.currentSubtitle.id);
  const savedSubtitleStyle = await requestJson('Delay Control API: save subtitle settings', '/api/delay-control/subtitles/settings', {
    method: 'PUT',
    body: { fontSize: 30, position: '底部' },
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
  });
  assert(savedDelaySettings.settings?.delaySeconds === 6, 'Delay Control API: save settings did not persist delaySeconds');
  pass('Delay Control API: save settings', `${savedDelaySettings.settings.delaySeconds}s`);
  const deletedSpeech = await requestJson('Delay Control API: delete speech item', `/api/delay-control/queue/${delayQueue[delayQueue.length - 1].id}`, {
    method: 'DELETE',
    body: { reason: 'smoke test mock delete' },
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
  });
  assert(controlManualSpeech.mock === true, 'Live Control Room API: manual speech mock did not return mock=true');
  pass('Live Control Room API: manual speech mock', controlManualSpeech.status);
  const controlSpeechItem = controlBroadcast.speechQueue[0];
  const controlSpeechPatch = await requestJson('Live Control Room API: speech queue operation', `/api/live/control-room/speech-queue/${controlSpeechItem.id}`, {
    method: 'PATCH',
    body: {
      operation: 'approve',
    },
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
  });
  assert(savedAssistantSettings.assistant?.assistantName === 'Smoke Test AI Assistant', 'AI 能力中心 API：保存 AI 助理设置未生效');
  pass('AI 能力中心 API：保存 AI 助理设置', savedAssistantSettings.assistant.assistantName);
  const aiModels = await checkList('AI 能力中心 API：模型服务列表', '/api/ai/models');
  const updatedAiModel = await requestJson('AI 能力中心 API：保存模型配置 Mock', `/api/ai/models/${aiModels[0].id}`, {
    method: 'PUT',
    body: {
      baseUrl: aiModels[0].officialBaseUrl || '',
      modelName: aiModels[0].defaultModel,
      maxTokens: 1024,
      temperature: 0.6,
      enabled: true,
    },
  });
  assert(updatedAiModel.model?.id === aiModels[0].id, 'AI 能力中心 API：保存模型配置未返回 model');
  pass('AI 能力中心 API：保存模型配置 Mock', updatedAiModel.model.id);
  const modelTestResult = await requestJson('AI 能力中心 API：测试模型连接 Mock', `/api/ai/models/${aiModels[0].id}/test`, {
    method: 'POST',
    body: { mock: true },
  });
  assert(modelTestResult.mock === true, 'AI 能力中心 API：测试模型连接不是 Mock 结果');
  pass('AI 能力中心 API：测试模型连接 Mock', modelTestResult.status);
  const aiDefaults = await checkList('AI 能力中心 API：默认模型设置', '/api/ai/models/defaults');
  const savedAiDefault = await requestJson('AI 能力中心 API：保存默认模型设置', '/api/ai/models/defaults', {
    method: 'PATCH',
    body: {
      role: aiDefaults[0].id,
      providerId: aiModels[0].id,
      modelName: aiModels[0].defaultModel,
    },
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
  });
  assert(updatedPrompt.prompt?.id === promptList[0].id, 'AI 能力中心 API：更新 Prompt 模板未返回 prompt');
  pass('AI 能力中心 API：更新 Prompt 模板', updatedPrompt.prompt.id);
  const copiedPrompt = await requestJson('AI 能力中心 API：复制 Prompt 模板', `/api/ai/prompts/${promptList[0].id}/copy`, {
    method: 'POST',
  });
  assert(copiedPrompt.prompt?.id, 'AI 能力中心 API：复制 Prompt 模板未返回 prompt');
  pass('AI 能力中心 API：复制 Prompt 模板', copiedPrompt.prompt.id);
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
  await checkList('系统设置 API：操作日志', '/api/settings/logs', protectedOptions);

  await checkList('帮助中心 API：FAQ', '/api/help/faq');
  await checkList('帮助中心 API：快速排查', '/api/help/troubleshooting');
  await checkList('帮助中心 API：工单列表', '/api/help/tickets');
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
  });
  assert(bindResult.code && bindResult.bindUrl, '执行端 API：绑定信息 Mock 未返回 code 或 bindUrl');
  pass('执行端 API：绑定信息 Mock', bindResult.code);

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
