import express from 'express';
import { db, nextId, now, toJson } from '../db/database.js';
import { fail, page, success } from '../utils/response.js';

const router = express.Router();

function getPagination(req) {
  const pageNumber = Math.max(Number.parseInt(req.query.page || '1', 10), 1);
  const pageSize = Math.min(Math.max(Number.parseInt(req.query.pageSize || '20', 10), 1), 100);
  return {
    pageNumber,
    pageSize,
    offset: (pageNumber - 1) * pageSize,
  };
}

function toBoolean(value) {
  return Boolean(Number(value || 0));
}

function boolToInt(value) {
  return value ? 1 : 0;
}

function mapLiveRoom(row) {
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
    danmuEnabled: toBoolean(row.danmu_enabled),
    aiReplyEnabled: toBoolean(row.ai_reply_enabled),
    manualTakeoverEnabled: toBoolean(row.manual_takeover_enabled),
    delayControlEnabled: toBoolean(row.delay_control_enabled),
    delaySeconds: Number(row.delay_seconds || 0),
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLiveTask(row) {
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

function normalizeLiveRoomBody(body, existing = {}) {
  return {
    name: body.name ?? existing.name,
    theme: body.theme ?? existing.theme ?? '',
    platform: body.platform ?? existing.platform ?? '',
    platformAccount: body.platformAccount ?? body.platform_account ?? existing.platform_account ?? '',
    avatarId: body.avatarId ?? body.avatar_id ?? existing.avatar_id ?? '',
    avatarName: body.avatarName ?? body.avatar_name ?? existing.avatar_name ?? '',
    productGroupId: body.productGroupId ?? body.product_group_id ?? existing.product_group_id ?? '',
    productGroupName: body.productGroupName ?? body.product_group_name ?? existing.product_group_name ?? '',
    sceneName: body.sceneName ?? body.scene_name ?? existing.scene_name ?? '',
    layoutType: body.layoutType ?? body.layout_type ?? existing.layout_type ?? '',
    danmuEnabled: boolToInt(body.danmuEnabled ?? existing.danmu_enabled ?? false),
    aiReplyEnabled: boolToInt(body.aiReplyEnabled ?? existing.ai_reply_enabled ?? false),
    manualTakeoverEnabled: boolToInt(body.manualTakeoverEnabled ?? existing.manual_takeover_enabled ?? false),
    delayControlEnabled: boolToInt(body.delayControlEnabled ?? existing.delay_control_enabled ?? false),
    delaySeconds: Number(body.delaySeconds ?? body.delay_seconds ?? existing.delay_seconds ?? 0),
    status: body.status ?? existing.status ?? '草稿',
    notes: body.notes ?? existing.notes ?? '',
  };
}

function pickLocalExecutor() {
  return db
    .prepare(
      `SELECT * FROM executors
       WHERE status IN ('直播中', '在线', '更新中')
       ORDER BY
         CASE status
           WHEN '直播中' THEN 0
           WHEN '在线' THEN 1
           WHEN '更新中' THEN 2
           ELSE 3
         END,
         id ASC
       LIMIT 1`,
    )
    .get();
}

function getReusableTaskForRoom(roomId) {
  return db
    .prepare(
      `SELECT * FROM live_tasks
       WHERE live_room_id = ?
       ORDER BY
         CASE status WHEN '直播中' THEN 0 WHEN '待开始' THEN 1 WHEN '草稿' THEN 2 ELSE 3 END,
         updated_at DESC,
         id DESC
       LIMIT 1`,
    )
    .get(roomId);
}

function createOrUpdateCurrentLiveTask(room, executor, timestamp) {
  const existingTask = getReusableTaskForRoom(room.id);
  const taskName = existingTask?.task_name || `${room.name} 本机直播`;
  const taskId = existingTask?.id || nextId('live_tasks', 'LT');
  const payload = {
    id: taskId,
    taskName,
    liveRoomId: room.id,
    liveRoomName: room.name,
    platform: room.platform || '',
    executorId: executor?.id || '',
    executorName: executor?.name || '',
    avatarId: room.avatar_id || '',
    avatarName: room.avatar_name || '',
    productGroupId: room.product_group_id || '',
    productGroupName: room.product_group_name || '',
    scheduledStartTime: timestamp,
    status: '直播中',
    notes: `由直播间「${room.name}」启用后自动生成/复用的本机当前直播任务。`,
    createdAt: existingTask?.created_at || timestamp,
    updatedAt: timestamp,
  };

  if (existingTask) {
    db.prepare(
      `UPDATE live_tasks SET
        task_name = @taskName,
        live_room_id = @liveRoomId,
        live_room_name = @liveRoomName,
        platform = @platform,
        executor_id = @executorId,
        executor_name = @executorName,
        avatar_id = @avatarId,
        avatar_name = @avatarName,
        product_group_id = @productGroupId,
        product_group_name = @productGroupName,
        scheduled_start_time = @scheduledStartTime,
        status = @status,
        notes = @notes,
        updated_at = @updatedAt
       WHERE id = @id`,
    ).run(payload);
  } else {
    db.prepare(
      `INSERT INTO live_tasks (
        id, task_name, live_room_id, live_room_name, platform, executor_id, executor_name,
        avatar_id, avatar_name, product_group_id, product_group_name, scheduled_start_time,
        status, notes, created_at, updated_at
      ) VALUES (
        @id, @taskName, @liveRoomId, @liveRoomName, @platform, @executorId, @executorName,
        @avatarId, @avatarName, @productGroupId, @productGroupName, @scheduledStartTime,
        @status, @notes, @createdAt, @updatedAt
      )`,
    ).run(payload);
  }

  return db.prepare('SELECT * FROM live_tasks WHERE id = ?').get(taskId);
}

function writeCurrentControlRoomState(room, task, timestamp) {
  const currentSpeech = {
    text: '本场直播已准备就绪，等待下发第一条播报。',
    riskLevel: '低',
    source: 'live_room_activation',
  };
  const nextSpeech = {
    text: `欢迎来到${room.name}，今天先为大家介绍${room.product_group_name || '本场主推商品'}。`,
    riskLevel: '低',
    source: 'live_room_activation',
  };
  const recommendedReplies = [
    '这款今天直播间有福利，建议先领券再看规格，合适的话再下单。',
    '关于发货时间，以订单页面提示为准，我们会按平台规则安排。',
    '如果对价格有疑问，可以对比规格、产地和配送方式一起看。',
  ];

  db.prepare(
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
  ).run({
    id: nextId('delay_control_state', 'DCS'),
    liveTaskId: task.id,
    liveRoomId: room.id,
    currentAvatarId: room.avatar_id || '',
    currentAvatarName: room.avatar_name || '',
    currentProductGroupId: room.product_group_id || '',
    currentProductGroupName: room.product_group_name || '',
    delayMode: room.delay_control_enabled ? `${Number(room.delay_seconds || 0)}秒延迟` : '实时下发',
    executorStatus: task.executor_id ? '在线' : '未绑定',
    currentSpeech: toJson(currentSpeech),
    nextSpeech: toJson(nextSpeech),
    upcomingSpeech: toJson([nextSpeech]),
    riskSummary: toJson({ high: 0, medium: 0, pending: 0 }),
    updatedAt: timestamp,
  });

  db.prepare(
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
  ).run({
    id: nextId('manual_takeover_state', 'MTS'),
    liveTaskId: task.id,
    liveRoomId: room.id,
    currentAvatarId: room.avatar_id || '',
    currentAvatarName: room.avatar_name || '',
    currentProductGroupId: room.product_group_id || '',
    currentProductGroupName: room.product_group_name || '',
    speechStatus: '待下发',
    executorStatus: task.executor_id ? '在线' : '未绑定',
    currentSpeech: currentSpeech.text,
    nextSpeech: nextSpeech.text,
    upcomingSpeech: toJson([nextSpeech.text]),
    recommendedReplies: toJson(recommendedReplies),
    riskWarnings: toJson([]),
    updatedAt: timestamp,
  });

  db.prepare(
    `INSERT INTO subtitle_settings (
      id, live_task_id, current_subtitle, next_subtitle,
      upcoming_subtitles_json, subtitle_style_json, updated_at
    ) VALUES (
      @id, @liveTaskId, @currentSubtitle, @nextSubtitle,
      @upcomingSubtitles, @subtitleStyle, @updatedAt
    )`,
  ).run({
    id: nextId('subtitle_settings', 'SUBSET'),
    liveTaskId: task.id,
    currentSubtitle: toJson({ text: currentSpeech.text, position: 'bottom' }),
    nextSubtitle: toJson({ text: nextSpeech.text, position: 'bottom' }),
    upcomingSubtitles: toJson([{ text: nextSpeech.text, position: 'bottom' }]),
    subtitleStyle: toJson({
      position: 'bottom',
      fontSize: 28,
      color: '#ffffff',
      background: 'rgba(15, 23, 42, 0.72)',
    }),
    updatedAt: timestamp,
  });
}

function activateLiveRoomTransaction(room) {
  const timestamp = now();
  const executor = pickLocalExecutor();

  db.prepare(
    `UPDATE live_tasks
     SET status = '已结束',
         updated_at = @updatedAt
     WHERE status IN ('直播中', '已暂停')`,
  ).run({ updatedAt: timestamp });

  db.prepare(
    `UPDATE live_rooms
     SET status = CASE WHEN id = @roomId THEN '启用中' WHEN status = '启用中' THEN '配置中' ELSE status END,
         updated_at = @updatedAt`,
  ).run({ roomId: room.id, updatedAt: timestamp });

  const task = createOrUpdateCurrentLiveTask(room, executor, timestamp);

  if (executor?.id) {
    db.prepare(
      `UPDATE executors
       SET status = CASE WHEN id = @executorId THEN '直播中' WHEN status = '直播中' THEN '在线' ELSE status END,
           current_live_task = CASE WHEN id = @executorId THEN @taskName ELSE current_live_task END,
           updated_at = @updatedAt
       WHERE status IN ('直播中', '在线', '更新中')`,
    ).run({
      executorId: executor.id,
      taskName: task.task_name,
      updatedAt: timestamp,
    });
  }

  writeCurrentControlRoomState(room, task, timestamp);

  return {
    room: db.prepare('SELECT * FROM live_rooms WHERE id = ?').get(room.id),
    task,
    executor,
  };
}

router.get('/live-rooms', (req, res) => {
  const { pageNumber, pageSize, offset } = getPagination(req);
  const params = {
    limit: pageSize,
    offset,
  };
  const clauses = [];

  if (req.query.keyword) {
    params.keyword = `%${req.query.keyword}%`;
    clauses.push('(name LIKE @keyword OR theme LIKE @keyword OR platform_account LIKE @keyword)');
  }

  if (req.query.platform) {
    params.platform = req.query.platform;
    clauses.push('platform = @platform');
  }

  if (req.query.status) {
    params.status = req.query.status;
    clauses.push('status = @status');
  }

  if (req.query.avatarId) {
    params.avatarId = req.query.avatarId;
    clauses.push('avatar_id = @avatarId');
  }

  if (req.query.productGroupId) {
    params.productGroupId = req.query.productGroupId;
    clauses.push('product_group_id = @productGroupId');
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS count FROM live_rooms ${whereSql}`).get(params).count;
  const rows = db
    .prepare(`SELECT * FROM live_rooms ${whereSql} ORDER BY updated_at DESC LIMIT @limit OFFSET @offset`)
    .all(params);

  return page(res, rows.map(mapLiveRoom), total, pageNumber, pageSize);
});

router.get('/live-rooms/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM live_rooms WHERE id = ?').get(req.params.id);

  if (!row) {
    return fail(res, '直播间不存在', 40400, { id: req.params.id });
  }

  return success(res, { liveRoom: mapLiveRoom(row) });
});

router.post('/live-rooms', (req, res) => {
  const payload = normalizeLiveRoomBody(req.body || {});

  if (!payload.name || !String(payload.name).trim()) {
    return fail(res, '直播间名称不能为空', 40001, { field: 'name', reason: '名称不能为空' });
  }

  const timestamp = now();
  const id = req.body?.id || nextId('live_rooms', 'LR');

  db.prepare(
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
  ).run({
    ...payload,
    id,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const liveRoom = db.prepare('SELECT * FROM live_rooms WHERE id = ?').get(id);
  return success(res, { liveRoom: mapLiveRoom(liveRoom) }, 'created');
});

router.put('/live-rooms/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM live_rooms WHERE id = ?').get(req.params.id);

  if (!existing) {
    return fail(res, '直播间不存在', 40400, { id: req.params.id });
  }

  const payload = normalizeLiveRoomBody(req.body || {}, existing);

  if (!payload.name || !String(payload.name).trim()) {
    return fail(res, '直播间名称不能为空', 40001, { field: 'name', reason: '名称不能为空' });
  }

  db.prepare(
    `UPDATE live_rooms SET
      name = @name,
      theme = @theme,
      platform = @platform,
      platform_account = @platformAccount,
      avatar_id = @avatarId,
      avatar_name = @avatarName,
      product_group_id = @productGroupId,
      product_group_name = @productGroupName,
      scene_name = @sceneName,
      layout_type = @layoutType,
      danmu_enabled = @danmuEnabled,
      ai_reply_enabled = @aiReplyEnabled,
      manual_takeover_enabled = @manualTakeoverEnabled,
      delay_control_enabled = @delayControlEnabled,
      delay_seconds = @delaySeconds,
      status = @status,
      notes = @notes,
      updated_at = @updatedAt
    WHERE id = @id`,
  ).run({
    ...payload,
    id: req.params.id,
    updatedAt: now(),
  });

  const liveRoom = db.prepare('SELECT * FROM live_rooms WHERE id = ?').get(req.params.id);
  return success(res, { liveRoom: mapLiveRoom(liveRoom) });
});

router.post('/live-rooms/:id/activate', (req, res) => {
  const row = db.prepare('SELECT * FROM live_rooms WHERE id = ?').get(req.params.id);

  if (!row) {
    return fail(res, '直播间不存在', 40400, { id: req.params.id });
  }

  const activate = db.transaction(() => activateLiveRoomTransaction(row));
  const result = activate();

  return success(res, {
    liveRoom: mapLiveRoom(result.room),
    liveTask: mapLiveTask(result.task),
    executor: result.executor
      ? {
          id: result.executor.id,
          name: result.executor.name,
          status: result.executor.status,
        }
      : null,
    redirectUrl: '/live/control-room',
    message: result.executor
      ? `已启用「${result.room.name}」，并绑定本机执行端「${result.executor.name}」。`
      : `已启用「${result.room.name}」，但当前没有可用执行端。`,
    mock: false,
  });
});

router.get('/live-tasks', (req, res) => {
  const { pageNumber, pageSize, offset } = getPagination(req);
  const params = {
    limit: pageSize,
    offset,
  };
  const clauses = [];

  if (req.query.keyword) {
    params.keyword = `%${req.query.keyword}%`;
    clauses.push('(task_name LIKE @keyword OR live_room_name LIKE @keyword OR executor_name LIKE @keyword)');
  }

  if (req.query.status) {
    params.status = req.query.status;
    clauses.push('status = @status');
  }

  if (req.query.liveRoomId) {
    params.liveRoomId = req.query.liveRoomId;
    clauses.push('live_room_id = @liveRoomId');
  }

  if (req.query.executorName) {
    params.executorName = req.query.executorName;
    clauses.push('executor_name = @executorName');
  }

  if (req.query.startTime) {
    params.startTime = req.query.startTime;
    clauses.push('scheduled_start_time >= @startTime');
  }

  if (req.query.endTime) {
    params.endTime = req.query.endTime;
    clauses.push('scheduled_start_time <= @endTime');
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS count FROM live_tasks ${whereSql}`).get(params).count;
  const rows = db
    .prepare(`SELECT * FROM live_tasks ${whereSql} ORDER BY scheduled_start_time DESC LIMIT @limit OFFSET @offset`)
    .all(params);

  return page(res, rows.map(mapLiveTask), total, pageNumber, pageSize);
});

router.get('/live-tasks/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM live_tasks WHERE id = ?').get(req.params.id);

  if (!row) {
    return fail(res, '直播任务不存在', 40400, { id: req.params.id });
  }

  return success(res, { liveTask: mapLiveTask(row) });
});

router.post('/live-tasks', (req, res) => {
  const body = req.body || {};

  if (!body.taskName && !body.task_name) {
    return fail(res, '直播任务名称不能为空', 40001, { field: 'taskName', reason: '名称不能为空' });
  }

  const timestamp = now();
  const id = body.id || nextId('live_tasks', 'LT');

  db.prepare(
    `INSERT INTO live_tasks (
      id, task_name, live_room_id, live_room_name, platform, executor_id, executor_name,
      avatar_id, avatar_name, product_group_id, product_group_name, scheduled_start_time,
      status, notes, created_at, updated_at
    ) VALUES (
      @id, @taskName, @liveRoomId, @liveRoomName, @platform, @executorId, @executorName,
      @avatarId, @avatarName, @productGroupId, @productGroupName, @scheduledStartTime,
      @status, @notes, @createdAt, @updatedAt
    )`,
  ).run({
    id,
    taskName: body.taskName || body.task_name,
    liveRoomId: body.liveRoomId || body.live_room_id || '',
    liveRoomName: body.liveRoomName || body.live_room_name || '',
    platform: body.platform || '',
    executorId: body.executorId || body.executor_id || '',
    executorName: body.executorName || body.executor_name || '',
    avatarId: body.avatarId || body.avatar_id || '',
    avatarName: body.avatarName || body.avatar_name || '',
    productGroupId: body.productGroupId || body.product_group_id || '',
    productGroupName: body.productGroupName || body.product_group_name || '',
    scheduledStartTime: body.scheduledStartTime || body.scheduled_start_time || '',
    status: body.status || '草稿',
    notes: body.notes || '',
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const liveTask = db.prepare('SELECT * FROM live_tasks WHERE id = ?').get(id);
  return success(res, { liveTask: mapLiveTask(liveTask) }, 'created');
});

router.patch('/live-tasks/:id/status', (req, res) => {
  const { status } = req.body || {};

  if (!status) {
    return fail(res, '直播任务状态不能为空', 40001, { field: 'status', reason: '状态不能为空' });
  }

  const result = db
    .prepare('UPDATE live_tasks SET status = ?, updated_at = ? WHERE id = ?')
    .run(status, now(), req.params.id);

  if (result.changes === 0) {
    return fail(res, '直播任务不存在', 40400, { id: req.params.id });
  }

  const liveTask = db.prepare('SELECT * FROM live_tasks WHERE id = ?').get(req.params.id);
  return success(res, { liveTask: mapLiveTask(liveTask) });
});

export default router;
