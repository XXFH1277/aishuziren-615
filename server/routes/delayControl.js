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
import { PARAM_ERROR, NOT_FOUND } from '../utils/errorCodes.js';
import { PERMISSIONS } from '../utils/permissions.js';
import { fail, page, success } from '../utils/response.js';

const router = express.Router();
const approvedReviewStatuses = ['已通过', '已审核', '即将播出'];
const onlineExecutorStatuses = ['在线', '直播中', '更新中'];
const dispatchableBroadcastStatuses = ['', '待下发', '失败'];

function getPagination(req) {
  const pageNumber = Math.max(Number.parseInt(req.query.page || '1', 10), 1);
  const pageSize = Math.min(Math.max(Number.parseInt(req.query.pageSize || req.query.limit || '20', 10), 1), 100);
  return {
    pageNumber,
    pageSize,
    offset: (pageNumber - 1) * pageSize,
  };
}

function pushEqualFilter(clauses, params, query, queryKey, columnName) {
  if (query[queryKey]) {
    params[queryKey] = query[queryKey];
    clauses.push(`${columnName} = @${queryKey}`);
  }
}

function mapDelayControl(row) {
  if (!row) {
    return null;
  }

  const liveRoom = row.live_room_id ? db.prepare('SELECT name FROM live_rooms WHERE id = ?').get(row.live_room_id) : null;
  const liveTask = row.live_task_id ? db.prepare('SELECT task_name FROM live_tasks WHERE id = ?').get(row.live_task_id) : null;
  const currentSpeech = fromJson(row.current_speech_json, {});
  const nextSpeech = fromJson(row.next_speech_json, {});
  const upcomingSpeech = fromJson(row.upcoming_speech_json, []);
  const riskSummary = fromJson(row.risk_summary_json, {});

  return {
    id: row.id,
    liveTaskId: row.live_task_id,
    liveRoomId: row.live_room_id,
    currentLiveRoom: liveRoom?.name || row.live_room_id,
    currentLiveTask: liveTask?.task_name || row.live_task_id,
    currentAvatarId: row.current_avatar_id,
    currentAvatar: row.current_avatar_name,
    currentProductGroupId: row.current_product_group_id,
    currentProductGroup: row.current_product_group_name,
    delayMode: row.delay_mode,
    executorStatus: row.executor_status,
    currentSpeech,
    nextSpeech,
    upcomingSpeech,
    riskSummary,
    updatedAt: row.updated_at,
  };
}

function mapSpeechQueueItem(row, order = 0) {
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

function mapSpeechQueuePreview(row, title = '') {
  if (!row) {
    return null;
  }

  return {
    ...mapSpeechQueueItem(row),
    title,
  };
}

function mapSubtitles(row) {
  if (!row) {
    return null;
  }

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
  if (!row) {
    return null;
  }

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

function getSpeechItemOrFail(res, id) {
  const row = db.prepare('SELECT * FROM speech_queue WHERE id = ?').get(id);

  if (!row) {
    fail(res, 'Speech queue item not found', NOT_FOUND, { id });
    return null;
  }

  return row;
}

function isApprovedSpeechItem(row) {
  return approvedReviewStatuses.includes(row.review_status);
}

function isDispatchableSpeechItem(row) {
  return dispatchableBroadcastStatuses.includes(row.broadcast_status || '');
}

function runDispatchCompliance(speechItem) {
  const result = checkComplianceText(speechItem.text);
  const logId = recordComplianceCheck({
    sourcePage: '延迟播控台',
    scenario: 'speech_queue_dispatch',
    target: speechItem.id,
    inputSummary: `speechQueueId=${speechItem.id}; liveTaskId=${speechItem.live_task_id}; textLength=${String(speechItem.text || '').length}; 不记录完整待播话术。`,
    result,
  });

  return {
    result,
    logId,
    riskTips: buildComplianceRiskTips(result),
    blocked: isComplianceBlockingResult(result),
  };
}

function updateSpeechComplianceState(speechItem, compliance, blocked = false) {
  const timestamp = now();
  const riskLevel = compliance.result.riskLevel || speechItem.risk_level || '低';

  db.prepare(
    `UPDATE speech_queue
     SET risk_level = @riskLevel,
         review_status = CASE WHEN @blocked = 1 THEN @blockedReviewStatus ELSE review_status END,
         broadcast_status = CASE WHEN @blocked = 1 THEN @blockedBroadcastStatus ELSE broadcast_status END,
         broadcast_error_message = CASE WHEN @blocked = 1 THEN @blockedMessage ELSE broadcast_error_message END,
         updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id: speechItem.id,
    riskLevel,
    blocked: blocked ? 1 : 0,
    blockedReviewStatus: '高风险待人工',
    blockedBroadcastStatus: '未审核',
    blockedMessage: `合规复检拦截：${compliance.result.suggestion || '命中高风险规则'}`,
    updatedAt: timestamp,
  });

  return db.prepare('SELECT * FROM speech_queue WHERE id = ?').get(speechItem.id);
}

function getDispatchTargetOrFail(res, speechItem) {
  if (!isApprovedSpeechItem(speechItem)) {
    fail(res, '待播内容尚未审核通过，不能下发播报', PARAM_ERROR, {
      id: speechItem.id,
      reviewStatus: speechItem.review_status,
    });
    return null;
  }

  if (!isDispatchableSpeechItem(speechItem)) {
    fail(res, '待播内容当前状态不能重复下发', PARAM_ERROR, {
      id: speechItem.id,
      broadcastStatus: speechItem.broadcast_status,
    });
    return null;
  }

  const liveTask = db.prepare('SELECT * FROM live_tasks WHERE id = ?').get(speechItem.live_task_id);

  if (!liveTask) {
    fail(res, '待播内容关联的直播任务不存在', NOT_FOUND, {
      speechQueueId: speechItem.id,
      liveTaskId: speechItem.live_task_id,
    });
    return null;
  }

  if (!liveTask.executor_id) {
    fail(res, '直播任务未绑定执行端，无法下发播报', PARAM_ERROR, {
      speechQueueId: speechItem.id,
      liveTaskId: liveTask.id,
    });
    return null;
  }

  const executor = db.prepare('SELECT * FROM executors WHERE id = ?').get(liveTask.executor_id);

  if (!executor) {
    fail(res, '直播任务绑定的执行端不存在', NOT_FOUND, {
      speechQueueId: speechItem.id,
      liveTaskId: liveTask.id,
      executorId: liveTask.executor_id,
    });
    return null;
  }

  if (!onlineExecutorStatuses.includes(executor.status)) {
    fail(res, '执行端离线或异常，无法下发播报', PARAM_ERROR, {
      speechQueueId: speechItem.id,
      executorId: executor.id,
      executorStatus: executor.status,
    });
    return null;
  }

  return { liveTask, executor };
}

function createSpeakCommandForSpeechItem(speechItem, executor, liveTask, req) {
  const timestamp = now();
  const commandId = nextId('executor_commands', 'CMD');
  const timeoutAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const trace = {
    traceId: `TRACE-${commandId}`,
    eventId: `TRACE-${commandId}`,
    source: 'speech_queue_dispatch',
    requestedBy: req.authUser?.id || 'local-api',
    createdAt: timestamp,
  };
  const payload = {
    text: speechItem.text,
    tone: speechItem.tone || 'natural',
    source: speechItem.source || 'speech_queue',
    speechQueueId: speechItem.id,
    liveTaskId: liveTask.id,
    liveRoomId: speechItem.live_room_id || liveTask.live_room_id || '',
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
    resultMessage: '待播队列话术已下发，等待本地执行端播报回执。',
    ackPayload: null,
    createdBy: req.authUser?.id || 'local-api',
    createdAt: timestamp,
    executedAt: '',
    ackedAt: '',
    updatedAt: timestamp,
  });

  db.prepare(
    `UPDATE speech_queue
     SET broadcast_status = @broadcastStatus,
         executor_command_id = @commandId,
         broadcast_result_json = @broadcastResult,
         broadcast_error_message = @broadcastErrorMessage,
         broadcast_started_at = @broadcastStartedAt,
         broadcast_finished_at = @broadcastFinishedAt,
         updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id: speechItem.id,
    broadcastStatus: '下发中',
    commandId,
    broadcastResult: '',
    broadcastErrorMessage: '',
    broadcastStartedAt: '',
    broadcastFinishedAt: '',
    updatedAt: timestamp,
  });

  return commandId;
}

function dispatchSpeechItem(res, req, speechItem) {
  const compliance = runDispatchCompliance(speechItem);
  let checkedSpeechItem = updateSpeechComplianceState(speechItem, compliance, compliance.blocked);

  if (compliance.blocked) {
    return fail(res, '待播话术命中高风险合规规则，已阻止下发播报', PARAM_ERROR, {
      ...buildComplianceErrorDetail(compliance.result),
      speechQueueId: speechItem.id,
      speechItem: mapSpeechQueueItem(checkedSpeechItem),
    });
  }

  const target = getDispatchTargetOrFail(res, checkedSpeechItem);

  if (!target) {
    return null;
  }

  const commandId = createSpeakCommandForSpeechItem(checkedSpeechItem, target.executor, target.liveTask, req);
  const updated = db.prepare('SELECT * FROM speech_queue WHERE id = ?').get(checkedSpeechItem.id);

  return success(res, {
    speechItem: mapSpeechQueueItem(updated),
    commandId,
    riskTips: compliance.riskTips,
    complianceLogId: compliance.logId,
    executor: {
      id: target.executor.id,
      name: target.executor.name,
      status: target.executor.status,
    },
    liveTask: {
      id: target.liveTask.id,
      taskName: target.liveTask.task_name,
    },
    message: '待播话术已下发到绑定执行端，等待执行端回执。',
  });
}

router.get('/delay-control/current', (req, res) => {
  const clauses = [];
  const params = {};

  pushEqualFilter(clauses, params, req.query, 'liveTaskId', 'live_task_id');
  pushEqualFilter(clauses, params, req.query, 'liveRoomId', 'live_room_id');

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const row = db.prepare(`SELECT * FROM delay_control_state ${whereSql} ORDER BY updated_at DESC LIMIT 1`).get(params);
  const delayControl = mapDelayControl(row);
  const liveTaskId = delayControl?.liveTaskId || req.query.liveTaskId || '';
  const queueStatus = {
    current: null,
    next: null,
    broadcasted: [],
  };

  if (liveTaskId) {
    const currentQueueItem = db
      .prepare(
        `SELECT *
         FROM speech_queue
         WHERE live_task_id = @liveTaskId AND broadcast_status = @broadcastStatus
         ORDER BY updated_at DESC, id ASC
         LIMIT 1`,
      )
      .get({ liveTaskId, broadcastStatus: '下发中' });
    const nextQueueItem = db
      .prepare(
        `SELECT *
         FROM speech_queue
         WHERE live_task_id = @liveTaskId
           AND review_status IN (@approved, @reviewed, @soon)
           AND (broadcast_status IS NULL OR broadcast_status = '' OR broadcast_status = @pendingBroadcast)
         ORDER BY scheduled_time ASC, created_at ASC, id ASC
         LIMIT 1`,
      )
      .get({
        liveTaskId,
        approved: '已通过',
        reviewed: '已审核',
        soon: '即将播出',
        pendingBroadcast: '待下发',
      });
    const broadcastedQueueItems = db
      .prepare(
        `SELECT *
         FROM speech_queue
         WHERE live_task_id = @liveTaskId AND broadcast_status = @broadcastStatus
         ORDER BY broadcast_finished_at DESC, updated_at DESC, id ASC
         LIMIT 3`,
      )
      .all({ liveTaskId, broadcastStatus: '已播报' });

    queueStatus.current = mapSpeechQueuePreview(currentQueueItem, '当前下发中');
    queueStatus.next = mapSpeechQueuePreview(nextQueueItem, '下一条待下发');
    queueStatus.broadcasted = broadcastedQueueItems.map((item, index) => mapSpeechQueuePreview(item, `已播报 ${index + 1}`));
  }

  if (delayControl) {
    delayControl.queueStatus = queueStatus;
    delayControl.currentSpeech = queueStatus.current || delayControl.currentSpeech;
    delayControl.nextSpeech = queueStatus.next || delayControl.nextSpeech;
  }

  return success(res, {
    delayControl,
    currentSpeech: queueStatus.current || delayControl?.currentSpeech || null,
    nextSpeech: queueStatus.next || delayControl?.nextSpeech || null,
    upcomingSpeech: delayControl?.upcomingSpeech || [],
    riskSummary: delayControl?.riskSummary || {},
    queueStatus,
  });
});

router.get('/delay-control/queue', (req, res) => {
  const { pageNumber, pageSize, offset } = getPagination(req);
  const params = {
    limit: pageSize,
    offset,
  };
  const clauses = [];

  pushEqualFilter(clauses, params, req.query, 'liveTaskId', 'live_task_id');
  pushEqualFilter(clauses, params, req.query, 'liveRoomId', 'live_room_id');
  pushEqualFilter(clauses, params, req.query, 'reviewStatus', 'review_status');
  pushEqualFilter(clauses, params, req.query, 'broadcastStatus', 'broadcast_status');
  pushEqualFilter(clauses, params, req.query, 'riskLevel', 'risk_level');
  pushEqualFilter(clauses, params, req.query, 'source', 'source');

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS count FROM speech_queue ${whereSql}`).get(params).count;
  const rows = db
    .prepare(`SELECT * FROM speech_queue ${whereSql} ORDER BY scheduled_time ASC, id ASC LIMIT @limit OFFSET @offset`)
    .all(params);

  return page(
    res,
    rows.map((row, index) => mapSpeechQueueItem(row, offset + index + 1)),
    total,
    pageNumber,
    pageSize,
  );
});

router.post('/delay-control/queue/dispatch-next', requirePermission(PERMISSIONS.SPEECH_WRITE), (req, res) => {
  const params = {
    approved: '已通过',
    reviewed: '已审核',
    soon: '即将播出',
    emptyStatus: '',
    pendingBroadcast: '待下发',
  };
  const clauses = [
    'review_status IN (@approved, @reviewed, @soon)',
    "(broadcast_status IS NULL OR broadcast_status = @emptyStatus OR broadcast_status = @pendingBroadcast)",
  ];

  if (req.body?.liveTaskId || req.query.liveTaskId) {
    params.liveTaskId = req.body?.liveTaskId || req.query.liveTaskId;
    clauses.push('live_task_id = @liveTaskId');
  }

  if (req.body?.liveRoomId || req.query.liveRoomId) {
    params.liveRoomId = req.body?.liveRoomId || req.query.liveRoomId;
    clauses.push('live_room_id = @liveRoomId');
  }

  const speechItem = db
    .prepare(
      `SELECT *
       FROM speech_queue
       WHERE ${clauses.join(' AND ')}
       ORDER BY scheduled_time ASC, created_at ASC, id ASC
       LIMIT 1`,
    )
    .get(params);

  if (!speechItem) {
    return fail(res, '暂无可下发的已审核待播话术', NOT_FOUND, {
      liveTaskId: params.liveTaskId || '',
      liveRoomId: params.liveRoomId || '',
    });
  }

  return dispatchSpeechItem(res, req, speechItem);
});

router.post('/delay-control/queue/:id/dispatch', requirePermission(PERMISSIONS.SPEECH_WRITE), (req, res) => {
  const existing = getSpeechItemOrFail(res, req.params.id);

  if (!existing) {
    return null;
  }

  return dispatchSpeechItem(res, req, existing);
});

router.patch('/delay-control/queue/:id', (req, res) => {
  const existing = getSpeechItemOrFail(res, req.params.id);

  if (!existing) {
    return null;
  }

  const body = req.body || {};
  db.prepare(
    `UPDATE speech_queue
     SET text = @text,
         action = @action,
         tone = @tone,
         risk_level = @riskLevel,
         review_status = @reviewStatus,
         broadcast_status = @broadcastStatus,
         broadcast_error_message = @broadcastErrorMessage,
         scheduled_time = @scheduledTime,
         updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id: req.params.id,
    text: body.text ?? existing.text,
    action: body.action ?? existing.action,
    tone: body.tone ?? existing.tone,
    riskLevel: body.riskLevel ?? existing.risk_level,
    reviewStatus: body.reviewStatus ?? existing.review_status,
    broadcastStatus: body.broadcastStatus ?? existing.broadcast_status,
    broadcastErrorMessage: body.broadcastErrorMessage ?? existing.broadcast_error_message,
    scheduledTime: body.scheduledTime ?? existing.scheduled_time,
    updatedAt: now(),
  });

  const row = db.prepare('SELECT * FROM speech_queue WHERE id = ?').get(req.params.id);
  return success(res, {
    speechItem: mapSpeechQueueItem(row),
    mock: true,
  });
});

router.post('/delay-control/queue/:id/approve', requirePermission(PERMISSIONS.SPEECH_REVIEW), (req, res) => {
  const existing = getSpeechItemOrFail(res, req.params.id);

  if (!existing) {
    return null;
  }

  const approvedAt = now();
  const approvedBy = req.body?.approvedBy || req.authUser?.id || 'mock-operator';

  db.prepare(
    `UPDATE speech_queue
     SET review_status = @reviewStatus,
         broadcast_status = @broadcastStatus,
         broadcast_error_message = '',
         approved_by = @approvedBy,
         approved_at = @approvedAt,
         updated_at = @approvedAt
     WHERE id = @id`,
  ).run({
    id: req.params.id,
    reviewStatus: '已通过',
    broadcastStatus: '待下发',
    approvedBy,
    approvedAt,
  });

  const row = db.prepare('SELECT * FROM speech_queue WHERE id = ?').get(req.params.id);

  return success(res, {
    id: req.params.id,
    speechItem: mapSpeechQueueItem(row),
    reviewStatus: row.review_status,
    broadcastStatus: row.broadcast_status,
    approvedBy,
    approvedAt,
  });
});

router.post('/delay-control/queue/:id/reject', requirePermission(PERMISSIONS.SPEECH_REVIEW), (req, res) => {
  const existing = getSpeechItemOrFail(res, req.params.id);

  if (!existing) {
    return null;
  }

  db.prepare('UPDATE speech_queue SET review_status = ?, broadcast_status = ?, updated_at = ? WHERE id = ?').run(
    '已驳回',
    '不播报',
    now(),
    req.params.id,
  );

  const row = db.prepare('SELECT * FROM speech_queue WHERE id = ?').get(req.params.id);

  return success(res, {
    id: req.params.id,
    speechItem: mapSpeechQueueItem(row),
    reviewStatus: row.review_status,
    broadcastStatus: row.broadcast_status,
    reason: req.body?.reason || '',
  });
});

router.post('/delay-control/queue/:id/insert', requirePermission(PERMISSIONS.SPEECH_WRITE), (req, res) => {
  const existing = getSpeechItemOrFail(res, req.params.id);

  if (!existing) {
    return null;
  }

  const timestamp = now();
  const nextReviewStatus = isApprovedSpeechItem(existing) ? existing.review_status : '已通过';
  const nextBroadcastStatus = existing.broadcast_status === '已播报' ? existing.broadcast_status : '待下发';

  db.prepare(
    `UPDATE speech_queue
     SET review_status = @reviewStatus,
         broadcast_status = @broadcastStatus,
         scheduled_time = @scheduledTime,
         approved_by = CASE WHEN approved_by IS NULL OR approved_by = '' THEN @approvedBy ELSE approved_by END,
         approved_at = CASE WHEN approved_at IS NULL OR approved_at = '' THEN @approvedAt ELSE approved_at END,
         updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id: req.params.id,
    reviewStatus: nextReviewStatus,
    broadcastStatus: nextBroadcastStatus,
    scheduledTime: req.body?.scheduledTime || '下一句',
    approvedBy: req.authUser?.id || 'mock-operator',
    approvedAt: timestamp,
    updatedAt: timestamp,
  });

  const row = db.prepare('SELECT * FROM speech_queue WHERE id = ?').get(req.params.id);

  return success(res, {
    id: req.params.id,
    speechItem: mapSpeechQueueItem(row),
    orderNo: Number(req.body?.position || 1),
    reviewStatus: row.review_status,
    broadcastStatus: row.broadcast_status,
    message: '待播内容已插队到下一句，等待下发播报。',
  });
});

router.post('/delay-control/queue/:id/approve-mock-legacy', (req, res) => {
  const existing = getSpeechItemOrFail(res, req.params.id);

  if (!existing) {
    return null;
  }

  const approvedAt = now();
  db.prepare(
    `UPDATE speech_queue
     SET review_status = @reviewStatus, approved_by = @approvedBy, approved_at = @approvedAt, updated_at = @approvedAt
     WHERE id = @id`,
  ).run({
    id: req.params.id,
    reviewStatus: '已通过',
    approvedBy: req.body?.approvedBy || 'mock-operator',
    approvedAt,
  });

  return success(res, {
    id: req.params.id,
    reviewStatus: '已通过',
    approvedBy: req.body?.approvedBy || 'mock-operator',
    approvedAt,
    mock: true,
  });
});

router.post('/delay-control/queue/:id/reject', (req, res) => {
  const existing = getSpeechItemOrFail(res, req.params.id);

  if (!existing) {
    return null;
  }

  db.prepare('UPDATE speech_queue SET review_status = ?, updated_at = ? WHERE id = ?').run('已驳回', now(), req.params.id);

  return success(res, {
    id: req.params.id,
    reviewStatus: '已驳回',
    reason: req.body?.reason || '',
    mock: true,
  });
});

router.post('/delay-control/queue/:id/insert', (req, res) => {
  const existing = getSpeechItemOrFail(res, req.params.id);

  if (!existing) {
    return null;
  }

  db.prepare('UPDATE speech_queue SET review_status = ?, scheduled_time = ?, updated_at = ? WHERE id = ?').run(
    '即将播出',
    req.body?.scheduledTime || '下一句',
    now(),
    req.params.id,
  );

  return success(res, {
    id: req.params.id,
    orderNo: Number(req.body?.position || 1),
    reviewStatus: '即将播出',
    mock: true,
    message: 'Mock insert only. No digital human, executor, OBS, or real broadcast service was called.',
  });
});

router.delete('/delay-control/queue/:id', (req, res) => {
  const existing = getSpeechItemOrFail(res, req.params.id);

  if (!existing) {
    return null;
  }

  db.prepare('DELETE FROM speech_queue WHERE id = ?').run(req.params.id);

  return success(res, {
    id: req.params.id,
    mock: true,
  });
});

router.get('/delay-control/subtitles', (req, res) => {
  const clauses = [];
  const params = {};

  pushEqualFilter(clauses, params, req.query, 'liveTaskId', 'live_task_id');

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const row = db.prepare(`SELECT * FROM subtitle_settings ${whereSql} ORDER BY updated_at DESC LIMIT 1`).get(params);
  const subtitles = mapSubtitles(row);

  return success(res, {
    subtitles,
    currentSubtitle: subtitles?.currentSubtitle || null,
    nextSubtitle: subtitles?.nextSubtitle || null,
    upcomingSubtitles: subtitles?.upcomingSubtitles || [],
    subtitleStyle: subtitles?.subtitleStyle || {},
  });
});

router.put('/delay-control/subtitles/settings', (req, res) => {
  const existing = db.prepare('SELECT * FROM subtitle_settings ORDER BY updated_at DESC LIMIT 1').get();

  if (!existing) {
    return fail(res, 'Subtitle settings not found', 40400);
  }

  const body = req.body || {};
  const current = mapSubtitles(existing);
  const subtitleStyle = {
    ...current.subtitleStyle,
    ...(body.subtitleStyle || body.style || {}),
  };

  ['fontSize', 'position', 'backgroundOpacity', 'showSpeakerName', 'showRiskHint'].forEach((key) => {
    if (body[key] !== undefined) {
      subtitleStyle[key] = body[key];
    }
  });

  db.prepare(
    `UPDATE subtitle_settings
     SET current_subtitle = @currentSubtitle,
         next_subtitle = @nextSubtitle,
         upcoming_subtitles_json = @upcomingSubtitles,
         subtitle_style_json = @subtitleStyle,
         updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id: existing.id,
    currentSubtitle: JSON.stringify(body.currentSubtitle || current.currentSubtitle),
    nextSubtitle: JSON.stringify(body.nextSubtitle || current.nextSubtitle),
    upcomingSubtitles: JSON.stringify(body.upcomingSubtitles || current.upcomingSubtitles),
    subtitleStyle: JSON.stringify(subtitleStyle),
    updatedAt: now(),
  });

  const row = db.prepare('SELECT * FROM subtitle_settings WHERE id = ?').get(existing.id);
  return success(res, {
    subtitles: mapSubtitles(row),
    subtitleStyle,
    mock: true,
  });
});

router.get('/delay-control/settings', (req, res) => {
  const row = db.prepare('SELECT * FROM delay_settings ORDER BY updated_at DESC LIMIT 1').get();
  const settings = mapDelaySettings(row);

  return success(res, {
    settings,
    delayMode: settings?.delayMode,
    delaySeconds: settings?.delaySeconds,
    reviewRules: settings?.reviewRules || {},
    queueRules: settings?.queueRules || {},
    riskRules: settings?.riskRules || [],
  });
});

router.put('/delay-control/settings', (req, res) => {
  const existing = db.prepare('SELECT * FROM delay_settings ORDER BY updated_at DESC LIMIT 1').get();

  if (!existing) {
    return fail(res, 'Delay settings not found', 40400);
  }

  const current = mapDelaySettings(existing);
  const body = req.body || {};
  const nextSettings = {
    delayMode: body.delayMode ?? current.delayMode,
    delaySeconds: Number(body.delaySeconds ?? current.delaySeconds ?? 0),
    reviewRules: {
      ...current.reviewRules,
      ...(body.reviewRules || {}),
    },
    queueRules: {
      ...current.queueRules,
      ...(body.queueRules || {}),
    },
    riskRules: body.riskRules || current.riskRules,
  };

  db.prepare(
    `UPDATE delay_settings
     SET delay_mode = @delayMode,
         delay_seconds = @delaySeconds,
         review_rules_json = @reviewRules,
         queue_rules_json = @queueRules,
         risk_rules_json = @riskRules,
         updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id: existing.id,
    delayMode: nextSettings.delayMode,
    delaySeconds: nextSettings.delaySeconds,
    reviewRules: JSON.stringify(nextSettings.reviewRules),
    queueRules: JSON.stringify(nextSettings.queueRules),
    riskRules: JSON.stringify(nextSettings.riskRules),
    updatedAt: now(),
  });

  const row = db.prepare('SELECT * FROM delay_settings WHERE id = ?').get(existing.id);
  return success(res, {
    settings: mapDelaySettings(row),
    mock: true,
  });
});

export default router;
