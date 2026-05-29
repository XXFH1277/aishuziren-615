import express from 'express';
import { db, nextId, now } from '../db/database.js';
import {
  checkComplianceText,
  mapComplianceKeyword,
  normalizeComplianceKeywordBody,
  recordComplianceCheck,
} from '../utils/compliance.js';
import { requireAuth, requirePermission } from '../utils/auth.js';
import { PERMISSIONS } from '../utils/permissions.js';
import { fail, page, success } from '../utils/response.js';
import { assertRequired, toValidationErrorPayload } from '../utils/validators.js';

const router = express.Router();
const allowedRiskLevels = new Set(['低', '中', '高']);
const allowedActions = new Set(['warn', 'rewrite', 'block']);
const allowedMatchTypes = new Set(['contains', 'exact']);

function getPagination(req) {
  const pageNumber = Math.max(Number.parseInt(req.query.page || '1', 10), 1);
  const pageSize = Math.min(Math.max(Number.parseInt(req.query.pageSize || '20', 10), 1), 100);
  return {
    pageNumber,
    pageSize,
    offset: (pageNumber - 1) * pageSize,
  };
}

function validateKeywordPayload(payload) {
  assertRequired(payload.text, 'text', '敏感词不能为空');

  if (!allowedRiskLevels.has(payload.riskLevel)) {
    const error = new Error('风险等级不合法');
    error.code = 40001;
    error.field = 'riskLevel';
    error.reason = '风险等级仅支持 低 / 中 / 高';
    throw error;
  }

  if (!allowedActions.has(payload.action)) {
    const error = new Error('处理动作不合法');
    error.code = 40001;
    error.field = 'action';
    error.reason = '处理动作仅支持 warn / rewrite / block';
    throw error;
  }

  if (!allowedMatchTypes.has(payload.matchType)) {
    const error = new Error('匹配方式不合法');
    error.code = 40001;
    error.field = 'matchType';
    error.reason = '匹配方式仅支持 contains / exact';
    throw error;
  }
}

router.get('/compliance/keywords', requireAuth, requirePermission(PERMISSIONS.AI_COMPLIANCE_READ), (req, res) => {
  const { pageNumber, pageSize, offset } = getPagination(req);
  const clauses = [];
  const params = {
    limit: pageSize,
    offset,
  };

  if (req.query.keyword) {
    params.keyword = `%${req.query.keyword}%`;
    clauses.push('(text LIKE @keyword OR description LIKE @keyword)');
  }

  if (req.query.category) {
    params.category = req.query.category;
    clauses.push('category = @category');
  }

  if (req.query.riskLevel) {
    params.riskLevel = req.query.riskLevel;
    clauses.push('risk_level = @riskLevel');
  }

  if (req.query.action) {
    params.action = req.query.action;
    clauses.push('action = @action');
  }

  if (req.query.enabled !== undefined && req.query.enabled !== '') {
    params.enabled = req.query.enabled === 'false' || req.query.enabled === '0' ? 0 : 1;
    clauses.push('enabled = @enabled');
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS count FROM compliance_keywords ${whereSql}`).get(params).count;
  const rows = db
    .prepare(`SELECT * FROM compliance_keywords ${whereSql} ORDER BY updated_at DESC, id ASC LIMIT @limit OFFSET @offset`)
    .all(params);

  return page(res, rows.map(mapComplianceKeyword), total, pageNumber, pageSize);
});

router.post('/compliance/keywords', requireAuth, requirePermission(PERMISSIONS.AI_COMPLIANCE_WRITE), (req, res) => {
  const payload = normalizeComplianceKeywordBody(req.body || {});

  try {
    validateKeywordPayload(payload);
  } catch (error) {
    return fail(res, '参数错误', error.code || 40001, toValidationErrorPayload(error));
  }

  const timestamp = now();
  const id = req.body?.id || nextId('compliance_keywords', 'CK');

  db.prepare(
    `INSERT INTO compliance_keywords (
      id, text, category, risk_level, action, match_type, enabled,
      description, created_by, created_at, updated_at
    ) VALUES (
      @id, @text, @category, @riskLevel, @action, @matchType, @enabled,
      @description, @createdBy, @createdAt, @updatedAt
    )`,
  ).run({
    ...payload,
    id,
    createdBy: req.authUser?.nickname || req.authUser?.username || 'system',
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const keyword = db.prepare('SELECT * FROM compliance_keywords WHERE id = ?').get(id);
  return success(res, { keyword: mapComplianceKeyword(keyword) }, 'created');
});

router.put('/compliance/keywords/:id', requireAuth, requirePermission(PERMISSIONS.AI_COMPLIANCE_WRITE), (req, res) => {
  const existing = db.prepare('SELECT * FROM compliance_keywords WHERE id = ?').get(req.params.id);

  if (!existing) {
    return fail(res, '合规词条不存在', 40400, { id: req.params.id });
  }

  const payload = normalizeComplianceKeywordBody(req.body || {}, existing);

  try {
    validateKeywordPayload(payload);
  } catch (error) {
    return fail(res, '参数错误', error.code || 40001, toValidationErrorPayload(error));
  }

  db.prepare(
    `UPDATE compliance_keywords
     SET text = @text,
         category = @category,
         risk_level = @riskLevel,
         action = @action,
         match_type = @matchType,
         enabled = @enabled,
         description = @description,
         updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    ...payload,
    id: req.params.id,
    updatedAt: now(),
  });

  const keyword = db.prepare('SELECT * FROM compliance_keywords WHERE id = ?').get(req.params.id);
  return success(res, { keyword: mapComplianceKeyword(keyword) });
});

router.post('/compliance/check', requireAuth, requirePermission(PERMISSIONS.AI_COMPLIANCE_READ), (req, res) => {
  const body = req.body || {};

  try {
    assertRequired(body.text, 'text', '检查文本不能为空');
  } catch (error) {
    return fail(res, '参数错误', error.code, toValidationErrorPayload(error));
  }

  const result = checkComplianceText(body.text);
  const logId = recordComplianceCheck({
    sourcePage: body.sourcePage || '合规中心',
    scenario: body.scenario || 'manual_check',
    target: body.target || '',
    inputSummary: `文本长度=${String(body.text || '').length}; sourcePage=${body.sourcePage || '合规中心'}; 不记录完整文本。`,
    result,
  });

  return success(res, {
    result,
    logId,
    mock: false,
  });
});

export default router;
