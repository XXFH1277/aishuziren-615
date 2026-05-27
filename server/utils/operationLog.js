function nextOperationLogId(db) {
  const rows = db.prepare('SELECT id FROM operation_logs').all();
  const maxNumber = rows.reduce((max, row) => {
    if (!row.id || !row.id.startsWith('LOG')) {
      return max;
    }

    const numericPart = Number.parseInt(row.id.slice(3), 10);
    return Number.isNaN(numericPart) ? max : Math.max(max, numericPart);
  }, 0);

  return `LOG${String(maxNumber + 1).padStart(3, '0')}`;
}

export function recordOperationLog(
  db,
  {
    userId = '',
    username = 'local-api-mock',
    module = '',
    action = '',
    targetId = '',
    targetName = '',
    result = '成功',
    description = '',
  } = {},
) {
  const timestamp = new Date().toISOString();
  const target = [targetName, targetId].filter(Boolean).join(' / ');

  db.prepare(
    `INSERT INTO operation_logs (
      id, time, operator, module, action_type, target, result, ip, device,
      description, before_summary, after_summary, error_message, created_at
    ) VALUES (
      @id, @time, @operator, @module, @actionType, @target, @result, @ip, @device,
      @description, @beforeSummary, @afterSummary, @errorMessage, @createdAt
    )`,
  ).run({
    id: nextOperationLogId(db),
    time: timestamp,
    operator: username || userId || 'local-api-mock',
    module,
    actionType: action,
    target,
    result,
    ip: 'local',
    device: 'local-api',
    description,
    beforeSummary: '',
    afterSummary: '',
    errorMessage: result === '失败' ? description : '',
    createdAt: timestamp,
  });
}
