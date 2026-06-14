import { db, nextId, now } from '../db/database.js';

const riskRank = {
  低: 1,
  中: 2,
  高: 3,
};

const actionRank = {
  allow: 0,
  warn: 1,
  rewrite: 2,
  block: 3,
};

const actionLabels = {
  allow: '放行',
  warn: '提醒',
  rewrite: '建议改写',
  block: '拦截',
};

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeSearchText(value) {
  return normalizeText(value).toLowerCase();
}

function toEnabledFlag(value) {
  if (value === false || value === 0 || value === '0' || value === 'false') {
    return 0;
  }

  return 1;
}

function isKeywordMatch(text, keyword) {
  const source = normalizeSearchText(text);
  const target = normalizeSearchText(keyword.text);

  if (!source || !target) {
    return false;
  }

  if (keyword.match_type === 'exact') {
    return source === target;
  }

  return source.includes(target);
}

function pickHighestRisk(matches) {
  return matches.reduce((highest, item) => {
    const currentRank = riskRank[item.riskLevel] || 0;
    const highestRank = riskRank[highest] || 0;
    return currentRank > highestRank ? item.riskLevel : highest;
  }, '低');
}

function pickAction(matches) {
  return matches.reduce((highest, item) => {
    const currentRank = actionRank[item.action] ?? 0;
    const highestRank = actionRank[highest] ?? 0;
    return currentRank > highestRank ? item.action : highest;
  }, 'allow');
}

function buildSuggestion(action, riskLevel, matches) {
  if (!matches.length) {
    return '未命中全局合规词库，仍建议人工复核关键直播话术。';
  }

  if (action === 'block') {
    return `命中${riskLevel}风险禁用表达，建议删除或改写后再使用。`;
  }

  if (action === 'rewrite') {
    return `命中${riskLevel}风险表达，建议使用更中性、可验证的描述。`;
  }

  return `命中${riskLevel}风险提醒词，建议人工确认上下文。`;
}

export function mapComplianceKeyword(row) {
  return {
    id: row.id,
    text: row.text,
    category: row.category,
    riskLevel: row.risk_level,
    action: row.action,
    actionLabel: actionLabels[row.action] || row.action,
    matchType: row.match_type,
    enabled: Boolean(Number(row.enabled || 0)),
    description: row.description,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listComplianceKeywords({ enabledOnly = true } = {}) {
  const whereSql = enabledOnly ? 'WHERE enabled = 1' : '';
  return db
    .prepare(`SELECT * FROM compliance_keywords ${whereSql} ORDER BY risk_level DESC, updated_at DESC, id ASC`)
    .all();
}

export function checkComplianceText(text, options = {}) {
  const sourceText = normalizeText(text);
  const keywords = listComplianceKeywords({ enabledOnly: options.enabledOnly !== false });
  const matches = keywords.filter((keyword) => isKeywordMatch(sourceText, keyword)).map(mapComplianceKeyword);
  const riskLevel = matches.length ? pickHighestRisk(matches) : '低';
  const action = matches.length ? pickAction(matches) : 'allow';

  return {
    passed: action !== 'block',
    riskLevel,
    action,
    actionLabel: actionLabels[action] || action,
    matches,
    matchCount: matches.length,
    suggestion: buildSuggestion(action, riskLevel, matches),
    checkedAt: now(),
  };
}

export function isComplianceBlockingResult(result = {}) {
  return (
    result.action === 'block' ||
    result.riskLevel === '高' ||
    (result.matches || []).some((item) => item.action === 'block' || item.riskLevel === '高')
  );
}

export function buildComplianceRiskTips(result = {}) {
  const matches = result.matches || [];

  if (!matches.length) {
    return [];
  }

  return matches.map((item) => ({
    keyword: item.text,
    category: item.category,
    riskLevel: item.riskLevel,
    action: item.action,
    actionLabel: item.actionLabel,
    suggestion: item.description || result.suggestion,
  }));
}

export function buildComplianceErrorDetail(result = {}) {
  const riskTips = buildComplianceRiskTips(result);
  const keywords = riskTips.map((item) => item.keyword).filter(Boolean);
  const keywordText = keywords.length ? keywords.join('、') : '未知合规词';
  const suggestion = result.suggestion || '建议加入待播队列审核后再播报。';

  return {
    field: 'text',
    reason: `命中词：${keywordText}；风险等级：${result.riskLevel || '未知'}；建议：${suggestion} 请改为入队审核或改写后再播报。`,
    riskLevel: result.riskLevel || '',
    action: result.action || '',
    matches: riskTips,
    suggestion,
  };
}

export function recordComplianceCheck({
  sourcePage = '',
  scenario = '',
  target = '',
  inputSummary = '',
  result,
} = {}) {
  const id = nextId('compliance_check_logs', 'CCL');
  const timestamp = now();
  const checkResult = result || checkComplianceText('');

  db.prepare(
    `INSERT INTO compliance_check_logs (
      id, checked_at, source_page, scenario, target, input_summary, result_summary,
      risk_level, action, match_count, created_at
    ) VALUES (
      @id, @checkedAt, @sourcePage, @scenario, @target, @inputSummary, @resultSummary,
      @riskLevel, @action, @matchCount, @createdAt
    )`,
  ).run({
    id,
    checkedAt: timestamp,
    sourcePage,
    scenario,
    target,
    inputSummary,
    resultSummary: `risk=${checkResult.riskLevel}; action=${checkResult.action}; matches=${checkResult.matchCount}`,
    riskLevel: checkResult.riskLevel,
    action: checkResult.action,
    matchCount: Number(checkResult.matchCount || 0),
    createdAt: timestamp,
  });

  return id;
}

export function normalizeComplianceKeywordBody(body = {}, existing = {}) {
  return {
    text: body.text ?? existing.text ?? '',
    category: body.category ?? existing.category ?? '通用',
    riskLevel: body.riskLevel ?? body.risk_level ?? existing.risk_level ?? '中',
    action: body.action ?? existing.action ?? 'warn',
    matchType: body.matchType ?? body.match_type ?? existing.match_type ?? 'contains',
    enabled: toEnabledFlag(body.enabled ?? existing.enabled ?? 1),
    description: body.description ?? existing.description ?? '',
  };
}

export { actionLabels };
