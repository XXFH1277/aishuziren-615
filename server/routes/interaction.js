import express from 'express';
import { db, fromJson, nextId, now } from '../db/database.js';
import { fail, page, success } from '../utils/response.js';

const router = express.Router();

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

  db.prepare('UPDATE questions SET status = ?, updated_at = ? WHERE id = ?').run('已加入待播', now(), req.params.id);

  const row = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
  return success(res, {
    question: mapQuestion(row),
    speechId: `MOCK-SQ-${req.params.id}`,
    mock: true,
    message: 'Mock add-to-queue only. Delay control service was not called.',
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
