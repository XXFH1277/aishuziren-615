import crypto from 'node:crypto';
import express from 'express';
import { db, fromJson, nextId, now, toJson } from '../db/database.js';
import { requirePermission } from '../utils/auth.js';
import { createDeviceToken, hashDeviceToken, requireDeviceAuth, requireDeviceExecutor } from '../utils/deviceAuth.js';
import { BIND_CODE_INVALID, COMMAND_NOT_FOUND, FORBIDDEN, PARAM_ERROR } from '../utils/errorCodes.js';
import { PERMISSIONS } from '../utils/permissions.js';
import { fail, page, success } from '../utils/response.js';

const router = express.Router();
const onlineStatuses = ['在线', '直播中', '更新中'];
const commandTerminalStatuses = new Set(['done', 'succeeded', 'failed', 'timeout', 'expired', 'cancelled']);

function createTraceMeta(commandId, source, requestedBy, createdAt) {
  const traceId = `TRACE-${commandId}`;

  return {
    traceId,
    eventId: traceId,
    source,
    requestedBy,
    createdAt,
  };
}

function getPagination(req) {
  const pageNumber = Math.max(Number.parseInt(req.query.page || '1', 10), 1);
  const pageSize = Math.min(Math.max(Number.parseInt(req.query.pageSize || '20', 10), 1), 100);
  return {
    pageNumber,
    pageSize,
    offset: (pageNumber - 1) * pageSize,
  };
}

function hashBindCode(code) {
  return crypto.createHash('sha256').update(String(code || '').trim()).digest('hex');
}

function createBindCode() {
  return `BIND-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function isExpired(isoTime) {
  return !isoTime || new Date(isoTime).getTime() <= Date.now();
}

function normalizeNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function normalizeExecutorStatus(value) {
  const status = String(value || '').trim();
  const statusMap = {
    online: '在线',
    connected: '在线',
    live: '直播中',
    live_streaming: '直播中',
    streaming: '直播中',
    offline: '离线',
    disconnected: '离线',
    error: '异常',
    abnormal: '异常',
    failed: '异常',
    updating: '在线',
  };

  return statusMap[status] || status || '在线';
}

function normalizeObsStatus(value) {
  const status = String(value || '').trim();
  const statusMap = {
    connected: '已连接',
    enabled: '已连接',
    active: '已连接',
    disconnected: '未连接',
    disabled: '未连接',
    offline: '未连接',
    'not-connected': '未连接',
    'mock-not-connected': '未连接',
    unknown: '未连接',
    error: '连接异常',
    abnormal: '连接异常',
    failed: '连接异常',
  };

  return statusMap[status] || status || '未连接';
}

function normalizeVirtualCameraStatus(value) {
  return normalizeObsStatus(value);
}

function mapCommand(row) {
  const payload = fromJson(row.payload_json, {});
  const ackPayload = fromJson(row.ack_payload_json, null);
  const traceId = payload?.trace?.traceId || `TRACE-${row.id}`;

  return {
    id: row.id,
    commandId: row.id,
    executorId: row.executor_id,
    commandType: row.command_type,
    payload,
    status: row.status,
    isTerminal: commandTerminalStatuses.has(row.status),
    traceId,
    idempotencyKey: row.idempotency_key,
    timeoutAt: row.timeout_at,
    retryCount: Number(row.retry_count || 0),
    resultMessage: row.result_message,
    ackPayload,
    createdBy: row.created_by,
    createdAt: row.created_at,
    executedAt: row.executed_at,
    ackedAt: row.acked_at,
    updatedAt: row.updated_at,
  };
}

function mapExecutor(row) {
  const latestCommand = db
    .prepare('SELECT * FROM executor_commands WHERE executor_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(row.id);

  return {
    id: row.id,
    name: row.name,
    deviceId: row.device_id,
    boundAccount: row.bound_account,
    deviceName: row.device_name,
    os: row.os,
    status: row.status,
    currentLiveTask: row.current_live_task,
    obsStatus: row.obs_status,
    virtualCameraStatus: row.virtual_camera_status,
    version: row.version,
    lastHeartbeatAt: row.last_heartbeat_at,
    registeredAt: row.registered_at,
    notes: row.notes,
    latestCommand: latestCommand ? mapCommand(latestCommand) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapObsStatus(row) {
  const sceneSources = fromJson(row.scene_sources_json, []);

  return {
    id: row.id,
    executorId: row.executor_id,
    executorName: row.executor_name,
    obsStatus: row.obs_status,
    obsVersion: row.obs_version,
    currentScene: row.current_scene,
    sourceCount: Number(row.source_count || 0),
    resolution: row.resolution,
    fps: Number(row.fps || 0),
    virtualCameraStatus: row.virtual_camera_status,
    outputStatus: row.output_status,
    errorMessage: row.error_message,
    sceneSources,
    lastConnectedAt: row.last_connected_at,
    updatedAt: row.updated_at,
  };
}

function mapHeartbeat(row) {
  return {
    id: row.id,
    time: row.created_at,
    executorId: row.executor_id,
    executorName: row.executor_name,
    onlineStatus: row.online_status,
    obsStatus: row.obs_status,
    virtualCameraStatus: row.virtual_camera_status,
    cpuUsage: Number(row.cpu_usage || 0),
    memoryUsage: Number(row.memory_usage || 0),
    networkLatency: Number(row.network_latency || 0),
    version: row.version,
    reportedAt: row.reported_at,
    errorMessage: row.error_message,
    level: row.level,
    createdAt: row.created_at,
  };
}

function buildExecutorStats() {
  const rows = db.prepare('SELECT status, COUNT(*) AS count FROM executors GROUP BY status').all();
  const stats = {
    online: 0,
    offline: 0,
    abnormal: 0,
    live: 0,
  };

  rows.forEach((row) => {
    const count = Number(row.count || 0);

    if (onlineStatuses.includes(row.status)) {
      stats.online += count;
    }

    if (row.status === '离线') {
      stats.offline += count;
    }

    if (row.status === '异常') {
      stats.abnormal += count;
    }

    if (row.status === '直播中') {
      stats.live += count;
    }
  });

  return stats;
}

function buildObsChecklist(rows) {
  const mappedRows = rows.map(mapObsStatus);
  const allSources = mappedRows.flatMap((row) => row.sceneSources || []);
  const hasExistingSource = (name) => allSources.some((source) => source.name === name && source.status === '存在');

  return [
    { label: '执行端在线', checked: mappedRows.some((row) => row.obsStatus !== '未连接') },
    { label: 'OBS连接正常', checked: mappedRows.some((row) => row.obsStatus === '已连接') },
    { label: '虚拟摄像头可用', checked: mappedRows.some((row) => row.virtualCameraStatus === '已开启') },
    { label: '当前场景存在', checked: mappedRows.some((row) => row.currentScene && row.currentScene !== '无') },
    { label: '字幕源存在', checked: hasExistingSource('字幕文本源') },
    { label: '商品贴图源存在', checked: hasExistingSource('商品贴图源') },
    { label: '数字人视频源存在', checked: hasExistingSource('数字人视频源') },
  ];
}

function createCommand(res, executorId, commandType, payload, resultMessage) {
  const executor = db.prepare('SELECT * FROM executors WHERE id = ?').get(executorId);

  if (!executor) {
    return fail(res, '执行端不存在', 40400, { id: executorId });
  }

  const timestamp = now();
  const commandId = nextId('executor_commands', 'CMD');
  const timeoutAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const trace = createTraceMeta(commandId, 'executor-admin-command', 'local-api-mock', timestamp);
  const commandPayload = {
    ...(payload || {}),
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
    executorId,
    commandType,
    payload: toJson(commandPayload),
    status: 'pending',
    idempotencyKey: `${executorId}:${commandId}`,
    timeoutAt,
    retryCount: 0,
    resultMessage,
    ackPayload: null,
    createdBy: 'local-api-mock',
    createdAt: timestamp,
    executedAt: '',
    ackedAt: '',
    updatedAt: timestamp,
  });

  return success(res, {
    commandId,
    status: 'pending',
    traceId: trace.traceId,
    timeoutAt,
    message: resultMessage,
    executor: mapExecutor(executor),
  });
}

function flattenSceneSources(detail) {
  if (Array.isArray(detail?.sceneSources)) {
    return detail.sceneSources.map((source) => ({
      sceneName: source.sceneName || '',
      name: source.name || source.sourceName || '',
      type: source.type || source.sourceType || source.inputKind || '',
      status: source.status || (source.enabled === false ? '未连接' : '存在'),
      sceneItemId: source.sceneItemId,
      enabled: source.enabled !== false,
    }));
  }

  if (!Array.isArray(detail?.scenes)) {
    return [];
  }

  return detail.scenes.flatMap((scene) =>
    (scene.sources || []).map((source) => ({
      sceneName: scene.name || scene.sceneName || '',
      name: source.name || source.sourceName || '',
      type: source.type || source.sourceType || source.inputKind || '',
      status: source.status || (source.enabled === false ? '未连接' : '存在'),
      sceneItemId: source.sceneItemId,
      enabled: source.enabled !== false,
    })),
  );
}

function upsertExecutorObsStatusFromAck(command, executor, detail, commandStatus, resultMessage) {
  if (!['obs_test', 'refresh_obs_scenes'].includes(command.command_type)) {
    return;
  }

  const timestamp = now();
  const row = db.prepare('SELECT id FROM executor_obs_status WHERE executor_id = ?').get(executor.id);
  const id = row?.id || `OBS_${executor.id}`;
  const sceneSources = flattenSceneSources(detail || {});
  const obsStatus =
    commandStatus === 'succeeded'
      ? normalizeObsStatus(detail?.obsStatus || '已连接')
      : normalizeObsStatus(detail?.obsStatus || '连接异常');
  const errorMessage =
    commandStatus === 'succeeded' ? detail?.errorMessage || '无' : detail?.errorMessage || resultMessage || 'OBS命令执行失败';

  db.prepare(
    `INSERT INTO executor_obs_status (
      id, executor_id, executor_name, obs_status, obs_version, current_scene,
      source_count, resolution, fps, virtual_camera_status, output_status,
      error_message, scene_sources_json, last_connected_at, updated_at
    ) VALUES (
      @id, @executorId, @executorName, @obsStatus, @obsVersion, @currentScene,
      @sourceCount, @resolution, @fps, @virtualCameraStatus, @outputStatus,
      @errorMessage, @sceneSources, @lastConnectedAt, @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      executor_name = excluded.executor_name,
      obs_status = excluded.obs_status,
      obs_version = excluded.obs_version,
      current_scene = excluded.current_scene,
      source_count = excluded.source_count,
      resolution = excluded.resolution,
      fps = excluded.fps,
      virtual_camera_status = excluded.virtual_camera_status,
      output_status = excluded.output_status,
      error_message = excluded.error_message,
      scene_sources_json = excluded.scene_sources_json,
      last_connected_at = excluded.last_connected_at,
      updated_at = excluded.updated_at`,
  ).run({
    id,
    executorId: executor.id,
    executorName: executor.name,
    obsStatus,
    obsVersion: detail?.obsVersion || detail?.obsWebSocketVersion || '未知',
    currentScene: detail?.currentScene || '无',
    sourceCount: Number(detail?.sourceCount || sceneSources.length || 0),
    resolution: detail?.resolution || '未设置',
    fps: Number(detail?.fps || 0),
    virtualCameraStatus: normalizeVirtualCameraStatus(detail?.virtualCameraStatus || '未连接'),
    outputStatus: obsStatus === '已连接' ? '预览中' : '未输出',
    errorMessage,
    sceneSources: toJson(sceneSources),
    lastConnectedAt: obsStatus === '已连接' ? detail?.checkedAt || timestamp : '',
    updatedAt: timestamp,
  });
}

function updateSpeechQueueFromSpeakAck(command, ackPayload, commandStatus, resultMessage) {
  if (command.command_type !== 'speak') {
    return;
  }

  const payload = fromJson(command.payload_json, {});
  const speechQueueId = payload?.speechQueueId;

  if (!speechQueueId) {
    return;
  }

  const existing = db.prepare('SELECT id FROM speech_queue WHERE id = ?').get(speechQueueId);

  if (!existing) {
    return;
  }

  const timestamp = now();
  const detail = ackPayload?.detail || {};
  const isProgress = ['received', 'running'].includes(commandStatus);
  const isSucceeded = ['succeeded', 'done'].includes(commandStatus) && detail?.ok !== false;
  const broadcastStatus =
    isProgress ? '下发中' : isSucceeded ? '已播报' : '失败';

  db.prepare(
    `UPDATE speech_queue
     SET broadcast_status = @broadcastStatus,
         broadcast_result_json = @broadcastResult,
         broadcast_error_message = @broadcastErrorMessage,
         broadcast_started_at = @broadcastStartedAt,
         broadcast_finished_at = @broadcastFinishedAt,
         updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id: speechQueueId,
    broadcastStatus,
    broadcastResult: toJson(detail || {}),
    broadcastErrorMessage: isSucceeded || isProgress ? '' : resultMessage || detail?.message || '执行端播报失败',
    broadcastStartedAt: detail?.startedAt || detail?.receivedAt || '',
    broadcastFinishedAt: isProgress ? '' : detail?.finishedAt || timestamp,
    updatedAt: timestamp,
  });
}

router.get('/executors', (req, res) => {
  const { pageNumber, pageSize, offset } = getPagination(req);
  const params = {
    limit: pageSize,
    offset,
  };
  const clauses = [];

  if (req.query.keyword) {
    params.keyword = `%${req.query.keyword}%`;
    clauses.push('(name LIKE @keyword OR device_id LIKE @keyword OR bound_account LIKE @keyword OR device_name LIKE @keyword)');
  }

  if (req.query.status) {
    params.status = req.query.status;
    clauses.push('status = @status');
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS count FROM executors ${whereSql}`).get(params).count;
  const rows = db.prepare(`SELECT * FROM executors ${whereSql} ORDER BY id ASC LIMIT @limit OFFSET @offset`).all(params);

  return success(res, {
    list: rows.map(mapExecutor),
    total,
    page: pageNumber,
    pageSize,
    stats: buildExecutorStats(),
  });
});

router.post('/executors/bind-code', requirePermission(PERMISSIONS.EXECUTOR_OBS_OPERATE), (req, res) => {
  const body = req.body || {};
  const expiresInMinutes = Math.min(Math.max(Number.parseInt(body.expiresInMinutes || '10', 10), 1), 60);
  const bindCode = createBindCode();
  const timestamp = now();
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();
  const id = `BC_${crypto.randomUUID()}`;

  db.prepare(
    `INSERT INTO executor_bind_codes (
      id, code_hash, expires_at, used_at, used_executor_id, created_by, created_at, updated_at
    ) VALUES (
      @id, @codeHash, @expiresAt, '', '', @createdBy, @createdAt, @updatedAt
    )`,
  ).run({
    id,
    codeHash: hashBindCode(bindCode),
    expiresAt,
    createdBy: req.authUser?.id || 'system',
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return success(res, {
    bindCode,
    expiresAt,
    expiresInMinutes,
    bindCodeId: id,
    tokenVisibleOnce: true,
    message: '绑定码已生成，请在过期前到本地执行端完成绑定。',
  });
});

router.post('/executors/bind', (req, res) => {
  const body = req.body || {};
  const expiresInMinutes = Math.min(Math.max(Number(body.expiresInMinutes || 10), 1), 60);
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();
  const suffix = String(Date.now()).slice(-8);
  const code = `BIND-${suffix.slice(0, 4)}-${suffix.slice(4)}`;

  return success(res, {
    code,
    expiresAt,
    expiresIn: `${expiresInMinutes} 分钟`,
    bindUrl: `https://console.example.local/mock-bind/${code}`,
    link: `https://console.example.local/mock-bind/${code}`,
    mock: true,
    deprecated: true,
    replacement: '/api/executors/bind-code',
    message: 'Deprecated mock endpoint. Use /api/executors/bind-code for real bind code registration.',
  });
});

router.post('/executors/register', (req, res) => {
  const body = req.body || {};
  const bindCode = String(body.bindCode || '').trim();

  if (!bindCode) {
    return fail(res, '参数错误', PARAM_ERROR, {
      field: 'bindCode',
      reason: '绑定码不能为空',
    });
  }

  const bindCodeRow = db.prepare('SELECT * FROM executor_bind_codes WHERE code_hash = ? LIMIT 1').get(hashBindCode(bindCode));

  if (!bindCodeRow || bindCodeRow.used_at || isExpired(bindCodeRow.expires_at)) {
    return fail(res, '绑定码无效或已过期', BIND_CODE_INVALID, {
      field: 'bindCode',
      reason: '绑定码不存在、已使用或已过期',
    });
  }

  const timestamp = now();
  const executorId = nextId('executors', 'EX');
  const deviceToken = createDeviceToken();
  const deviceName = String(body.deviceName || '').trim() || '未命名直播电脑';
  const deviceId = String(body.deviceId || '').trim() || `DEV-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
  const executorName = String(body.name || '').trim() || deviceName;
  const os = String(body.os || '').trim() || 'unknown';
  const version = String(body.version || '').trim() || '0.0.0';

  db.prepare(
    `INSERT INTO executors (
      id, name, device_id, device_token_hash, bound_account, device_name, os, status,
      current_live_task, obs_status, virtual_camera_status, version,
      last_heartbeat_at, registered_at, notes, created_at, updated_at
    ) VALUES (
      @id, @name, @deviceId, @deviceTokenHash, @boundAccount, @deviceName, @os, @status,
      @currentLiveTask, @obsStatus, @virtualCameraStatus, @version,
      @lastHeartbeatAt, @registeredAt, @notes, @createdAt, @updatedAt
    )`,
  ).run({
    id: executorId,
    name: executorName,
    deviceId,
    deviceTokenHash: hashDeviceToken(deviceToken),
    boundAccount: String(body.boundAccount || '').trim(),
    deviceName,
    os,
    status: '在线',
    currentLiveTask: '',
    obsStatus: normalizeObsStatus(body.obsStatus),
    virtualCameraStatus: normalizeVirtualCameraStatus(body.virtualCameraStatus),
    version,
    lastHeartbeatAt: timestamp,
    registeredAt: timestamp,
    notes: 'Registered by executor bind code MVP.',
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  db.prepare(
    `UPDATE executor_bind_codes
     SET used_at = @usedAt,
         used_executor_id = @executorId,
         updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id: bindCodeRow.id,
    executorId,
    usedAt: timestamp,
    updatedAt: timestamp,
  });

  const executor = db.prepare('SELECT * FROM executors WHERE id = ?').get(executorId);

  return success(res, {
    executor: mapExecutor(executor),
    deviceToken,
    tokenType: 'Bearer',
    tokenVisibleOnce: true,
  });
});

router.post('/executors/:id/heartbeat', requireDeviceAuth, requireDeviceExecutor, (req, res) => {
  const body = req.body || {};
  const timestamp = now();
  const reportedAt = String(body.timestamp || body.reportedAt || '').trim() || timestamp;
  const onlineStatus = normalizeExecutorStatus(body.onlineStatus || body.status);
  const obsStatus = normalizeObsStatus(body.obsStatus || req.deviceExecutor.obs_status);
  const virtualCameraStatus =
    normalizeVirtualCameraStatus(body.virtualCameraStatus || req.deviceExecutor.virtual_camera_status);
  const version = String(body.version || '').trim() || req.deviceExecutor.version || '';
  const cpuUsage = normalizeNumber(body.cpuUsage, 0);
  const memoryUsage = normalizeNumber(body.memoryUsage, 0);
  const networkLatency = normalizeNumber(body.networkLatency, 0);
  const errorMessage = String(body.errorMessage || '').trim();
  const level = String(body.level || '').trim() || (errorMessage ? 'warning' : 'info');
  const heartbeatId = `HB_${crypto.randomUUID()}`;

  db.prepare(
    `INSERT INTO executor_heartbeats (
      id, executor_id, executor_name, online_status, obs_status, virtual_camera_status,
      cpu_usage, memory_usage, network_latency, version, reported_at, error_message, level, created_at
    ) VALUES (
      @id, @executorId, @executorName, @onlineStatus, @obsStatus, @virtualCameraStatus,
      @cpuUsage, @memoryUsage, @networkLatency, @version, @reportedAt, @errorMessage, @level, @createdAt
    )`,
  ).run({
    id: heartbeatId,
    executorId: req.deviceExecutor.id,
    executorName: req.deviceExecutor.name,
    onlineStatus,
    obsStatus,
    virtualCameraStatus,
    cpuUsage,
    memoryUsage,
    networkLatency,
    version,
    reportedAt,
    errorMessage,
    level,
    createdAt: timestamp,
  });

  db.prepare(
    `UPDATE executors
     SET status = @status,
         obs_status = @obsStatus,
         virtual_camera_status = @virtualCameraStatus,
         version = @version,
         last_heartbeat_at = @lastHeartbeatAt,
         updated_at = @updatedAt
     WHERE id = @executorId`,
  ).run({
    executorId: req.deviceExecutor.id,
    status: onlineStatus,
    obsStatus,
    virtualCameraStatus,
    version,
    lastHeartbeatAt: timestamp,
    updatedAt: timestamp,
  });

  const heartbeat = db.prepare('SELECT * FROM executor_heartbeats WHERE id = ?').get(heartbeatId);
  const executor = db.prepare('SELECT * FROM executors WHERE id = ?').get(req.deviceExecutor.id);

  return success(res, {
    executor: mapExecutor(executor),
    heartbeat: mapHeartbeat(heartbeat),
  });
});

router.get('/executors/:id/commands/pending', requireDeviceAuth, requireDeviceExecutor, (req, res) => {
  const nowTime = now();
  const rows = db
    .prepare(
      `SELECT *
       FROM executor_commands
       WHERE executor_id = @executorId
         AND status IN ('pending', 'queued', '已下发')
         AND (timeout_at IS NULL OR timeout_at = '' OR timeout_at > @nowTime)
       ORDER BY created_at ASC`,
    )
    .all({
      executorId: req.deviceExecutor.id,
      nowTime,
    });

  return success(res, {
    list: rows.map(mapCommand),
    total: rows.length,
    pollingIntervalSeconds: 5,
  });
});

router.post('/executors/commands/:id/ack', requireDeviceAuth, (req, res) => {
  const command = db.prepare('SELECT * FROM executor_commands WHERE id = ?').get(req.params.id);

  if (!command) {
    return fail(res, '执行端命令不存在', COMMAND_NOT_FOUND, {
      id: req.params.id,
    });
  }

  if (command.executor_id !== req.deviceExecutor.id) {
    return fail(res, '执行端无权回执该命令', FORBIDDEN, {
      commandId: req.params.id,
    });
  }

  const body = req.body || {};
  const status = String(body.status || '').trim() || 'succeeded';
  const allowedStatuses = ['received', 'running', 'done', 'succeeded', 'failed', 'timeout', 'expired', 'cancelled'];

  if (!allowedStatuses.includes(status)) {
    return fail(res, '参数错误', PARAM_ERROR, {
      field: 'status',
      reason: 'status 仅支持 received / running / done / succeeded / failed / timeout / expired / cancelled',
    });
  }

  const timestamp = now();
  const resultMessage = String(body.resultMessage || body.message || '').trim();
  const ackPayload = {
    status,
    resultMessage,
    errorCode: body.errorCode || '',
    detail: body.detail || null,
  };

  db.prepare(
    `UPDATE executor_commands
     SET status = @status,
         result_message = @resultMessage,
         ack_payload_json = @ackPayload,
         executed_at = @executedAt,
         acked_at = @ackedAt,
         updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id: command.id,
    status,
    resultMessage,
    ackPayload: toJson(ackPayload),
    executedAt: timestamp,
    ackedAt: timestamp,
    updatedAt: timestamp,
  });

  const executor = db.prepare('SELECT * FROM executors WHERE id = ?').get(command.executor_id) || req.deviceExecutor;
  upsertExecutorObsStatusFromAck(command, executor, ackPayload.detail, status, resultMessage);
  updateSpeechQueueFromSpeakAck(command, ackPayload, status, resultMessage);

  const updated = db.prepare('SELECT * FROM executor_commands WHERE id = ?').get(command.id);

  return success(res, {
    command: mapCommand(updated),
  });
});

router.post('/executors/:id/restart', (req, res) => {
  return createCommand(res, req.params.id, 'restart', req.body, 'Mock 重启指令已记录，不触达真实执行端。');
});

router.post('/executors/:id/unbind', (req, res) => {
  return createCommand(res, req.params.id, 'unbind', req.body, 'Mock 解绑指令已记录，不注销真实设备。');
});

router.post('/executors/:id/refresh-config', (req, res) => {
  return createCommand(res, req.params.id, 'refresh_config', req.body, 'Mock 刷新配置指令已记录，不下发真实配置。');
});

router.post('/executors/:id/obs/test', (req, res) => {
  return createCommand(res, req.params.id, 'obs_test', req.body, 'OBS 测试连接指令已下发，由本地执行端连接 OBS WebSocket 并回执。');
});

router.post('/executors/:id/obs/refresh-scenes', (req, res) => {
  return createCommand(res, req.params.id, 'refresh_obs_scenes', req.body, 'OBS 刷新场景指令已下发，由本地执行端读取场景和来源后回执。');
});

router.post('/executors/:id/speak', requirePermission(PERMISSIONS.LIVE_MANUAL_TAKEOVER), (req, res) => {
  const body = req.body || {};
  const text = String(body.text || '').trim();

  if (!text) {
    return fail(res, '参数错误', PARAM_ERROR, {
      field: 'text',
      reason: '播报文本不能为空',
    });
  }

  return createCommand(
    res,
    req.params.id,
    'speak',
    {
      text,
      tone: String(body.tone || '').trim() || '自然',
      source: String(body.source || '').trim() || 'manual_test',
    },
    '播报话术指令已下发，由本地执行端数字人适配器处理并回执。',
  );
});

router.get('/executors/commands/:id', requirePermission(PERMISSIONS.LIVE_MANUAL_TAKEOVER), (req, res) => {
  const command = db.prepare('SELECT * FROM executor_commands WHERE id = ?').get(req.params.id);

  if (!command) {
    return fail(res, '执行端命令不存在', COMMAND_NOT_FOUND, {
      commandId: req.params.id,
    });
  }

  return success(res, {
    command: mapCommand(command),
  });
});

router.get('/executors/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM executors WHERE id = ?').get(req.params.id);

  if (!row) {
    return fail(res, '执行端不存在', 40400, { id: req.params.id });
  }

  return success(res, { executor: mapExecutor(row) });
});

router.get('/executor-obs', (req, res) => {
  const { pageNumber, pageSize, offset } = getPagination(req);
  const params = {
    limit: pageSize,
    offset,
  };
  const clauses = [];

  if (req.query.executorId) {
    params.executorId = req.query.executorId;
    clauses.push('executor_id = @executorId');
  }

  if (req.query.obsStatus) {
    params.obsStatus = req.query.obsStatus;
    clauses.push('obs_status = @obsStatus');
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS count FROM executor_obs_status ${whereSql}`).get(params).count;
  const rows = db
    .prepare(`SELECT * FROM executor_obs_status ${whereSql} ORDER BY executor_id ASC LIMIT @limit OFFSET @offset`)
    .all(params);
  const allRows = db.prepare('SELECT * FROM executor_obs_status ORDER BY executor_id ASC').all();

  return success(res, {
    list: rows.map(mapObsStatus),
    total,
    page: pageNumber,
    pageSize,
    checklist: buildObsChecklist(allRows),
  });
});

router.get('/executor-obs/:executorId', (req, res) => {
  const row = db.prepare('SELECT * FROM executor_obs_status WHERE executor_id = ?').get(req.params.executorId);

  if (!row) {
    return fail(res, 'OBS状态不存在', 40400, { executorId: req.params.executorId });
  }

  const obsStatus = mapObsStatus(row);

  return success(res, {
    obsStatus,
    sceneSources: obsStatus.sceneSources,
    checklist: buildObsChecklist([row]),
  });
});

function buildHeartbeatQuery(req, forcedExecutorId) {
  const params = {};
  const clauses = [];

  if (forcedExecutorId || req.query.executorId) {
    params.executorId = forcedExecutorId || req.query.executorId;
    clauses.push('executor_id = @executorId');
  }

  if (req.query.keyword) {
    params.keyword = `%${req.query.keyword}%`;
    clauses.push('(executor_id LIKE @keyword OR executor_name LIKE @keyword OR error_message LIKE @keyword)');
  }

  if (req.query.level) {
    params.level = req.query.level;
    clauses.push('level = @level');
  }

  if (req.query.isAbnormal === 'true' || req.query.isAbnormal === true) {
    clauses.push("(level != 'info' OR error_message != '无')");
  }

  if (req.query.isAbnormal === 'false' || req.query.isAbnormal === false) {
    clauses.push("level = 'info' AND error_message = '无'");
  }

  if (req.query.startTime) {
    params.startTime = req.query.startTime;
    clauses.push('created_at >= @startTime');
  }

  if (req.query.endTime) {
    params.endTime = req.query.endTime;
    clauses.push('created_at <= @endTime');
  }

  return {
    params,
    whereSql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
  };
}

router.get('/executor-heartbeats', (req, res) => {
  const { pageNumber, pageSize, offset } = getPagination(req);
  const { params, whereSql } = buildHeartbeatQuery(req);
  const queryParams = {
    ...params,
    limit: pageSize,
    offset,
  };
  const total = db.prepare(`SELECT COUNT(*) AS count FROM executor_heartbeats ${whereSql}`).get(queryParams).count;
  const rows = db
    .prepare(`SELECT * FROM executor_heartbeats ${whereSql} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`)
    .all(queryParams);

  return page(res, rows.map(mapHeartbeat), total, pageNumber, pageSize);
});

router.get('/executor-heartbeats/:executorId', (req, res) => {
  const executor = db.prepare('SELECT id FROM executors WHERE id = ?').get(req.params.executorId);

  if (!executor) {
    return fail(res, '执行端不存在', 40400, { executorId: req.params.executorId });
  }

  const { pageNumber, pageSize, offset } = getPagination(req);
  const { params, whereSql } = buildHeartbeatQuery(req, req.params.executorId);
  const queryParams = {
    ...params,
    limit: pageSize,
    offset,
  };
  const total = db.prepare(`SELECT COUNT(*) AS count FROM executor_heartbeats ${whereSql}`).get(queryParams).count;
  const rows = db
    .prepare(`SELECT * FROM executor_heartbeats ${whereSql} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`)
    .all(queryParams);

  return page(res, rows.map(mapHeartbeat), total, pageNumber, pageSize);
});

export default router;
