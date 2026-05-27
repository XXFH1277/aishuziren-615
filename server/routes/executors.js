import express from 'express';
import { db, fromJson, nextId, now, toJson } from '../db/database.js';
import { fail, page, success } from '../utils/response.js';

const router = express.Router();
const onlineStatuses = ['在线', '直播中', '更新中'];

function getPagination(req) {
  const pageNumber = Math.max(Number.parseInt(req.query.page || '1', 10), 1);
  const pageSize = Math.min(Math.max(Number.parseInt(req.query.pageSize || '20', 10), 1), 100);
  return {
    pageNumber,
    pageSize,
    offset: (pageNumber - 1) * pageSize,
  };
}

function mapExecutor(row) {
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
    notes: row.notes,
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

  db.prepare(
    `INSERT INTO executor_commands (
      id, executor_id, command_type, payload_json, status, result_message,
      created_by, created_at, executed_at
    ) VALUES (
      @id, @executorId, @commandType, @payload, @status, @resultMessage,
      @createdBy, @createdAt, @executedAt
    )`,
  ).run({
    id: commandId,
    executorId,
    commandType,
    payload: toJson(payload || {}),
    status: '已下发',
    resultMessage,
    createdBy: 'local-api-mock',
    createdAt: timestamp,
    executedAt: '',
  });

  return success(res, {
    commandId,
    status: '已下发',
    message: resultMessage,
    executor: mapExecutor(executor),
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
    message: 'Mock 绑定信息已生成，不注册真实设备。',
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
  return createCommand(res, req.params.id, 'obs_test', req.body, 'Mock OBS 测试连接指令已记录，不访问 OBS WebSocket。');
});

router.post('/executors/:id/obs/refresh-scenes', (req, res) => {
  return createCommand(res, req.params.id, 'refresh_obs_scenes', req.body, 'Mock 刷新 OBS 场景指令已记录，不访问 OBS WebSocket。');
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
