import express from 'express';
import { db, fromJson, nextId, now, toJson } from '../db/database.js';
import { requirePermission } from '../utils/auth.js';
import {
  buildComplianceErrorDetail,
  buildComplianceRiskTips,
  checkComplianceText,
  isComplianceBlockingResult,
  recordComplianceCheck,
} from '../utils/compliance.js';
import { NOT_FOUND, PARAM_ERROR } from '../utils/errorCodes.js';
import { PERMISSIONS } from '../utils/permissions.js';
import { fail, success } from '../utils/response.js';

const router = express.Router();
const onlineExecutorStatuses = ['在线', '直播中', '更新中'];

function firstTask(taskId) {
  if (taskId) {
    return db.prepare('SELECT * FROM live_tasks WHERE id = ?').get(taskId);
  }

  return (
    db.prepare("SELECT * FROM live_tasks WHERE status = '直播中' ORDER BY updated_at DESC, id DESC LIMIT 1").get() ||
    db
      .prepare(
        `SELECT * FROM live_tasks
         WHERE id = (SELECT live_task_id FROM delay_control_state ORDER BY updated_at DESC LIMIT 1)
         LIMIT 1`,
      )
      .get() || db.prepare('SELECT * FROM live_tasks ORDER BY scheduled_start_time DESC, id ASC LIMIT 1').get()
  );
}

function mapTask(row) {
  if (!row) return null;

  return {
    id: row.id,
    taskName: row.task_name,
    liveRoomId: row.live_room_id,
    liveRoomName: row.live_room_name,
    platform: row.platform,
    executorId: row.executor_id,
    executorName: row.executor_name,
    avatarId: row.avatar_id,
    avatarName: row.avatar_name,
    productGroupId: row.product_group_id,
    productGroupName: row.product_group_name,
    scheduledStartTime: row.scheduled_start_time,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRoom(row) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    theme: row.theme,
    platform: row.platform,
    platformAccount: row.platform_account,
    avatarId: row.avatar_id,
    avatarName: row.avatar_name,
    productGroupId: row.product_group_id,
    productGroupName: row.product_group_name,
    sceneName: row.scene_name,
    layoutType: row.layout_type,
    status: row.status,
    notes: row.notes,
    updatedAt: row.updated_at,
  };
}

function mapOutput(row) {
  if (!row) return null;

  return {
    id: row.id,
    obsStatus: row.obs_status,
    virtualCameraStatus: row.virtual_camera_status,
    windowCaptureStatus: row.window_capture_status,
    obsVersion: row.obs_version,
    currentScene: row.current_scene,
    currentSource: row.current_source,
    resolution: row.resolution,
    fps: Number(row.fps || 0),
    lastHeartbeatAt: row.last_heartbeat_at,
    sceneMappings: fromJson(row.scene_mappings_json, []),
    checklist: fromJson(row.checklist_json, []),
    updatedAt: row.updated_at,
  };
}

function mapComment(row) {
  return {
    id: row.id,
    liveTaskId: row.live_task_id,
    liveRoomId: row.live_room_id,
    nickname: row.user_nickname,
    content: row.content,
    platform: row.platform,
    time: row.comment_time,
    type: row.recognized_type,
    riskLevel: row.risk_level,
    replyStatus: row.reply_status,
    handledStatus: row.handled_status,
    productId: row.product_id,
    productName: row.product_name,
    createdAt: row.created_at,
  };
}

function mapQuestion(row) {
  return {
    id: row.id,
    liveTaskId: row.live_task_id,
    liveRoomId: row.live_room_id,
    commentId: row.comment_id,
    question: row.question,
    nickname: row.nickname,
    type: row.type,
    productId: row.product_id,
    productName: row.product_name,
    relatedProduct: row.product_name,
    riskLevel: row.risk_level,
    aiReply: row.ai_reply,
    editedReply: row.edited_reply,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDelay(row) {
  if (!row) return null;

  return {
    id: row.id,
    liveTaskId: row.live_task_id,
    liveRoomId: row.live_room_id,
    currentAvatarId: row.current_avatar_id,
    currentAvatar: row.current_avatar_name,
    currentProductGroupId: row.current_product_group_id,
    currentProductGroup: row.current_product_group_name,
    delayMode: row.delay_mode,
    executorStatus: row.executor_status,
    currentSpeech: fromJson(row.current_speech_json, {}),
    nextSpeech: fromJson(row.next_speech_json, {}),
    upcomingSpeech: fromJson(row.upcoming_speech_json, []),
    riskSummary: fromJson(row.risk_summary_json, {}),
    updatedAt: row.updated_at,
  };
}

function mapSpeech(row, order = 0) {
  return {
    id: row.id,
    order,
    liveTaskId: row.live_task_id,
    liveRoomId: row.live_room_id,
    questionId: row.question_id,
    commentId: row.comment_id,
    productId: row.product_id,
    productName: row.product_name,
    relatedProduct: row.product_name,
    text: row.text,
    source: row.source,
    action: row.action,
    tone: row.tone,
    riskLevel: row.risk_level,
    reviewStatus: row.review_status,
    broadcastStatus: row.broadcast_status || '',
    executorCommandId: row.executor_command_id || '',
    broadcastResult: fromJson(row.broadcast_result_json, null),
    broadcastErrorMessage: row.broadcast_error_message || '',
    broadcastStartedAt: row.broadcast_started_at || '',
    broadcastFinishedAt: row.broadcast_finished_at || '',
    scheduledTime: row.scheduled_time,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSubtitles(row) {
  if (!row) return null;

  return {
    id: row.id,
    liveTaskId: row.live_task_id,
    currentSubtitle: fromJson(row.current_subtitle, {}),
    nextSubtitle: fromJson(row.next_subtitle, {}),
    upcomingSubtitles: fromJson(row.upcoming_subtitles_json, []),
    subtitleStyle: fromJson(row.subtitle_style_json, {}),
    updatedAt: row.updated_at,
  };
}

function mapDelaySettings(row) {
  if (!row) return null;

  return {
    id: row.id,
    delayMode: row.delay_mode,
    delaySeconds: row.delay_seconds,
    reviewRules: fromJson(row.review_rules_json, {}),
    queueRules: fromJson(row.queue_rules_json, {}),
    riskRules: fromJson(row.risk_rules_json, []),
    updatedAt: row.updated_at,
  };
}

function mapManualTakeover(row) {
  if (!row) return null;

  return {
    id: row.id,
    liveTaskId: row.live_task_id,
    liveRoomId: row.live_room_id,
    currentAvatarId: row.current_avatar_id,
    currentAvatar: row.current_avatar_name,
    currentProductGroupId: row.current_product_group_id,
    currentProductGroup: row.current_product_group_name,
    speechStatus: row.speech_status,
    executorStatus: row.executor_status,
    currentSpeech: row.current_speech,
    nextSpeech: row.next_speech,
    upcomingSpeech: fromJson(row.upcoming_speech_json, []),
    recommendedReplies: fromJson(row.recommended_replies_json, []),
    riskWarnings: fromJson(row.risk_warnings_json, []),
    updatedAt: row.updated_at,
  };
}

function resolveContext(req, res) {
  const taskId = req.query.taskId || req.body?.taskId;
  const task = firstTask(taskId);

  if (!task) {
    fail(res, 'Live task not found', NOT_FOUND, { taskId: taskId || '' });
    return null;
  }

  const room = db.prepare('SELECT * FROM live_rooms WHERE id = ?').get(task.live_room_id);
  return { task, room };
}

function countRows(sql, params = {}) {
  return db.prepare(sql).get(params).count;
}

function runManualSpeechCompliance(text, context, scenario) {
  const result = checkComplianceText(text);
  const logId = recordComplianceCheck({
    sourcePage: '直播中控台',
    scenario,
    target: context.task.id,
    inputSummary: `liveTaskId=${context.task.id}; textLength=${String(text || '').length}; 不记录完整人工接管话术。`,
    result,
  });

  return {
    result,
    logId,
    riskTips: buildComplianceRiskTips(result),
    blocked: isComplianceBlockingResult(result),
  };
}

function getTaskExecutorOrFail(res, task) {
  if (!task.executor_id) {
    fail(res, '直播任务未绑定执行端，无法立即播报', PARAM_ERROR, {
      liveTaskId: task.id,
    });
    return null;
  }

  const executor = db.prepare('SELECT * FROM executors WHERE id = ?').get(task.executor_id);

  if (!executor) {
    fail(res, '直播任务绑定的执行端不存在', NOT_FOUND, {
      liveTaskId: task.id,
      executorId: task.executor_id,
    });
    return null;
  }

  if (!onlineExecutorStatuses.includes(executor.status)) {
    fail(res, '执行端离线或异常，无法立即播报', PARAM_ERROR, {
      liveTaskId: task.id,
      executorId: executor.id,
      executorStatus: executor.status,
    });
    return null;
  }

  return executor;
}

function createManualSpeechQueueItem(req, context, body, options = {}) {
  const timestamp = now();
  const speechId = nextId('speech_queue', 'SQ');
  const reviewStatus = options.reviewStatus || '已通过';
  const broadcastStatus = options.broadcastStatus || '待下发';
  const isApproved = reviewStatus === '已通过' || reviewStatus === '已审核' || reviewStatus === '即将播出';

  db.prepare(
    `INSERT INTO speech_queue (
      id, live_task_id, live_room_id, question_id, comment_id, product_id, product_name,
      text, source, action, tone, risk_level, review_status, broadcast_status,
      executor_command_id, broadcast_result_json, broadcast_error_message,
      broadcast_started_at, broadcast_finished_at, scheduled_time,
      approved_by, approved_at, created_at, updated_at
    ) VALUES (
      @id, @liveTaskId, @liveRoomId, @questionId, @commentId, @productId, @productName,
      @text, @source, @action, @tone, @riskLevel, @reviewStatus, @broadcastStatus,
      @executorCommandId, @broadcastResult, @broadcastErrorMessage,
      @broadcastStartedAt, @broadcastFinishedAt, @scheduledTime,
      @approvedBy, @approvedAt, @createdAt, @updatedAt
    )`,
  ).run({
    id: speechId,
    liveTaskId: context.task.id,
    liveRoomId: context.task.live_room_id || context.room?.id || '',
    questionId: '',
    commentId: '',
    productId: body.productId || '',
    productName: body.productName || context.task.product_group_name || '',
    text: String(body.text || body.speechText || '').trim(),
    source: 'manual_takeover',
    action: String(body.action || '').trim() || '看评论区',
    tone: String(body.tone || '').trim() || '自然',
    riskLevel: options.riskLevel || body.riskLevel || '低',
    reviewStatus,
    broadcastStatus,
    executorCommandId: '',
    broadcastResult: '',
    broadcastErrorMessage: '',
    broadcastStartedAt: '',
    broadcastFinishedAt: '',
    scheduledTime: body.scheduledTime || '下一句',
    approvedBy: isApproved ? req.authUser?.id || 'manual-takeover' : '',
    approvedAt: isApproved ? timestamp : '',
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return db.prepare('SELECT * FROM speech_queue WHERE id = ?').get(speechId);
}

function createSpeakCommandForSpeechItem(req, speechItem, task, executor) {
  const timestamp = now();
  const commandId = nextId('executor_commands', 'CMD');
  const timeoutAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const trace = {
    traceId: `TRACE-${commandId}`,
    eventId: `TRACE-${commandId}`,
    source: 'manual_takeover_direct',
    requestedBy: req.authUser?.id || 'manual-takeover',
    createdAt: timestamp,
  };
  const payload = {
    text: speechItem.text,
    tone: speechItem.tone || '自然',
    source: 'manual_takeover_direct',
    speechQueueId: speechItem.id,
    liveTaskId: task.id,
    liveRoomId: speechItem.live_room_id || task.live_room_id || '',
    trace,
  };

  db.prepare(
    `INSERT INTO executor_commands (
      id, executor_id, command_type, payload_json, status, idempotency_key,
      timeout_at, retry_count, result_message, ack_payload_json,
      created_by, created_at, executed_at, acked_at, updated_at
    ) VALUES (
      @id, @executorId, @commandType, @payload, @status, @idempotencyKey,
      @timeoutAt, @retryCount, @resultMessage, @ackPayload,
      @createdBy, @createdAt, @executedAt, @ackedAt, @updatedAt
    )`,
  ).run({
    id: commandId,
    executorId: executor.id,
    commandType: 'speak',
    payload: toJson(payload),
    status: 'pending',
    idempotencyKey: `${executor.id}:${commandId}`,
    timeoutAt,
    retryCount: 0,
    resultMessage: '人工接管话术已直发为 speak 命令，等待本地执行端回执。',
    ackPayload: null,
    createdBy: req.authUser?.id || 'manual-takeover',
    createdAt: timestamp,
    executedAt: '',
    ackedAt: '',
    updatedAt: timestamp,
  });

  db.prepare(
    `UPDATE speech_queue
     SET broadcast_status = @broadcastStatus,
         executor_command_id = @commandId,
         broadcast_result_json = '',
         broadcast_error_message = '',
         broadcast_started_at = '',
         broadcast_finished_at = '',
         updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id: speechItem.id,
    broadcastStatus: '下发中',
    commandId,
    updatedAt: timestamp,
  });

  return {
    commandId,
    traceId: trace.traceId,
    timeoutAt,
    speechItem: db.prepare('SELECT * FROM speech_queue WHERE id = ?').get(speechItem.id),
  };
}

router.get('/live/control-room/overview', (req, res) => {
  const context = resolveContext(req, res);
  if (!context) return null;

  const { task, room } = context;
  const delayRow = db.prepare('SELECT * FROM delay_control_state WHERE live_task_id = ? ORDER BY updated_at DESC LIMIT 1').get(task.id);
  const outputRow = db.prepare('SELECT * FROM studio_output_status ORDER BY updated_at DESC LIMIT 1').get();
  const manualRow = db.prepare('SELECT * FROM manual_takeover_state WHERE live_task_id = ? ORDER BY updated_at DESC LIMIT 1').get(task.id);
  const commentTotal = countRows('SELECT COUNT(*) AS count FROM comments WHERE live_task_id = @taskId', { taskId: task.id });
  const questionTotal = countRows('SELECT COUNT(*) AS count FROM questions WHERE live_task_id = @taskId', { taskId: task.id });
  const speechReviewTotal = countRows('SELECT COUNT(*) AS count FROM speech_queue WHERE live_task_id = @taskId', { taskId: task.id });
  const highRiskComments = countRows(
    "SELECT COUNT(*) AS count FROM comments WHERE live_task_id = @taskId AND risk_level NOT IN ('低', '无')",
    { taskId: task.id },
  );

  const delayControl = mapDelay(delayRow);
  const outputStatus = mapOutput(outputRow);
  const manualTakeover = mapManualTakeover(manualRow);

  return success(res, {
    task: mapTask(task),
    room: mapRoom(room),
    outputStatus,
    delayControl,
    manualTakeover,
    statusBar: {
      currentLiveTask: task.task_name,
      currentLiveRoom: room?.name || task.live_room_name,
      platform: task.platform,
      currentAvatar: task.avatar_name,
      currentProductGroup: task.product_group_name,
      executorStatus: delayControl?.executorStatus || 'Mock在线',
      obsStatus: outputStatus?.obsStatus || 'Mock未连接',
      delayMode: delayControl?.delayMode || '',
      unhandledCommentCount: commentTotal,
      pendingQuestionCount: questionTotal,
      highRiskCommentCount: highRiskComments,
      pendingSpeechReviewCount: speechReviewTotal,
    },
    riskSummary: delayControl?.riskSummary || {},
    mock: true,
  });
});

router.get('/live/control-room/comments', (req, res) => {
  const context = resolveContext(req, res);
  if (!context) return null;

  const limit = Math.min(Math.max(Number.parseInt(req.query.limit || '20', 10), 1), 100);
  const rows = db
    .prepare('SELECT * FROM comments WHERE live_task_id = @taskId ORDER BY created_at DESC, id DESC LIMIT @limit')
    .all({ taskId: context.task.id, limit });
  const list = rows.map(mapComment);

  return success(res, {
    list,
    nextCursor: list.at(-1)?.id || '',
    unhandledCount: list.length,
    mock: true,
  });
});

router.get('/live/control-room/questions', (req, res) => {
  const context = resolveContext(req, res);
  if (!context) return null;

  const rows = db
    .prepare('SELECT * FROM questions WHERE live_task_id = @taskId ORDER BY created_at DESC, id DESC LIMIT 20')
    .all({ taskId: context.task.id });
  const list = rows.map(mapQuestion);

  return success(res, {
    list,
    pendingCount: list.length,
    mock: true,
  });
});

router.get('/live/control-room/broadcast', (req, res) => {
  const context = resolveContext(req, res);
  if (!context) return null;

  const delayRow = db.prepare('SELECT * FROM delay_control_state WHERE live_task_id = ? ORDER BY updated_at DESC LIMIT 1').get(context.task.id);
  const speechRows = db
    .prepare('SELECT * FROM speech_queue WHERE live_task_id = ? ORDER BY scheduled_time ASC, id ASC LIMIT 20')
    .all(context.task.id);
  const subtitleRow = db.prepare('SELECT * FROM subtitle_settings WHERE live_task_id = ? ORDER BY updated_at DESC LIMIT 1').get(context.task.id);
  const settingsRow = db.prepare('SELECT * FROM delay_settings ORDER BY updated_at DESC LIMIT 1').get();
  const delayControl = mapDelay(delayRow);
  const subtitles = mapSubtitles(subtitleRow);

  return success(res, {
    delayControl,
    currentSpeech: delayControl?.currentSpeech || null,
    nextSpeech: delayControl?.nextSpeech || null,
    upcomingSpeech: delayControl?.upcomingSpeech || [],
    speechQueue: speechRows.map((row, index) => mapSpeech(row, index + 1)),
    subtitles,
    delaySettings: mapDelaySettings(settingsRow),
    mock: true,
  });
});

router.post('/live/control-room/manual-speech', requirePermission(PERMISSIONS.LIVE_MANUAL_TAKEOVER), (req, res) => {
  const body = req.body || {};
  const text = body.text || body.speechText || '';

  if (!String(text).trim()) {
    return fail(res, 'Manual speech text is required', 40001, {
      field: 'text',
      reason: 'text cannot be empty',
    });
  }

  const deliveryMode = String(body.deliveryMode || body.mode || '').trim();

  if (deliveryMode === 'queue' || deliveryMode === 'enqueue') {
    const context = resolveContext(req, res);
    if (!context) return null;

    const compliance = runManualSpeechCompliance(text, context, 'manual_takeover_queue');
    const shouldForceReview = compliance.blocked;
    const row = createManualSpeechQueueItem(req, context, body, {
      reviewStatus: shouldForceReview ? '高风险待人工' : body.reviewStatus || '已通过',
      broadcastStatus: shouldForceReview ? '未审核' : '待下发',
      riskLevel: compliance.result.riskLevel,
    });

    return success(res, {
      status: 'queued',
      speechItem: mapSpeech(row),
      riskTips: compliance.riskTips,
      complianceLogId: compliance.logId,
      message: shouldForceReview
        ? '人工接管话术命中高风险规则，已加入待播队列并标记为高风险待人工审核。'
        : '人工接管话术已加入待播队列，后续可在播控区下发。',
      mock: false,
    });
  }

  if (deliveryMode === 'direct' || deliveryMode === 'direct_speak') {
    const context = resolveContext(req, res);
    if (!context) return null;

    const compliance = runManualSpeechCompliance(text, context, 'manual_takeover_direct');

    if (compliance.blocked) {
      return fail(res, '人工接管话术命中高风险合规规则，已阻止立即播报', PARAM_ERROR, buildComplianceErrorDetail(compliance.result));
    }

    const executor = getTaskExecutorOrFail(res, context.task);
    if (!executor) return null;

    const queued = createManualSpeechQueueItem(req, context, body, {
      reviewStatus: '已通过',
      broadcastStatus: '待下发',
      riskLevel: compliance.result.riskLevel,
    });
    const command = createSpeakCommandForSpeechItem(req, queued, context.task, executor);

    return success(res, {
      status: 'dispatched',
      speechItem: mapSpeech(command.speechItem),
      commandId: command.commandId,
      traceId: command.traceId,
      timeoutAt: command.timeoutAt,
      riskTips: compliance.riskTips,
      complianceLogId: compliance.logId,
      executor: {
        id: executor.id,
        name: executor.name,
        status: executor.status,
      },
      message: '人工接管话术已直发为 speak 命令，等待执行端 PrintAdapter 回执。',
      mock: false,
    });
  }

  return success(res, {
    speechId: `MOCK-LCR-${Date.now()}`,
    status: String(body.broadcastMode || '').includes('建议') ? 'suggested' : 'accepted',
    suggestion: String(body.broadcastMode || '').includes('建议')
      ? `Mock suggestion: ${text}. Please review compliance before broadcast.`
      : '',
    mock: true,
    message: 'Mock manual speech accepted by live control room. No digital human, TTS, executor, or OBS call was made.',
  });
});

router.patch('/live/control-room/speech-queue/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM speech_queue WHERE id = ?').get(req.params.id);

  if (!existing) {
    return fail(res, 'Speech queue item not found', 40400, { id: req.params.id });
  }

  const body = req.body || {};
  const operation = body.operation || 'update';
  const patch = {
    text: body.text ?? existing.text,
    action: body.action ?? existing.action,
    tone: body.tone ?? existing.tone,
    riskLevel: body.riskLevel ?? existing.risk_level,
    reviewStatus: body.reviewStatus ?? existing.review_status,
    scheduledTime: body.scheduledTime ?? existing.scheduled_time,
  };

  if (operation === 'approve') patch.reviewStatus = '已通过';
  if (operation === 'delete') patch.reviewStatus = '已删除';
  if (operation === 'insert') {
    patch.reviewStatus = '即将播出';
    patch.scheduledTime = body.scheduledTime || '下一句';
  }
  if (operation === 'markRisk') {
    patch.riskLevel = '高';
    patch.reviewStatus = '高风险待人工';
  }

  db.prepare(
    `UPDATE speech_queue
     SET text = @text,
         action = @action,
         tone = @tone,
         risk_level = @riskLevel,
         review_status = @reviewStatus,
         scheduled_time = @scheduledTime,
         updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id: req.params.id,
    ...patch,
    updatedAt: now(),
  });

  const row = db.prepare('SELECT * FROM speech_queue WHERE id = ?').get(req.params.id);
  const item = mapSpeech(row);
  return success(res, {
    id: item.id,
    speechItem: item,
    reviewStatus: item.reviewStatus,
    mock: true,
  });
});

export default router;
