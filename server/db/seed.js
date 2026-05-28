import { avatarActions } from '../../src/mock/avatarActions.js';
import { avatars } from '../../src/mock/avatars.js';
import { aiCallLogs } from '../../src/mock/aiCallLogs.js';
import { aiCosts } from '../../src/mock/aiCosts.js';
import { modelProviders, modelRoleSettings } from '../../src/mock/aiModels.js';
import { changelog } from '../../src/mock/changelog.js';
import { executorHeartbeats } from '../../src/mock/executorHeartbeats.js';
import { executorObsList } from '../../src/mock/executorObs.js';
import { executors } from '../../src/mock/executors.js';
import { helpFaqList } from '../../src/mock/helpFaq.js';
import { comments } from '../../src/mock/comments.js';
import { delayControl } from '../../src/mock/delayControl.js';
import { delaySettings } from '../../src/mock/delaySettings.js';
import { liveRooms } from '../../src/mock/liveRooms.js';
import { liveTasks } from '../../src/mock/liveTasks.js';
import { manualTakeover } from '../../src/mock/manualTakeover.js';
import { productGroups } from '../../src/mock/productGroups.js';
import { products } from '../../src/mock/products.js';
import { promptTemplates } from '../../src/mock/promptTemplates.js';
import { questions } from '../../src/mock/questions.js';
import { speechQueue } from '../../src/mock/speechQueue.js';
import { basicSettings, operationLogs, roles, users } from '../../src/mock/settings.js';
import { studioBackgrounds } from '../../src/mock/studioBackgrounds.js';
import { studioLayouts } from '../../src/mock/studioLayouts.js';
import { studioOutput } from '../../src/mock/studioOutput.js';
import { subtitles } from '../../src/mock/subtitles.js';
import { systemStatusList } from '../../src/mock/systemStatus.js';
import { tickets } from '../../src/mock/tickets.js';
import { troubleshootingList } from '../../src/mock/troubleshooting.js';
import { tutorials } from '../../src/mock/tutorials.js';
import { db, now, runSchema, toJson } from './database.js';
import { createPasswordHash } from '../utils/password.js';
import { getPermissionKeysForRole } from '../utils/permissions.js';

runSchema();

const timestamp = now();
const DEFAULT_DEV_PASSWORD = 'admin123456';
const executorIdByName = new Map([
  ['杭州执行端 01', 'EX001'],
  ['舟山直播电脑 02', 'EX002'],
  ['云端执行端预留', 'EX003'],
  ['未绑定', ''],
]);

const liveRoomById = new Map(liveRooms.map((item) => [item.id, item]));
const productIdByName = new Map(products.map((item) => [item.name, item.id]));
const productGroupIdByName = new Map(productGroups.map((item) => [item.name, item.id]));
const executorCommandMocks = [
  {
    id: 'CMD001',
    executorId: 'EX001',
    commandType: 'restart',
    payload: { source: 'seed', mock: true },
    status: '已完成',
    resultMessage: 'Mock 重启指令已记录，未触达真实设备。',
    createdBy: 'system-seed',
    createdAt: '2026-05-26 22:20:00',
    executedAt: '2026-05-26 22:20:05',
  },
  {
    id: 'CMD002',
    executorId: 'EX004',
    commandType: 'refresh_obs',
    payload: { source: 'seed', mock: true },
    status: '已下发',
    resultMessage: 'Mock 刷新 OBS 场景指令已记录。',
    createdBy: 'system-seed',
    createdAt: '2026-05-26 22:21:00',
    executedAt: '',
  },
  {
    id: 'CMD003',
    executorId: 'EX002',
    commandType: 'refresh_config',
    payload: { source: 'seed', mock: true },
    status: '已完成',
    resultMessage: 'Mock 刷新配置指令已记录。',
    createdBy: 'system-seed',
    createdAt: '2026-05-26 22:22:00',
    executedAt: '2026-05-26 22:22:04',
  },
];

function clearTables() {
  [
    'product_group_items',
    'products',
    'product_groups',
    'avatars',
    'avatar_actions',
    'live_tasks',
    'live_rooms',
    'studio_output_status',
    'studio_layouts',
    'studio_backgrounds',
    'delay_settings',
    'subtitle_settings',
    'speech_queue',
    'delay_control_state',
    'ai_cost_daily',
    'ai_call_logs',
    'prompt_templates',
    'ai_model_role_settings',
    'ai_model_providers',
    'ai_assistant_settings',
    'manual_takeover_state',
    'questions',
    'comments',
    'auth_sessions',
    'users',
    'roles',
    'basic_settings',
    'operation_logs',
    'help_faq',
    'troubleshooting_guides',
    'ticket_attachments',
    'tickets',
    'tutorials',
    'system_status',
    'changelog',
    'executor_commands',
    'executor_heartbeats',
    'executor_obs_status',
    'executors',
    'file_assets',
  ].forEach((tableName) => {
    db.prepare(`DELETE FROM ${tableName}`).run();
  });
}

function seedProducts() {
  const insertProduct = db.prepare(
    `INSERT INTO products (
      id, name, category, brand, price, stock, status, image, description,
      group_id, group_name, selling_points, faq, scripts, forbidden_expressions,
      created_at, updated_at
    ) VALUES (
      @id, @name, @category, @brand, @price, @stock, @status, @image, @description,
      @groupId, @groupName, @sellingPoints, @faq, @scripts, @forbiddenExpressions,
      @createdAt, @updatedAt
    )`,
  );

  const insertGroup = db.prepare(
    `INSERT INTO product_groups (
      id, name, type, product_count, main_product, live_room, product_ids_json, created_at, updated_at
    ) VALUES (
      @id, @name, @type, @productCount, @mainProduct, @liveRoom, @productIds, @createdAt, @updatedAt
    )`,
  );

  const insertGroupItem = db.prepare(
    `INSERT INTO product_group_items (
      id, product_group_id, product_id, sort_order, role_in_group, created_at
    ) VALUES (
      @id, @productGroupId, @productId, @sortOrder, @roleInGroup, @createdAt
    )`,
  );

  productGroups.forEach((group) => {
    const groupProducts = products.filter((product) => product.groupName === group.name);

    insertGroup.run({
      id: group.id,
      name: group.name,
      type: group.type,
      productCount: group.productCount ?? groupProducts.length,
      mainProduct: group.mainProduct,
      liveRoom: group.liveRoom,
      productIds: toJson(groupProducts.map((product) => product.id)),
      createdAt: group.createdAt || group.updatedAt || timestamp,
      updatedAt: group.updatedAt || timestamp,
    });

    groupProducts.forEach((product, index) => {
      insertGroupItem.run({
        id: `${group.id}-${product.id}`,
        productGroupId: group.id,
        productId: product.id,
        sortOrder: index + 1,
        roleInGroup: index === 0 ? 'main' : 'profit',
        createdAt: timestamp,
      });
    });
  });

  products.forEach((product) => {
    insertProduct.run({
      id: product.id,
      name: product.name,
      category: product.category,
      brand: product.brand,
      price: Number(product.price || 0),
      stock: Number(product.stock || 0),
      status: product.status,
      image: product.image,
      description: product.description,
      groupId: productGroupIdByName.get(product.groupName) || '',
      groupName: product.groupName,
      sellingPoints: toJson(product.sellingPoints || []),
      faq: toJson(product.faq || []),
      scripts: toJson(product.scripts || []),
      forbiddenExpressions: toJson(product.forbiddenExpressions || []),
      createdAt: product.createdAt || product.updatedAt || timestamp,
      updatedAt: product.updatedAt || timestamp,
    });
  });
}

function seedAvatars() {
  const insertAvatar = db.prepare(
    `INSERT INTO avatars (
      id, name, avatar_image, persona, suitable_categories, voice_name, status,
      bound_live_rooms, language_style, behavior_rules, voice_settings, image_settings,
      training_assets, authorization_status, created_at, updated_at
    ) VALUES (
      @id, @name, @avatarImage, @persona, @suitableCategories, @voiceName, @status,
      @boundLiveRooms, @languageStyle, @behaviorRules, @voiceSettings, @imageSettings,
      @trainingAssets, @authorizationStatus, @createdAt, @updatedAt
    )`,
  );

  const insertAction = db.prepare(
    `INSERT INTO avatar_actions (
      id, name, type, trigger_scene, suitable_tone, status, description, created_at, updated_at
    ) VALUES (
      @id, @name, @type, @triggerScene, @suitableTone, @status, @description, @createdAt, @updatedAt
    )`,
  );

  avatars.forEach((avatar) => {
    insertAvatar.run({
      id: avatar.id,
      name: avatar.name,
      avatarImage: avatar.avatarImage,
      persona: avatar.persona,
      suitableCategories: toJson(avatar.suitableCategories || []),
      voiceName: avatar.voiceName,
      status: avatar.status,
      boundLiveRooms: Number(avatar.boundLiveRooms || 0),
      languageStyle: avatar.languageStyle,
      behaviorRules: toJson(avatar.behaviorRules || []),
      voiceSettings: toJson(avatar.voiceSettings || {}),
      imageSettings: toJson(avatar.imageSettings || {}),
      trainingAssets: toJson(avatar.trainingAssets || {}),
      authorizationStatus: toJson(avatar.authorizationStatus || {}),
      createdAt: avatar.createdAt || avatar.updatedAt || timestamp,
      updatedAt: avatar.updatedAt || timestamp,
    });
  });

  avatarActions.forEach((action) => {
    insertAction.run({
      id: action.id,
      name: action.name,
      type: action.type,
      triggerScene: action.triggerScene,
      suitableTone: action.suitableTone,
      status: action.status,
      description: action.description,
      createdAt: action.createdAt || timestamp,
      updatedAt: action.updatedAt || timestamp,
    });
  });
}

function seedLive() {
  const insertLiveRoom = db.prepare(
    `INSERT INTO live_rooms (
      id, name, theme, platform, platform_account, avatar_id, avatar_name,
      product_group_id, product_group_name, scene_name, layout_type, danmu_enabled,
      ai_reply_enabled, manual_takeover_enabled, delay_control_enabled, delay_seconds,
      status, notes, created_at, updated_at
    ) VALUES (
      @id, @name, @theme, @platform, @platformAccount, @avatarId, @avatarName,
      @productGroupId, @productGroupName, @sceneName, @layoutType, @danmuEnabled,
      @aiReplyEnabled, @manualTakeoverEnabled, @delayControlEnabled, @delaySeconds,
      @status, @notes, @createdAt, @updatedAt
    )`,
  );

  const insertLiveTask = db.prepare(
    `INSERT INTO live_tasks (
      id, task_name, live_room_id, live_room_name, platform, executor_id, executor_name,
      avatar_id, avatar_name, product_group_id, product_group_name, scheduled_start_time,
      status, notes, created_at, updated_at
    ) VALUES (
      @id, @taskName, @liveRoomId, @liveRoomName, @platform, @executorId, @executorName,
      @avatarId, @avatarName, @productGroupId, @productGroupName, @scheduledStartTime,
      @status, @notes, @createdAt, @updatedAt
    )`,
  );

  liveRooms.forEach((room) => {
    insertLiveRoom.run({
      id: room.id,
      name: room.name,
      theme: room.theme,
      platform: room.platform,
      platformAccount: room.platformAccount,
      avatarId: room.avatarId,
      avatarName: room.avatarName,
      productGroupId: room.productGroupId,
      productGroupName: room.productGroupName,
      sceneName: room.sceneName,
      layoutType: room.layoutType,
      danmuEnabled: room.danmuEnabled ? 1 : 0,
      aiReplyEnabled: room.aiReplyEnabled ? 1 : 0,
      manualTakeoverEnabled: room.manualTakeoverEnabled ? 1 : 0,
      delayControlEnabled: room.delayControlEnabled ? 1 : 0,
      delaySeconds: Number(room.delaySeconds || 0),
      status: room.status,
      notes: room.notes,
      createdAt: room.createdAt || room.updatedAt || timestamp,
      updatedAt: room.updatedAt || timestamp,
    });
  });

  liveTasks.forEach((task) => {
    const room = liveRoomById.get(task.liveRoomId);

    insertLiveTask.run({
      id: task.id,
      taskName: task.taskName,
      liveRoomId: task.liveRoomId,
      liveRoomName: task.liveRoomName,
      platform: task.platform,
      executorId: executorIdByName.get(task.executorName) || '',
      executorName: task.executorName,
      avatarId: task.avatarId || room?.avatarId || '',
      avatarName: task.avatarName,
      productGroupId: task.productGroupId || room?.productGroupId || '',
      productGroupName: task.productGroupName,
      scheduledStartTime: task.scheduledStartTime,
      status: task.status,
      notes: task.notes,
      createdAt: task.createdAt || timestamp,
      updatedAt: task.updatedAt || task.createdAt || timestamp,
    });
  });
}

function seedStudio() {
  const insertBackground = db.prepare(
    `INSERT INTO studio_backgrounds (
      id, name, style, ratio, category, prompt, status, preview_color,
      suitable_scene, created_at, updated_at
    ) VALUES (
      @id, @name, @style, @ratio, @category, @prompt, @status, @previewColor,
      @suitableScene, @createdAt, @updatedAt
    )`,
  );

  const insertLayout = db.prepare(
    `INSERT INTO studio_layouts (
      id, name, ratio, avatar_position, product_area_position, danmu_position,
      has_coupon_area, has_title_bar, suitable_for_obs, status, description,
      created_at, updated_at
    ) VALUES (
      @id, @name, @ratio, @avatarPosition, @productAreaPosition, @danmuPosition,
      @hasCouponArea, @hasTitleBar, @suitableForObs, @status, @description,
      @createdAt, @updatedAt
    )`,
  );

  const insertOutputStatus = db.prepare(
    `INSERT INTO studio_output_status (
      id, obs_status, virtual_camera_status, window_capture_status, obs_version,
      current_scene, current_source, resolution, fps, last_heartbeat_at,
      scene_mappings_json, checklist_json, updated_at
    ) VALUES (
      @id, @obsStatus, @virtualCameraStatus, @windowCaptureStatus, @obsVersion,
      @currentScene, @currentSource, @resolution, @fps, @lastHeartbeatAt,
      @sceneMappings, @checklist, @updatedAt
    )`,
  );

  studioBackgrounds.forEach((background) => {
    insertBackground.run({
      id: background.id,
      name: background.name,
      style: background.style,
      ratio: background.ratio,
      category: background.category,
      prompt: background.prompt,
      status: background.status,
      previewColor: background.previewColor,
      suitableScene: background.suitableScene,
      createdAt: background.createdAt || timestamp,
      updatedAt: background.updatedAt || background.createdAt || timestamp,
    });
  });

  studioLayouts.forEach((layout) => {
    insertLayout.run({
      id: layout.id,
      name: layout.name,
      ratio: layout.ratio,
      avatarPosition: layout.avatarPosition,
      productAreaPosition: layout.productAreaPosition,
      danmuPosition: layout.danmuPosition,
      hasCouponArea: layout.hasCouponArea ? 1 : 0,
      hasTitleBar: layout.hasTitleBar ? 1 : 0,
      suitableForObs: layout.suitableForObs ? 1 : 0,
      status: layout.status,
      description: layout.description,
      createdAt: layout.createdAt || timestamp,
      updatedAt: layout.updatedAt || timestamp,
    });
  });

  insertOutputStatus.run({
    id: 'SO001',
    obsStatus: studioOutput.obsStatus,
    virtualCameraStatus: studioOutput.virtualCameraStatus,
    windowCaptureStatus: studioOutput.windowCaptureStatus,
    obsVersion: studioOutput.obsVersion,
    currentScene: studioOutput.currentScene,
    currentSource: studioOutput.currentSource,
    resolution: studioOutput.resolution,
    fps: Number(studioOutput.fps || 0),
    lastHeartbeatAt: studioOutput.lastHeartbeatAt,
    sceneMappings: toJson(studioOutput.sceneMappings || []),
    checklist: toJson(studioOutput.checklist || []),
    updatedAt: studioOutput.updatedAt || studioOutput.lastHeartbeatAt || timestamp,
  });
}

function seedInteraction() {
  const insertComment = db.prepare(
    `INSERT INTO comments (
      id, live_task_id, live_room_id, user_nickname, content, platform,
      comment_time, recognized_type, risk_level, reply_status, handled_status,
      product_id, product_name, created_at
    ) VALUES (
      @id, @liveTaskId, @liveRoomId, @userNickname, @content, @platform,
      @commentTime, @recognizedType, @riskLevel, @replyStatus, @handledStatus,
      @productId, @productName, @createdAt
    )`,
  );

  const insertQuestion = db.prepare(
    `INSERT INTO questions (
      id, live_task_id, live_room_id, comment_id, question, nickname, type,
      product_id, product_name, risk_level, ai_reply, edited_reply, status,
      created_at, updated_at
    ) VALUES (
      @id, @liveTaskId, @liveRoomId, @commentId, @question, @nickname, @type,
      @productId, @productName, @riskLevel, @aiReply, @editedReply, @status,
      @createdAt, @updatedAt
    )`,
  );

  const insertManualTakeover = db.prepare(
    `INSERT INTO manual_takeover_state (
      id, live_task_id, live_room_id, current_avatar_id, current_avatar_name,
      current_product_group_id, current_product_group_name, speech_status,
      executor_status, current_speech, next_speech, upcoming_speech_json,
      recommended_replies_json, risk_warnings_json, updated_at
    ) VALUES (
      @id, @liveTaskId, @liveRoomId, @currentAvatarId, @currentAvatarName,
      @currentProductGroupId, @currentProductGroupName, @speechStatus,
      @executorStatus, @currentSpeech, @nextSpeech, @upcomingSpeech,
      @recommendedReplies, @riskWarnings, @updatedAt
    )`,
  );

  comments.forEach((comment) => {
    insertComment.run({
      id: comment.id,
      liveTaskId: 'LT001',
      liveRoomId: 'LR001',
      userNickname: comment.nickname,
      content: comment.content,
      platform: comment.platform,
      commentTime: comment.time,
      recognizedType: comment.type,
      riskLevel: comment.riskLevel,
      replyStatus: comment.replyStatus,
      handledStatus: comment.replyStatus,
      productId: productIdByName.get(comment.productName) || '',
      productName: comment.productName,
      createdAt: '2026-05-26 ' + comment.time,
    });
  });

  questions.forEach((question, index) => {
    insertQuestion.run({
      id: question.id,
      liveTaskId: 'LT001',
      liveRoomId: 'LR001',
      commentId: comments[index]?.id || '',
      question: question.question,
      nickname: question.nickname,
      type: question.type,
      productId: productIdByName.get(question.relatedProduct) || '',
      productName: question.relatedProduct,
      riskLevel: question.riskLevel,
      aiReply: question.aiReply || '',
      editedReply: '',
      status: question.status,
      createdAt: question.createdAt || timestamp,
      updatedAt: question.createdAt || timestamp,
    });
  });

  insertManualTakeover.run({
    id: 'MTS001',
    liveTaskId: 'LT001',
    liveRoomId: 'LR001',
    currentAvatarId: 'A001',
    currentAvatarName: manualTakeover.currentAvatar,
    currentProductGroupId: productGroupIdByName.get(manualTakeover.currentProductGroup) || 'G005',
    currentProductGroupName: manualTakeover.currentProductGroup,
    speechStatus: manualTakeover.speechStatus,
    executorStatus: manualTakeover.executorStatus,
    currentSpeech: manualTakeover.currentSpeech,
    nextSpeech: manualTakeover.nextSpeech,
    upcomingSpeech: toJson(manualTakeover.upcomingSpeech || []),
    recommendedReplies: toJson(manualTakeover.recommendedReplies || []),
    riskWarnings: toJson(manualTakeover.riskWarnings || []),
    updatedAt: timestamp,
  });
}

function seedDelayControl() {
  const insertDelayState = db.prepare(
    `INSERT INTO delay_control_state (
      id, live_task_id, live_room_id, current_avatar_id, current_avatar_name,
      current_product_group_id, current_product_group_name, delay_mode,
      executor_status, current_speech_json, next_speech_json,
      upcoming_speech_json, risk_summary_json, updated_at
    ) VALUES (
      @id, @liveTaskId, @liveRoomId, @currentAvatarId, @currentAvatarName,
      @currentProductGroupId, @currentProductGroupName, @delayMode,
      @executorStatus, @currentSpeech, @nextSpeech,
      @upcomingSpeech, @riskSummary, @updatedAt
    )`,
  );

  const insertSpeechQueueItem = db.prepare(
    `INSERT INTO speech_queue (
      id, live_task_id, live_room_id, question_id, comment_id, product_id,
      product_name, text, source, action, tone, risk_level, review_status,
      scheduled_time, approved_by, approved_at, created_at, updated_at
    ) VALUES (
      @id, @liveTaskId, @liveRoomId, @questionId, @commentId, @productId,
      @productName, @text, @source, @action, @tone, @riskLevel, @reviewStatus,
      @scheduledTime, @approvedBy, @approvedAt, @createdAt, @updatedAt
    )`,
  );

  const insertSubtitleSettings = db.prepare(
    `INSERT INTO subtitle_settings (
      id, live_task_id, current_subtitle, next_subtitle,
      upcoming_subtitles_json, subtitle_style_json, updated_at
    ) VALUES (
      @id, @liveTaskId, @currentSubtitle, @nextSubtitle,
      @upcomingSubtitles, @subtitleStyle, @updatedAt
    )`,
  );

  const insertDelaySettings = db.prepare(
    `INSERT INTO delay_settings (
      id, delay_mode, delay_seconds, review_rules_json,
      queue_rules_json, risk_rules_json, updated_at
    ) VALUES (
      @id, @delayMode, @delaySeconds, @reviewRules,
      @queueRules, @riskRules, @updatedAt
    )`,
  );

  insertDelayState.run({
    id: 'DCS001',
    liveTaskId: 'LT001',
    liveRoomId: 'LR001',
    currentAvatarId: 'A001',
    currentAvatarName: delayControl.currentAvatar,
    currentProductGroupId: productGroupIdByName.get(delayControl.currentProductGroup) || 'G005',
    currentProductGroupName: delayControl.currentProductGroup,
    delayMode: delayControl.delayMode,
    executorStatus: delayControl.executorStatus,
    currentSpeech: toJson(delayControl.currentSpeech),
    nextSpeech: toJson(delayControl.nextSpeech),
    upcomingSpeech: toJson(delayControl.upcomingSpeech || []),
    riskSummary: toJson(delayControl.riskSummary || {}),
    updatedAt: timestamp,
  });

  speechQueue.forEach((item, index) => {
    insertSpeechQueueItem.run({
      id: item.id,
      liveTaskId: 'LT001',
      liveRoomId: 'LR001',
      questionId: questions[index]?.id || '',
      commentId: comments[index]?.id || '',
      productId: productIdByName.get(item.relatedProduct) || '',
      productName: item.relatedProduct,
      text: item.text,
      source: item.source,
      action: item.action,
      tone: item.tone,
      riskLevel: item.riskLevel,
      reviewStatus: item.reviewStatus,
      scheduledTime: item.scheduledTime,
      approvedBy: item.reviewStatus === '已通过' ? 'system-seed' : '',
      approvedAt: item.reviewStatus === '已通过' ? timestamp : '',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });

  insertSubtitleSettings.run({
    id: 'SUBSET001',
    liveTaskId: 'LT001',
    currentSubtitle: toJson(subtitles.currentSubtitle),
    nextSubtitle: toJson(subtitles.nextSubtitle),
    upcomingSubtitles: toJson(subtitles.upcomingSubtitles || []),
    subtitleStyle: toJson(subtitles.subtitleStyle || {}),
    updatedAt: timestamp,
  });

  insertDelaySettings.run({
    id: 'default',
    delayMode: delaySettings.delayMode,
    delaySeconds: Number(delaySettings.delaySeconds || 0),
    reviewRules: toJson(delaySettings.reviewRules || {}),
    queueRules: toJson(delaySettings.queueRules || {}),
    riskRules: toJson(delaySettings.riskRules || []),
    updatedAt: timestamp,
  });
}

function seedAiCenter() {
  const assistantSettings = {
    enabled: true,
    assistantName: '直播运营 AI 助理',
    defaultMode: '直播中控建议模式',
    defaultTone: '专业',
    allowReadPageContext: true,
    allowFillForm: true,
    enableComplianceReminder: true,
    allowedContextScopes: [
      '允许读取商品信息',
      '允许读取数字人信息',
      '允许读取直播间配置',
      '允许读取弹幕问题',
      '允许读取待播队列',
    ],
  };

  db.prepare(
    `INSERT INTO ai_assistant_settings (id, settings_json, updated_at)
     VALUES ('default', @settingsJson, @updatedAt)`,
  ).run({
    settingsJson: toJson(assistantSettings),
    updatedAt: timestamp,
  });

  const insertModel = db.prepare(
    `INSERT INTO ai_model_providers (
      id, name, provider, usage_json, status, official_base_url,
      base_url_options_json, model_options_json, default_model,
      api_key_configured, credential_ref, api_key_masked, last_test_status,
      last_test_at, today_calls, today_cost, enabled, docs_note,
      is_official_preset, description, max_tokens, temperature, updated_at
    ) VALUES (
      @id, @name, @provider, @usage, @status, @officialBaseUrl,
      @baseUrlOptions, @modelOptions, @defaultModel,
      @apiKeyConfigured, @credentialRef, @apiKeyMasked, @lastTestStatus,
      @lastTestAt, @todayCalls, @todayCost, @enabled, @docsNote,
      @isOfficialPreset, @description, @maxTokens, @temperature, @updatedAt
    )`,
  );

  const insertRoleSetting = db.prepare(
    `INSERT INTO ai_model_role_settings (
      id, label, value, provider_id, model_name, updated_at
    ) VALUES (
      @id, @label, @value, @providerId, @modelName, @updatedAt
    )`,
  );

  const insertPrompt = db.prepare(
    `INSERT INTO prompt_templates (
      id, name, category, target_page, default_model, status,
      template_content, variables_json, updated_at
    ) VALUES (
      @id, @name, @category, @targetPage, @defaultModel, @status,
      @templateContent, @variables, @updatedAt
    )`,
  );

  const insertLog = db.prepare(
    `INSERT INTO ai_call_logs (
      id, call_time, source_page, type, provider, model_name,
      input_summary, output_summary, status, duration, tokens, cost,
      error_message, created_at
    ) VALUES (
      @id, @time, @sourcePage, @type, @provider, @modelName,
      @inputSummary, @outputSummary, @status, @duration, @tokens, @cost,
      @errorMessage, @createdAt
    )`,
  );

  modelProviders.forEach((model) => {
    insertModel.run({
      id: model.id,
      name: model.name,
      provider: model.provider,
      usage: toJson(model.usage || []),
      status: model.status,
      officialBaseUrl: model.officialBaseUrl || '',
      baseUrlOptions: toJson(model.baseUrlOptions || []),
      modelOptions: toJson(model.modelOptions || []),
      defaultModel: model.defaultModel,
      apiKeyConfigured: 0,
      credentialRef: '',
      apiKeyMasked: '',
      lastTestStatus: '未测试',
      lastTestAt: '',
      todayCalls: Number(model.todayCalls || 0),
      todayCost: Number(model.todayCost || 0),
      enabled: model.enabled ? 1 : 0,
      docsNote: model.docsNote,
      isOfficialPreset: model.isOfficialPreset ? 1 : 0,
      description: model.description,
      maxTokens: 2048,
      temperature: 0.7,
      updatedAt: timestamp,
    });
  });

  modelRoleSettings.forEach((item) => {
    insertRoleSetting.run({
      id: item.id,
      label: item.label,
      value: item.value,
      providerId: '',
      modelName: item.value,
      updatedAt: timestamp,
    });
  });

  promptTemplates.forEach((template) => {
    insertPrompt.run({
      id: template.id,
      name: template.name,
      category: template.category,
      targetPage: template.targetPage,
      defaultModel: template.defaultModel,
      status: template.status,
      templateContent: template.templateContent,
      variables: toJson(template.variables || []),
      updatedAt: template.updatedAt || timestamp,
    });
  });

  aiCallLogs.forEach((log) => {
    insertLog.run({
      id: log.id,
      time: log.time,
      sourcePage: log.page,
      type: log.type,
      provider: log.provider,
      modelName: log.modelName,
      inputSummary: log.inputSummary,
      outputSummary: log.outputSummary,
      status: log.status,
      duration: log.duration,
      tokens: Number(log.tokens || 0),
      cost: Number(log.cost || 0),
      errorMessage: log.status === '成功' ? '' : 'Mock error summary only. No sensitive prompt or API key recorded.',
      createdAt: log.time || timestamp,
    });
  });

  db.prepare(
    `INSERT INTO ai_cost_daily (
      id, stat_date, today_calls, today_cost, month_cost, average_cost,
      abnormal_calls, provider_breakdown_json, type_breakdown_json,
      budget_settings_json, updated_at
    ) VALUES (
      'today', @statDate, @todayCalls, @todayCost, @monthCost, @averageCost,
      @abnormalCalls, @providerBreakdown, @typeBreakdown,
      @budgetSettings, @updatedAt
    )`,
  ).run({
    statDate: '2026-05-27',
    todayCalls: Number(aiCosts.todayCalls || 0),
    todayCost: Number(aiCosts.todayCost || 0),
    monthCost: Number(aiCosts.monthCost || 0),
    averageCost: Number(aiCosts.averageCost || 0),
    abnormalCalls: Number(aiCosts.abnormalCalls || 0),
    providerBreakdown: toJson(aiCosts.providerBreakdown || []),
    typeBreakdown: toJson(aiCosts.typeBreakdown || []),
    budgetSettings: toJson(aiCosts.budgetSettings || {}),
    updatedAt: timestamp,
  });
}

function seedSettings() {
  const insertUser = db.prepare(
    `INSERT INTO users (
      id, username, password_hash, nickname, email, phone, role, status, last_login_at,
      recent_login, notes, created_at, updated_at
    ) VALUES (
      @id, @username, @passwordHash, @nickname, @email, @phone, @role, @status, @lastLoginAt,
      @recentLogin, @notes, @createdAt, @updatedAt
    )`,
  );

  const insertRole = db.prepare(
    `INSERT INTO roles (
      id, name, description, user_count, permission_scope, data_scope,
      permission_keys, operation_permissions, menu_permissions, status, created_at, updated_at
    ) VALUES (
      @id, @name, @description, @userCount, @permissionScope, @dataScope,
      @permissionKeys, @operationPermissions, @menuPermissions, @status, @createdAt, @updatedAt
    )`,
  );

  const insertLog = db.prepare(
    `INSERT INTO operation_logs (
      id, time, operator, module, action_type, target, result, ip, device,
      description, before_summary, after_summary, error_message, created_at
    ) VALUES (
      @id, @time, @operator, @module, @actionType, @target, @result, @ip, @device,
      @description, @beforeSummary, @afterSummary, @errorMessage, @createdAt
    )`,
  );

  users.forEach((user) => {
    insertUser.run({
      id: user.id,
      username: user.username,
      passwordHash: createPasswordHash(DEFAULT_DEV_PASSWORD),
      nickname: user.nickname,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      recentLogin: user.recentLogin ? 1 : 0,
      notes: user.notes,
      createdAt: user.createdAt || timestamp,
      updatedAt: user.updatedAt || timestamp,
    });
  });

  roles.forEach((role) => {
    insertRole.run({
      id: role.id,
      name: role.name,
      description: role.description,
      userCount: Number(role.userCount || 0),
      permissionScope: role.permissionScope,
      dataScope: role.dataScope,
      permissionKeys: toJson(getPermissionKeysForRole(role.name)),
      operationPermissions: toJson(role.operationPermissions || []),
      menuPermissions: toJson(role.menuPermissions || []),
      status: role.status,
      createdAt: role.createdAt || role.updatedAt || timestamp,
      updatedAt: role.updatedAt || timestamp,
    });
  });

  db.prepare(
    `INSERT INTO basic_settings (id, settings_json, created_at, updated_at)
     VALUES ('basic', @settingsJson, @createdAt, @updatedAt)`,
  ).run({
    settingsJson: toJson(basicSettings),
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  operationLogs.forEach((log) => {
    insertLog.run({
      id: log.id,
      time: log.time,
      operator: log.operator,
      module: log.module,
      actionType: log.actionType,
      target: log.target,
      result: log.result,
      ip: log.ip,
      device: log.device,
      description: log.description,
      beforeSummary: log.beforeSummary,
      afterSummary: log.afterSummary,
      errorMessage: log.errorMessage,
      createdAt: log.createdAt || log.time || timestamp,
    });
  });
}

function seedExecutors() {
  const insertExecutor = db.prepare(
    `INSERT INTO executors (
      id, name, device_id, bound_account, device_name, os, status,
      current_live_task, obs_status, virtual_camera_status, version,
      last_heartbeat_at, notes, created_at, updated_at
    ) VALUES (
      @id, @name, @deviceId, @boundAccount, @deviceName, @os, @status,
      @currentLiveTask, @obsStatus, @virtualCameraStatus, @version,
      @lastHeartbeatAt, @notes, @createdAt, @updatedAt
    )`,
  );

  const insertObsStatus = db.prepare(
    `INSERT INTO executor_obs_status (
      id, executor_id, executor_name, obs_status, obs_version, current_scene,
      source_count, resolution, fps, virtual_camera_status, output_status,
      error_message, scene_sources_json, last_connected_at, updated_at
    ) VALUES (
      @id, @executorId, @executorName, @obsStatus, @obsVersion, @currentScene,
      @sourceCount, @resolution, @fps, @virtualCameraStatus, @outputStatus,
      @errorMessage, @sceneSources, @lastConnectedAt, @updatedAt
    )`,
  );

  const insertHeartbeat = db.prepare(
    `INSERT INTO executor_heartbeats (
      id, executor_id, executor_name, online_status, obs_status, virtual_camera_status,
      cpu_usage, memory_usage, network_latency, error_message, level, created_at
    ) VALUES (
      @id, @executorId, @executorName, @onlineStatus, @obsStatus, @virtualCameraStatus,
      @cpuUsage, @memoryUsage, @networkLatency, @errorMessage, @level, @createdAt
    )`,
  );

  const insertCommand = db.prepare(
    `INSERT INTO executor_commands (
      id, executor_id, command_type, payload_json, status, result_message,
      created_by, created_at, executed_at
    ) VALUES (
      @id, @executorId, @commandType, @payload, @status, @resultMessage,
      @createdBy, @createdAt, @executedAt
    )`,
  );

  executors.forEach((executor) => {
    insertExecutor.run({
      id: executor.id,
      name: executor.name,
      deviceId: executor.deviceId,
      boundAccount: executor.boundAccount,
      deviceName: executor.deviceName,
      os: executor.os,
      status: executor.status,
      currentLiveTask: executor.currentLiveTask,
      obsStatus: executor.obsStatus,
      virtualCameraStatus: executor.virtualCameraStatus,
      version: executor.version,
      lastHeartbeatAt: executor.lastHeartbeatAt,
      notes: executor.notes,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });

  executorObsList.forEach((item, index) => {
    insertObsStatus.run({
      id: `OBS${String(index + 1).padStart(3, '0')}`,
      executorId: item.executorId,
      executorName: item.executorName,
      obsStatus: item.obsStatus,
      obsVersion: item.obsVersion,
      currentScene: item.currentScene,
      sourceCount: Number(item.sourceCount || 0),
      resolution: item.resolution,
      fps: Number(item.fps || 0),
      virtualCameraStatus: item.virtualCameraStatus,
      outputStatus: item.outputStatus,
      errorMessage: item.errorMessage,
      sceneSources: toJson(item.sceneSources || []),
      lastConnectedAt: item.lastConnectedAt,
      updatedAt: item.lastConnectedAt === '无' ? timestamp : item.lastConnectedAt,
    });
  });

  executorHeartbeats.forEach((item) => {
    insertHeartbeat.run({
      id: item.id,
      executorId: item.executorId,
      executorName: item.executorName,
      onlineStatus: item.onlineStatus,
      obsStatus: item.obsStatus,
      virtualCameraStatus: item.virtualCameraStatus,
      cpuUsage: Number(item.cpuUsage || 0),
      memoryUsage: Number(item.memoryUsage || 0),
      networkLatency: Number(item.networkLatency || 0),
      errorMessage: item.errorMessage,
      level: item.level,
      createdAt: item.time || timestamp,
    });
  });

  executorCommandMocks.forEach((item) => {
    insertCommand.run({
      id: item.id,
      executorId: item.executorId,
      commandType: item.commandType,
      payload: toJson(item.payload),
      status: item.status,
      resultMessage: item.resultMessage,
      createdBy: item.createdBy,
      createdAt: item.createdAt,
      executedAt: item.executedAt,
    });
  });
}

function seedHelp() {
  const insertFaq = db.prepare(
    `INSERT INTO help_faq (
      id, title, category, causes_json, steps_json, related_page,
      need_support, created_at, updated_at
    ) VALUES (
      @id, @title, @category, @causes, @steps, @relatedPage,
      @needSupport, @createdAt, @updatedAt
    )`,
  );

  const insertTroubleshooting = db.prepare(
    `INSERT INTO troubleshooting_guides (
      id, title, category, description, steps_json, created_at, updated_at
    ) VALUES (
      @id, @title, @category, @description, @steps, @createdAt, @updatedAt
    )`,
  );

  const insertTicket = db.prepare(
    `INSERT INTO tickets (
      id, title, type, urgency, related_live_room, related_avatar, related_product,
      related_executor, status, submitter, submitted_at, description, diagnosis,
      error_log, technical_reply, resolution_record, contact, created_at, updated_at
    ) VALUES (
      @id, @title, @type, @urgency, @relatedLiveRoom, @relatedAvatar, @relatedProduct,
      @relatedExecutor, @status, @submitter, @submittedAt, @description, @diagnosis,
      @errorLog, @technicalReply, @resolutionRecord, @contact, @createdAt, @updatedAt
    )`,
  );

  const insertTutorial = db.prepare(
    `INSERT INTO tutorials (
      id, title, category, difficulty, duration, summary_json, target_page, created_at, updated_at
    ) VALUES (
      @id, @title, @category, @difficulty, @duration, @summary, @targetPage, @createdAt, @updatedAt
    )`,
  );

  const insertStatus = db.prepare(
    `INSERT INTO system_status (
      id, name, status, checked_at, abnormal_count, detail, created_at, updated_at
    ) VALUES (
      @id, @name, @status, @checkedAt, @abnormalCount, @detail, @createdAt, @updatedAt
    )`,
  );

  const insertChangelog = db.prepare(
    `INSERT INTO changelog (
      id, version, title, updated_at, features_json, fixes_json, notes_json, important, created_at
    ) VALUES (
      @id, @version, @title, @updatedAt, @features, @fixes, @notes, @important, @createdAt
    )`,
  );

  helpFaqList.forEach((item) => {
    insertFaq.run({
      id: item.id,
      title: item.title,
      category: item.category,
      causes: toJson(item.causes || []),
      steps: toJson(item.steps || []),
      relatedPage: item.relatedPage,
      needSupport: item.needSupport ? 1 : 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });

  troubleshootingList.forEach((item) => {
    insertTroubleshooting.run({
      id: item.id,
      title: item.title,
      category: item.category,
      description: item.description,
      steps: toJson(item.steps || []),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });

  tickets.forEach((ticket) => {
    insertTicket.run({
      id: ticket.id,
      title: ticket.title,
      type: ticket.type,
      urgency: ticket.urgency,
      relatedLiveRoom: ticket.liveRoom,
      relatedAvatar: ticket.avatar,
      relatedProduct: ticket.product || '',
      relatedExecutor: ticket.executor,
      status: ticket.status,
      submitter: ticket.submitter,
      submittedAt: ticket.submittedAt,
      description: ticket.description,
      diagnosis: ticket.diagnosis,
      errorLog: ticket.errorLog,
      technicalReply: ticket.reply,
      resolutionRecord: ticket.resolution,
      contact: '',
      createdAt: ticket.submittedAt || timestamp,
      updatedAt: timestamp,
    });
  });

  tutorials.forEach((item) => {
    insertTutorial.run({
      id: item.id,
      title: item.title,
      category: item.category,
      difficulty: item.difficulty,
      duration: item.duration,
      summary: toJson(item.summary || []),
      targetPage: item.targetPage,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });

  systemStatusList.forEach((item) => {
    insertStatus.run({
      id: item.id,
      name: item.name,
      status: item.status,
      checkedAt: item.checkedAt,
      abnormalCount: Number(item.abnormalCount || 0),
      detail: item.description,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });

  changelog.forEach((item) => {
    insertChangelog.run({
      id: item.id,
      version: item.version,
      title: item.title,
      updatedAt: item.updatedAt,
      features: toJson(item.features || []),
      fixes: toJson(item.fixes || []),
      notes: toJson(item.notes || []),
      important: item.important ? 1 : 0,
      createdAt: item.updatedAt || timestamp,
    });
  });
}

const seed = db.transaction(() => {
  clearTables();
  seedProducts();
  seedAvatars();
  seedLive();
  seedStudio();
  seedInteraction();
  seedDelayControl();
  seedAiCenter();
  seedSettings();
  seedExecutors();
  seedHelp();
});

seed();

console.log('SQLite seed completed.');
console.log(`Products: ${products.length}, Avatars: ${avatars.length}, Live rooms: ${liveRooms.length}, Live tasks: ${liveTasks.length}`);
console.log(`Studio backgrounds: ${studioBackgrounds.length}, Studio layouts: ${studioLayouts.length}, Studio output status: 1`);
console.log(`Interaction comments: ${comments.length}, Questions: ${questions.length}, Manual takeover states: 1`);
console.log(`Delay control states: 1, Speech queue: ${speechQueue.length}, Subtitle settings: 1, Delay settings: 1`);
console.log(`AI models: ${modelProviders.length}, Prompt templates: ${promptTemplates.length}, AI call logs: ${aiCallLogs.length}, AI cost records: 1`);
console.log(`Help FAQ: ${helpFaqList.length}, Tickets: ${tickets.length}, Tutorials: ${tutorials.length}`);
console.log(`Executors: ${executors.length}, Executor OBS: ${executorObsList.length}, Heartbeats: ${executorHeartbeats.length}`);
