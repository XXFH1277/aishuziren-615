import express from 'express';
import { db, fromJson, now, toJson } from '../db/database.js';
import { fail, page, success } from '../utils/response.js';
import { recordOperationLog } from '../utils/operationLog.js';
import { assertRequired, toValidationErrorPayload } from '../utils/validators.js';

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

function mapUser(row) {
  return {
    id: row.id,
    username: row.username,
    nickname: row.nickname,
    email: row.email,
    phone: row.phone,
    role: row.role,
    status: row.status,
    lastLoginAt: row.last_login_at,
    recentLogin: Boolean(Number(row.recent_login || 0)),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRole(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    userCount: Number(row.user_count || 0),
    permissionScope: row.permission_scope,
    dataScope: row.data_scope,
    operationPermissions: fromJson(row.operation_permissions, []),
    menuPermissions: fromJson(row.menu_permissions, []),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapOperationLog(row) {
  return {
    id: row.id,
    time: row.time,
    operator: row.operator,
    module: row.module,
    actionType: row.action_type,
    target: row.target,
    result: row.result,
    ip: row.ip,
    device: row.device,
    description: row.description,
    beforeSummary: row.before_summary,
    afterSummary: row.after_summary,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}

router.get('/settings/users', (req, res) => {
  const { pageNumber, pageSize, offset } = getPagination(req);
  const params = {
    limit: pageSize,
    offset,
  };
  const clauses = [];

  if (req.query.keyword) {
    params.keyword = `%${req.query.keyword}%`;
    clauses.push('(username LIKE @keyword OR nickname LIKE @keyword OR email LIKE @keyword)');
  }

  if (req.query.status) {
    params.status = req.query.status;
    clauses.push('status = @status');
  }

  if (req.query.role) {
    params.role = req.query.role;
    clauses.push('role = @role');
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS count FROM users ${whereSql}`).get(params).count;
  const rows = db.prepare(`SELECT * FROM users ${whereSql} ORDER BY id ASC LIMIT @limit OFFSET @offset`).all(params);

  return page(res, rows.map(mapUser), total, pageNumber, pageSize);
});

router.get('/settings/roles', (req, res) => {
  const { pageNumber, pageSize, offset } = getPagination(req);
  const params = {
    limit: pageSize,
    offset,
  };
  const clauses = [];

  if (req.query.status) {
    params.status = req.query.status;
    clauses.push('status = @status');
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS count FROM roles ${whereSql}`).get(params).count;
  const rows = db.prepare(`SELECT * FROM roles ${whereSql} ORDER BY id ASC LIMIT @limit OFFSET @offset`).all(params);

  return page(res, rows.map(mapRole), total, pageNumber, pageSize);
});

router.get('/settings/basic', (req, res) => {
  const row = db.prepare('SELECT * FROM basic_settings WHERE id = ?').get('basic');
  return success(res, { settings: fromJson(row?.settings_json, {}) });
});

router.put('/settings/basic', (req, res) => {
  const payload = req.body || {};

  try {
    assertRequired(payload.systemName, 'systemName', '系统名称不能为空');
  } catch (error) {
    return fail(res, '参数错误', error.code, toValidationErrorPayload(error));
  }

  const settingsJson = toJson(payload);
  const timestamp = now();

  db.prepare(
    `INSERT INTO basic_settings (id, settings_json, created_at, updated_at)
     VALUES ('basic', @settingsJson, @createdAt, @updatedAt)
     ON CONFLICT(id) DO UPDATE SET
       settings_json = excluded.settings_json,
       updated_at = excluded.updated_at`,
  ).run({
    settingsJson,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  recordOperationLog(db, {
    username: 'local-api-mock',
    module: '系统设置',
    action: '保存基础设置',
    targetId: 'basic',
    targetName: payload.systemName,
    result: '成功',
    description: '保存基础设置到本地 SQLite，操作日志为 Phase 12.12 占位示范。',
  });

  return success(res, { settings: payload });
});

router.get('/settings/logs', (req, res) => {
  const { pageNumber, pageSize, offset } = getPagination(req);
  const params = {
    limit: pageSize,
    offset,
  };
  const clauses = [];

  if (req.query.operator) {
    params.operator = req.query.operator;
    clauses.push('operator = @operator');
  }

  if (req.query.module) {
    params.module = req.query.module;
    clauses.push('module = @module');
  }

  if (req.query.result) {
    params.result = req.query.result;
    clauses.push('result = @result');
  }

  if (req.query.actionType) {
    params.actionType = req.query.actionType;
    clauses.push('action_type = @actionType');
  }

  if (req.query.startTime) {
    params.startTime = req.query.startTime;
    clauses.push('time >= @startTime');
  }

  if (req.query.endTime) {
    params.endTime = req.query.endTime;
    clauses.push('time <= @endTime');
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS count FROM operation_logs ${whereSql}`).get(params).count;
  const rows = db
    .prepare(`SELECT * FROM operation_logs ${whereSql} ORDER BY time DESC LIMIT @limit OFFSET @offset`)
    .all(params);

  return page(res, rows.map(mapOperationLog), total, pageNumber, pageSize);
});

export default router;
