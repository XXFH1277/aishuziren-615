import express from 'express';
import { db, fromJson, nextId, now } from '../db/database.js';
import {
  buildComplianceRiskTips,
  checkComplianceText,
  isComplianceBlockingResult,
  recordComplianceCheck,
} from '../utils/compliance.js';
import { fail, page, success } from '../utils/response.js';

const router = express.Router();

const riskRank = {
  低: 1,
  中: 2,
  高: 3,
};

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

function mapComment(row) {
  return {
    id: row.id,
    liveTaskId: row.live_task_id,
    liveRoomId: row.live_room_id,
    nickname: row.user_nickname,
    userNickname: row.user_nickname,
    content: row.content,
    platform: row.platform,
    time: row.comment_time,
    commentTime: row.comment_time,
    type: row.recognized_type,
    recognizedType: row.recognized_type,
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

function mapSpeechQueueItem(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
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
    scheduledTime: row.scheduled_time,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function pickHigherRisk(...levels) {
  return levels.filter(Boolean).reduce((highest, current) => {
    const highestRank = riskRank[highest] || 0;
    const currentRank = riskRank[current] || 0;
    return currentRank > highestRank ? current : highest;
  }, '低');
}

function buildQuestionReplyText(question, body = {}) {
  return String(
    body.text ||
      body.replyText ||
      body.editedReply ||
      body.aiReply ||
      question.edited_reply ||
      question.ai_reply ||
      `关于“${question.question}”，这款${question.product_name || '商品'}可以放心了解，具体以页面说明和客服确认信息为准。`,
  ).trim();
}

function createQuestionSpeechQueueItem(question, body = {}) {
  const existingQueued = db
    .prepare('SELECT * FROM speech_queue WHERE question_id = ? ORDER BY created_at DESC, id DESC LIMIT 1')
    .get(question.id);

  if (existingQueued) {
    return {
      speechItem: existingQueued,
      duplicate: true,
      compliance: null,
      complianceLogId: '',
      riskTips: [],
    };
  }

  const timestamp = now();
  const text = buildQuestionReplyText(question, body);
  const compliance = checkComplianceText(text);
  const complianceLogId = recordComplianceCheck({
    sourcePage: '直播中控台',
    scenario: 'question_reply_queue',
    target: question.id,
    inputSummary: `questionId=${question.id}; liveTaskId=${question.live_task_id}; textLength=${text.length}; 不记录完整待播话术。`,
    result: compliance,
  });
  const riskLevel = pickHigherRisk(question.risk_level, compliance.riskLevel);
  const shouldForceReview = isComplianceBlockingResult(compliance) || riskLevel === '高';
  const reviewStatus = shouldForceReview ? '高风险待人工' : '已通过';
  const broadcastStatus = shouldForceReview ? '未审核' : '待下发';
  const speechId = nextId('speech_queue', 'SQ');
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
    liveTaskId: question.live_task_id,
    liveRoomId: question.live_room_id,
    questionId: question.id,
    commentId: question.comment_id || '',
    productId: body.productId || question.product_id || '',
    productName: body.productName || question.product_name || '',
    text,
    source: body.source || 'question_reply',
    action: String(body.action || '').trim() || '回答问题',
    tone: String(body.tone || '').trim() || '专业',
    riskLevel,
    reviewStatus,
    broadcastStatus,
    executorCommandId: '',
    broadcastResult: '',
    broadcastErrorMessage: '',
    broadcastStartedAt: '',
    broadcastFinishedAt: '',
    scheduledTime: body.scheduledTime || '下一句',
    approvedBy: isApproved ? body.approvedBy || 'question-queue' : '',
    approvedAt: isApproved ? timestamp : '',
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return {
    speechItem: db.prepare('SELECT * FROM speech_queue WHERE id = ?').get(speechId),
    duplicate: false,
    compliance,
    complianceLogId,
    riskTips: buildComplianceRiskTips(compliance),
  };
}

function mapManualTakeover(row) {
  if (!row) {
    return null;
  }

  const liveRoom = row.live_room_id ? db.prepare('SELECT name FROM live_rooms WHERE id = ?').get(row.live_room_id) : null;
  const liveTask = row.live_task_id ? db.prepare('SELECT task_name FROM live_tasks WHERE id = ?').get(row.live_task_id) : null;

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

function getQuestionOrFail(res, id) {
  const row = db.prepare('SELECT * FROM questions WHERE id = ?').get(id);

  if (!row) {
    fail(res, 'Question not found', 40400, { id });
    return null;
  }

  return row;
}

router.get('/interaction/comments', (req, res) => {
  const { pageNumber, pageSize, offset } = getPagination(req);
  const params = {
    limit: pageSize,
    offset,
  };
  const clauses = [];

  pushEqualFilter(clauses, params, req.query, 'liveTaskId', 'live_task_id');
  pushEqualFilter(clauses, params, req.query, 'liveRoomId', 'live_room_id');
  pushEqualFilter(clauses, params, req.query, 'type', 'recognized_type');
  pushEqualFilter(clauses, params, req.query, 'riskLevel', 'risk_level');

  if (req.query.status) {
    params.status = req.query.status;
    clauses.push('(reply_status = @status OR handled_status = @status)');
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS count FROM comments ${whereSql}`).get(params).count;
  const rows = db
    .prepare(`SELECT * FROM comments ${whereSql} ORDER BY created_at DESC, id DESC LIMIT @limit OFFSET @offset`)
    .all(params);

  return page(res, rows.map(mapComment), total, pageNumber, pageSize);
});

router.post('/dev/interaction/comments/simulate', (req, res) => {
  const body = req.body || {};
  const timestamp = now();
  const id = nextId('comments', 'C');
  const comment = {
    id,
    liveTaskId: body.liveTaskId || 'LT001',
    liveRoomId: body.liveRoomId || 'LR001',
    userNickname: body.nickname || body.userNickname || `MockUser-${id}`,
    content: body.content || 'Mock comment from local dev API. No live platform connection.',
    platform: body.platform || 'Mock',
    commentTime: body.time || new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    recognizedType: body.type || body.recognizedType || 'Mock',
    riskLevel: body.riskLevel || '低',
    replyStatus: body.replyStatus || '待处理',
    handledStatus: body.handledStatus || body.replyStatus || '待处理',
    productId: body.productId || '',
    productName: body.productName || 'Mock商品',
    createdAt: timestamp,
  };

  db.prepare(
    `INSERT INTO comments (
      id, live_task_id, live_room_id, user_nickname, content, platform,
      comment_time, recognized_type, risk_level, reply_status, handled_status,
      product_id, product_name, created_at
    ) VALUES (
      @id, @liveTaskId, @liveRoomId, @userNickname, @content, @platform,
      @commentTime, @recognizedType, @riskLevel, @replyStatus, @handledStatus,
      @productId, @productName, @createdAt
    )`,
  ).run(comment);

  const row = db.prepare('SELECT * FROM comments WHERE id = ?').get(id);
  return success(res, {
    comment: mapComment(row),
    mock: true,
    message: 'Mock comment inserted into local SQLite. No WebSocket or live platform API was called.',
  });
});

router.get('/interaction/questions', (req, res) => {
  const { pageNumber, pageSize, offset } = getPagination(req);
  const params = {
    limit: pageSize,
    offset,
  };
  const clauses = [];

  pushEqualFilter(clauses, params, req.query, 'liveTaskId', 'live_task_id');
  pushEqualFilter(clauses, params, req.query, 'liveRoomId', 'live_room_id');
  pushEqualFilter(clauses, params, req.query, 'type', 'type');
  pushEqualFilter(clauses, params, req.query, 'riskLevel', 'risk_level');
  pushEqualFilter(clauses, params, req.query, 'status', 'status');

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS count FROM questions ${whereSql}`).get(params).count;
  const rows = db
    .prepare(`SELECT * FROM questions ${whereSql} ORDER BY created_at DESC, id DESC LIMIT @limit OFFSET @offset`)
    .all(params);

  return page(res, rows.map(mapQuestion), total, pageNumber, pageSize);
});

router.post('/interaction/questions/:id/reply', (req, res) => {
  const existing = getQuestionOrFail(res, req.params.id);

  if (!existing) {
    return null;
  }

  const body = req.body || {};
  const replyText =
    body.replyText ||
    body.aiReply ||
    `Mock reply for "${existing.question}". This does not call Kimi, Mimo, or any real AI service.`;
  const nextStatus = body.replyText ? '已编辑' : '已推荐';

  db.prepare(
    `UPDATE questions
     SET ai_reply = @replyText, edited_reply = @editedReply, status = @status, updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id: req.params.id,
    replyText,
    editedReply: body.replyText || existing.edited_reply || '',
    status: body.status || nextStatus,
    updatedAt: now(),
  });

  const row = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
  return success(res, {
    question: mapQuestion(row),
    aiReply: row.ai_reply,
    mock: true,
  });
});

router.post('/interaction/questions/:id/add-to-queue', (req, res) => {
  const existing = getQuestionOrFail(res, req.params.id);

  if (!existing) {
    return null;
  }

  const queued = createQuestionSpeechQueueItem(existing, req.body || {});
  const timestamp = now();
  const replyText = queued.speechItem?.text || buildQuestionReplyText(existing, req.body || {});

  db.prepare(
    `UPDATE questions
     SET status = @status,
         ai_reply = CASE WHEN ai_reply IS NULL OR ai_reply = '' THEN @replyText ELSE ai_reply END,
         updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id: req.params.id,
    status: '已加入待播',
    replyText,
    updatedAt: timestamp,
  });

  if (existing.comment_id) {
    db.prepare(
      `UPDATE comments
       SET reply_status = @status,
           handled_status = @status
       WHERE id = @commentId`,
    ).run({
      commentId: existing.comment_id,
      status: '已加入待播',
    });
  }

  const row = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
  return success(res, {
    question: mapQuestion(row),
    speechItem: mapSpeechQueueItem(queued.speechItem),
    speechId: queued.speechItem?.id || '',
    status: queued.duplicate ? 'exists' : 'queued',
    complianceLogId: queued.complianceLogId,
    riskTips: queued.riskTips,
    mock: false,
    message: queued.duplicate
      ? '该问题已在真实待播队列中，可在固定播控区继续下发。'
      : queued.speechItem?.broadcast_status === '未审核'
        ? '问题回复已加入真实待播队列，但命中高风险，需要人工审核后下发。'
        : '问题回复已加入真实待播队列，可在固定播控区下发。',
  });
});

router.post('/interaction/questions/:id/ignore', (req, res) => {
  const existing = getQuestionOrFail(res, req.params.id);

  if (!existing) {
    return null;
  }

  db.prepare('UPDATE questions SET status = ?, updated_at = ? WHERE id = ?').run('已忽略', now(), req.params.id);

  const row = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
  return success(res, {
    question: mapQuestion(row),
    mock: true,
  });
});

router.get('/interaction/manual-takeover', (req, res) => {
  const clauses = [];
  const params = {};

  pushEqualFilter(clauses, params, req.query, 'liveTaskId', 'live_task_id');
  pushEqualFilter(clauses, params, req.query, 'liveRoomId', 'live_room_id');

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const row = db.prepare(`SELECT * FROM manual_takeover_state ${whereSql} ORDER BY updated_at DESC LIMIT 1`).get(params);

  return success(res, {
    manualTakeover: mapManualTakeover(row),
  });
});

router.post('/interaction/manual-speech', (req, res) => {
  const body = req.body || {};
  const text = body.text || body.speechText || '';

  if (!String(text).trim()) {
    return fail(res, 'Manual speech text is required', 40001, {
      field: 'speechText',
      reason: 'speech text cannot be empty',
    });
  }

  const broadcastMode = body.broadcastMode || '';
  const suggestion = String(broadcastMode).includes('建议')
    ? `Mock suggestion: ${text}. Please review price, compliance, and platform wording before broadcast.`
    : '';

  return success(res, {
    speechId: `MOCK-MANUAL-${Date.now()}`,
    status: suggestion ? 'suggested' : 'accepted',
    suggestion,
    mock: true,
    message: 'Mock manual speech accepted. No digital human, TTS, executor, or delay-control service was called.',
  });
});

export default router;
