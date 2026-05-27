import express from 'express';
import { db, fromJson, now } from '../db/database.js';
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
    scheduledTime: row.scheduled_time,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
    fail(res, 'Speech queue item not found', 40400, { id });
    return null;
  }

  return row;
}

router.get('/delay-control/current', (req, res) => {
  const clauses = [];
  const params = {};

  pushEqualFilter(clauses, params, req.query, 'liveTaskId', 'live_task_id');
  pushEqualFilter(clauses, params, req.query, 'liveRoomId', 'live_room_id');

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const row = db.prepare(`SELECT * FROM delay_control_state ${whereSql} ORDER BY updated_at DESC LIMIT 1`).get(params);
  const delayControl = mapDelayControl(row);

  return success(res, {
    delayControl,
    currentSpeech: delayControl?.currentSpeech || null,
    nextSpeech: delayControl?.nextSpeech || null,
    upcomingSpeech: delayControl?.upcomingSpeech || [],
    riskSummary: delayControl?.riskSummary || {},
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
    scheduledTime: body.scheduledTime ?? existing.scheduled_time,
    updatedAt: now(),
  });

  const row = db.prepare('SELECT * FROM speech_queue WHERE id = ?').get(req.params.id);
  return success(res, {
    speechItem: mapSpeechQueueItem(row),
    mock: true,
  });
});

router.post('/delay-control/queue/:id/approve', (req, res) => {
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
