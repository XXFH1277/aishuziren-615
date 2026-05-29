const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const ONE_MINUTE_MS = 60 * 1000;
const realProviderWindows = new Map();

function readBoolean(value) {
  return TRUE_VALUES.has(String(value || '').trim().toLowerCase());
}

function readNumber(value, fallback) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : fallback;
}

function trimWindow(nowMs, calls) {
  return calls.filter((timestamp) => nowMs - timestamp < ONE_MINUTE_MS);
}

function evaluateMinuteLimit({ key, limit, nowMs }) {
  const existing = trimWindow(nowMs, realProviderWindows.get(key) || []);

  if (existing.length >= limit) {
    realProviderWindows.set(key, existing);
    return {
      allowed: false,
      remaining: 0,
      current: existing.length,
    };
  }

  existing.push(nowMs);
  realProviderWindows.set(key, existing);

  return {
    allowed: true,
    remaining: Math.max(limit - existing.length, 0),
    current: existing.length,
  };
}

export function getAiProviderRuntimePolicy({ env = process.env, budgetSettings = {} } = {}) {
  const switchEnabled = readBoolean(env.AI_REAL_PROVIDER_ENABLED);
  const safetyApproved = readBoolean(env.AI_REAL_PROVIDER_SAFETY_APPROVED);
  const realProviderEnabled = switchEnabled && safetyApproved;
  const dailyBudgetFallback = readNumber(budgetSettings.dailyBudget, 120);

  return {
    defaultProvider: 'fake',
    realProviderEnabled,
    realProviderSwitch: switchEnabled,
    safetyApproved,
    mode: realProviderEnabled ? 'real_provider_guarded' : 'fake_provider_only',
    frontendApiKeyAllowed: false,
    storesPlainApiKey: false,
    requiredServerEnv: ['AI_REAL_PROVIDER_ENABLED=true', 'AI_REAL_PROVIDER_SAFETY_APPROVED=true'],
    requestTimeoutMs: readNumber(env.AI_PROVIDER_TIMEOUT_MS, 15000),
    perMinuteCallLimit: readNumber(env.AI_PROVIDER_PER_MINUTE_LIMIT, 20),
    dailyCallLimit: readNumber(env.AI_PROVIDER_DAILY_CALL_LIMIT, 200),
    dailyBudgetLimit: readNumber(env.AI_PROVIDER_DAILY_BUDGET, dailyBudgetFallback),
    maxEstimatedCostPerCall: readNumber(env.AI_PROVIDER_MAX_COST_PER_CALL, 0),
    note: realProviderEnabled
      ? '真实 provider 仍需经过后端凭证、频率和预算保护后才能调用。'
      : '当前默认 fake provider；真实模型调用未开启。',
  };
}

export function evaluateAiProviderGuardrails({
  realProvider = false,
  providerId = 'fake',
  credentialConfigured = false,
  currentDailyCalls = 0,
  currentDailyCost = 0,
  estimatedCost = 0,
  budgetSettings = {},
  env = process.env,
  nowMs = Date.now(),
} = {}) {
  const policy = getAiProviderRuntimePolicy({ env, budgetSettings });

  if (!realProvider) {
    return {
      allowed: true,
      blocked: false,
      requestedRealProvider: false,
      realProviderEnabled: policy.realProviderEnabled,
      reason: 'fake_provider_default',
      message: '当前使用 fake provider，不调用真实模型。',
      policy,
    };
  }

  const failures = [];

  if (!policy.realProviderEnabled) {
    failures.push({
      type: 'real_provider_disabled',
      message: '当前阶段未开启真实模型调用。',
    });
  }

  if (!credentialConfigured) {
    failures.push({
      type: 'credential_missing',
      message: '后端未配置可用的模型凭证引用。',
    });
  }

  if (Number(currentDailyCalls || 0) >= policy.dailyCallLimit) {
    failures.push({
      type: 'daily_call_limit_exceeded',
      message: '已达到真实模型单日调用次数上限。',
    });
  }

  if (Number(currentDailyCost || 0) + Number(estimatedCost || 0) > policy.dailyBudgetLimit) {
    failures.push({
      type: 'daily_budget_exceeded',
      message: '预计费用会超过真实模型单日预算。',
    });
  }

  if (
    policy.maxEstimatedCostPerCall > 0
    && Number(estimatedCost || 0) > policy.maxEstimatedCostPerCall
  ) {
    failures.push({
      type: 'estimated_cost_per_call_exceeded',
      message: '预计单次费用超过真实模型调用上限。',
    });
  }

  let minuteLimit = {
    allowed: true,
    remaining: policy.perMinuteCallLimit,
    current: 0,
  };

  if (!failures.length) {
    minuteLimit = evaluateMinuteLimit({
      key: `${providerId}:real_provider`,
      limit: policy.perMinuteCallLimit,
      nowMs,
    });

    if (!minuteLimit.allowed) {
      failures.push({
        type: 'per_minute_rate_limited',
        message: '真实模型调用过于频繁，请稍后再试。',
      });
    }
  }

  if (failures.length) {
    return {
      allowed: false,
      blocked: true,
      requestedRealProvider: true,
      realProviderEnabled: false,
      reason: failures[0].type,
      message: failures[0].message,
      failures,
      minuteLimit,
      policy,
    };
  }

  return {
    allowed: true,
    blocked: false,
    requestedRealProvider: true,
    realProviderEnabled: true,
    reason: 'guardrails_passed',
    message: '真实 provider 已通过后端安全闸门，但当前适配器仍不会默认发起外部调用。',
    failures: [],
    minuteLimit,
    policy,
  };
}
