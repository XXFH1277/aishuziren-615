import express from 'express';
import { evaluateAiProviderGuardrails, getAiProviderRuntimePolicy } from '../ai/providerGuardrails.js';
import { runProviderGenerate } from '../ai/providerAdapter.js';
import { db, fromJson, nextId, now, toJson } from '../db/database.js';
import { requireAuth, requirePermission } from '../utils/auth.js';
import { PERMISSIONS } from '../utils/permissions.js';
import { fail, page, success } from '../utils/response.js';

const router = express.Router();

const productCopyTargets = {
  description: {
    label: '商品简介',
    promptCategory: '商品简介',
  },
  selling_points: {
    label: '核心卖点',
    promptCategory: '商品卖点',
  },
  live_script: {
    label: '直播口播',
    promptCategory: '直播口播',
  },
  faq: {
    label: 'FAQ问答',
    promptCategory: 'FAQ问答',
  },
  compliance_rewrite: {
    label: '合规改写',
    promptCategory: '合规改写',
  },
};

function getPagination(req) {
  const pageNumber = Math.max(Number.parseInt(req.query.page || '1', 10), 1);
  const pageSize = Math.min(Math.max(Number.parseInt(req.query.pageSize || '20', 10), 1), 100);
  return {
    pageNumber,
    pageSize,
    offset: (pageNumber - 1) * pageSize,
  };
}

function mapModel(row) {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    usage: fromJson(row.usage_json, []),
    status: row.status,
    officialBaseUrl: row.official_base_url,
    baseUrlOptions: fromJson(row.base_url_options_json, []),
    modelOptions: fromJson(row.model_options_json, []),
    defaultModel: row.default_model,
    apiKeyConfigured: Boolean(Number(row.api_key_configured || 0)),
    credentialRef: row.credential_ref,
    apiKeyMasked: row.api_key_masked,
    lastTestStatus: row.last_test_status,
    lastTestAt: row.last_test_at,
    todayCalls: Number(row.today_calls || 0),
    todayCost: Number(row.today_cost || 0),
    enabled: Boolean(Number(row.enabled || 0)),
    docsNote: row.docs_note,
    isOfficialPreset: Boolean(Number(row.is_official_preset || 0)),
    description: row.description,
    maxTokens: Number(row.max_tokens || 2048),
    temperature: Number(row.temperature || 0.7),
    updatedAt: row.updated_at,
  };
}

function mapRoleSetting(row) {
  return {
    id: row.id,
    label: row.label,
    value: row.value,
    providerId: row.provider_id,
    modelName: row.model_name,
    updatedAt: row.updated_at,
  };
}

function mapPrompt(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    targetPage: row.target_page,
    defaultModel: row.default_model,
    status: row.status,
    templateContent: row.template_content,
    variables: fromJson(row.variables_json, []),
    updatedAt: row.updated_at,
  };
}

function mapLog(row) {
  return {
    id: row.id,
    time: row.call_time,
    page: row.source_page,
    sourcePage: row.source_page,
    type: row.type,
    provider: row.provider,
    modelName: row.model_name,
    inputSummary: row.input_summary,
    outputSummary: row.output_summary,
    status: row.status,
    duration: row.duration,
    tokens: Number(row.tokens || 0),
    cost: Number(row.cost || 0),
    errorType: row.error_type,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}

function mapCost(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    statDate: row.stat_date,
    todayCalls: Number(row.today_calls || 0),
    todayCost: Number(row.today_cost || 0),
    monthCost: Number(row.month_cost || 0),
    averageCost: Number(row.average_cost || 0),
    abnormalCalls: Number(row.abnormal_calls || 0),
    providerBreakdown: fromJson(row.provider_breakdown_json, []),
    typeBreakdown: fromJson(row.type_breakdown_json, []),
    budgetSettings: fromJson(row.budget_settings_json, {}),
    updatedAt: row.updated_at,
  };
}

function getModelOrFail(res, id) {
  const row = db.prepare('SELECT * FROM ai_model_providers WHERE id = ?').get(id);

  if (!row) {
    fail(res, 'AI model provider not found', 40400, { id });
    return null;
  }

  return row;
}

function getPromptOrFail(res, id) {
  const row = db.prepare('SELECT * FROM prompt_templates WHERE id = ?').get(id);

  if (!row) {
    fail(res, 'Prompt template not found', 40400, { id });
    return null;
  }

  return row;
}

function maskApiKey(value) {
  const secret = String(value || '').trim();

  if (!secret) {
    return '';
  }

  const head = secret.slice(0, Math.min(3, secret.length));
  const tail = secret.slice(-Math.min(4, secret.length));

  if (secret.length <= 7) {
    return `${head}****`;
  }

  return `${head}-****${tail}`;
}

function credentialRefFor(providerId) {
  const safeId = String(providerId || 'model').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `cred_${safeId}`;
}

function mapCredential(row, model) {
  const configured = Boolean(Number(model?.api_key_configured || 0));

  return {
    apiKeyConfigured: configured,
    apiKeyMasked: model?.api_key_masked || row?.api_key_masked || '',
    credentialRef: model?.credential_ref || row?.credential_ref || '',
    source: row?.source || '',
    baseUrl: row?.base_url || model?.official_base_url || '',
    modelName: row?.model_name || model?.default_model || '',
    remark: row?.remark || '',
    updatedAt: row?.updated_at || model?.updated_at || '',
  };
}

function getCredentialRow(providerId) {
  return db.prepare('SELECT * FROM ai_model_credentials WHERE provider_id = ? LIMIT 1').get(providerId);
}

function getAiCostRow() {
  return db.prepare('SELECT * FROM ai_cost_daily ORDER BY updated_at DESC LIMIT 1').get();
}

function getBudgetSettings(row = getAiCostRow()) {
  return fromJson(row?.budget_settings_json, {});
}

function serializeGuardrail(guardrail) {
  return {
    allowed: guardrail.allowed,
    blocked: guardrail.blocked,
    requestedRealProvider: guardrail.requestedRealProvider,
    realProviderEnabled: guardrail.realProviderEnabled,
    reason: guardrail.reason,
    message: guardrail.message,
    failures: guardrail.failures || [],
    minuteLimit: guardrail.minuteLimit,
    policy: {
      defaultProvider: guardrail.policy.defaultProvider,
      realProviderEnabled: guardrail.policy.realProviderEnabled,
      mode: guardrail.policy.mode,
      frontendApiKeyAllowed: guardrail.policy.frontendApiKeyAllowed,
      storesPlainApiKey: guardrail.policy.storesPlainApiKey,
      requestTimeoutMs: guardrail.policy.requestTimeoutMs,
      perMinuteCallLimit: guardrail.policy.perMinuteCallLimit,
      dailyCallLimit: guardrail.policy.dailyCallLimit,
      dailyBudgetLimit: guardrail.policy.dailyBudgetLimit,
      maxEstimatedCostPerCall: guardrail.policy.maxEstimatedCostPerCall,
      requiredServerEnv: guardrail.policy.requiredServerEnv,
      note: guardrail.policy.note,
    },
  };
}

function parseStoredJson(value, fallback) {
  if (Array.isArray(value) || (value && typeof value === 'object')) {
    return value;
  }

  return fromJson(value, fallback);
}

function listFromValue(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((item) => item.replace(/^-\s*/, '').trim())
      .filter(Boolean);
  }

  return [];
}

function mapProductForAi(row = {}) {
  if (!row) {
    return {};
  }

  return {
    id: row.id,
    name: row.name || '',
    category: row.category || '',
    brand: row.brand || '',
    price: Number(row.price || 0),
    stock: Number(row.stock || 0),
    description: row.description || '',
    sellingPoints: listFromValue(parseStoredJson(row.selling_points, [])),
    faq: listFromValue(parseStoredJson(row.faq, [])),
    scripts: parseStoredJson(row.scripts, {}),
    forbiddenExpressions: listFromValue(parseStoredJson(row.forbidden_expressions, [])),
  };
}

function mapDraftProductForAi(draft = {}) {
  const scripts = draft.scripts || draft.script || {};
  const sellingPoints = draft.sellingPoints || draft.selling?.core || [];
  const faq = draft.faq?.questions || draft.faq || [];

  return {
    id: draft.id || '',
    name: draft.name || '',
    category: draft.category || '',
    brand: draft.brand || '',
    price: Number(draft.price ?? draft.spec?.price ?? 0),
    stock: Number(draft.stock ?? draft.spec?.stock ?? 0),
    description: draft.description || '',
    sellingPoints: listFromValue(sellingPoints),
    faq: listFromValue(faq),
    scripts,
    forbiddenExpressions: listFromValue(draft.forbiddenExpressions || draft.compliance?.forbidden || []),
  };
}

function mergeProductInput(baseProduct = {}, draftProduct = {}) {
  const draft = mapDraftProductForAi(draftProduct);

  return {
    ...baseProduct,
    ...Object.fromEntries(Object.entries(draft).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      if (value && typeof value === 'object') return Object.keys(value).length > 0;
      return value !== '' && value !== 0;
    })),
    sellingPoints: draft.sellingPoints?.length ? draft.sellingPoints : baseProduct.sellingPoints || [],
    faq: draft.faq?.length ? draft.faq : baseProduct.faq || [],
    scripts: Object.keys(draft.scripts || {}).length ? draft.scripts : baseProduct.scripts || {},
    forbiddenExpressions: draft.forbiddenExpressions?.length
      ? draft.forbiddenExpressions
      : baseProduct.forbiddenExpressions || [],
  };
}

function countFilledProductFields(product = {}) {
  return [
    product.name,
    product.category,
    product.brand,
    product.price,
    product.stock,
    product.description,
    ...(product.sellingPoints || []),
    ...(product.faq || []),
    ...Object.values(product.scripts || {}),
    ...(product.forbiddenExpressions || []),
  ].filter((value) => String(value || '').trim()).length;
}

function getProductCopyPromptTemplate(target, promptTemplateId) {
  if (promptTemplateId) {
    const row = db.prepare('SELECT * FROM prompt_templates WHERE id = ?').get(promptTemplateId);
    return row ? mapPrompt(row) : null;
  }

  const row = db
    .prepare(
      `SELECT * FROM prompt_templates
       WHERE category = @category AND status = '启用中'
       ORDER BY updated_at DESC, id ASC
       LIMIT 1`,
    )
    .get({ category: productCopyTargets[target]?.promptCategory || '商品简介' });

  return row ? mapPrompt(row) : null;
}

function buildProductCopyInputSummary({ productId, target, fieldCount, promptTemplate }) {
  return `product_copy 商品=${productId || 'draft'}，target=${target}，字段数=${fieldCount}，模板=${promptTemplate?.id || 'default'}，未记录商品草稿原文。`;
}

function buildProductCopyOutputSummary({ target, content, riskTips }) {
  return `生成 ${target}，长度=${String(content || '').length}，riskTips=${riskTips?.length || 0}，输出已脱敏摘要。`;
}

function summarizeInput({ scenario, modelName, sourcePage }) {
  return `${sourcePage} 发起 ${scenario}，模型 ${modelName}，未记录 Prompt 原文或 API Key。`;
}

function summarizeOutput({ status, providerRequestId }) {
  return `AI 后端代理测试${status}，requestId=${providerRequestId || 'none'}，输出已脱敏。`;
}

function recordAiCallLog({
  sourcePage = 'AI模型配置',
  type = '模型连接测试',
  provider = '',
  modelName = '',
  inputSummary = '',
  outputSummary = '',
  status = '成功',
  duration = '0ms',
  tokens = 0,
  cost = 0,
  errorType = '',
  errorMessage = '',
}) {
  const createdAt = now();
  const id = nextId('ai_call_logs', 'LOG');

  db.prepare(
    `INSERT INTO ai_call_logs (
      id, call_time, source_page, type, provider, model_name,
      input_summary, output_summary, status, duration, tokens, cost,
      error_type, error_message, created_at
    ) VALUES (
      @id, @callTime, @sourcePage, @type, @provider, @modelName,
      @inputSummary, @outputSummary, @status, @duration, @tokens, @cost,
      @errorType, @errorMessage, @createdAt
    )`,
  ).run({
    id,
    callTime: createdAt,
    sourcePage,
    type,
    provider,
    modelName,
    inputSummary,
    outputSummary,
    status,
    duration,
    tokens,
    cost,
    errorType,
    errorMessage,
    createdAt,
  });

  return id;
}

function incrementBreakdown(rawValue, name, cost = 0) {
  const list = fromJson(rawValue, []);
  const item = list.find((entry) => entry.name === name);

  if (item) {
    item.value = Number(item.value || 0) + 1;
    item.cost = Number(item.cost || 0) + cost;
    return list;
  }

  list.push({
    name,
    value: 1,
    cost,
  });

  return list;
}

function updateAiCostDaily({ provider = 'Fake Provider', type = '模型连接测试', cost = 0 }) {
  const updatedAt = now();
  const statDate = updatedAt.slice(0, 10);
  const row = db.prepare('SELECT * FROM ai_cost_daily WHERE id = ?').get('today');

  if (!row) {
    db.prepare(
      `INSERT INTO ai_cost_daily (
        id, stat_date, today_calls, today_cost, month_cost, average_cost,
        abnormal_calls, provider_breakdown_json, type_breakdown_json,
        budget_settings_json, updated_at
      ) VALUES (
        'today', @statDate, 1, @cost, @cost, @cost, 0,
        @providerBreakdown, @typeBreakdown, @budgetSettings, @updatedAt
      )`,
    ).run({
      statDate,
      cost,
      providerBreakdown: toJson([{ name: provider, value: 1, cost }]),
      typeBreakdown: toJson([{ name: type, value: 1 }]),
      budgetSettings: toJson({ dailyBudget: 120, monthlyBudget: 3000, overBudgetAlert: true }),
      updatedAt,
    });
    return;
  }

  const todayCalls = Number(row.today_calls || 0) + 1;
  const todayCost = Number(row.today_cost || 0) + cost;
  const monthCost = Number(row.month_cost || 0) + cost;

  db.prepare(
    `UPDATE ai_cost_daily
     SET stat_date = @statDate,
         today_calls = @todayCalls,
         today_cost = @todayCost,
         month_cost = @monthCost,
         average_cost = @averageCost,
         provider_breakdown_json = @providerBreakdown,
         type_breakdown_json = @typeBreakdown,
         updated_at = @updatedAt
     WHERE id = 'today'`,
  ).run({
    statDate,
    todayCalls,
    todayCost,
    monthCost,
    averageCost: todayCalls > 0 ? todayCost / todayCalls : 0,
    providerBreakdown: toJson(incrementBreakdown(row.provider_breakdown_json, provider, cost)),
    typeBreakdown: toJson(incrementBreakdown(row.type_breakdown_json, type, 0)),
    updatedAt,
  });
}

router.get('/ai/assistant', (req, res) => {
  const row = db.prepare('SELECT * FROM ai_assistant_settings WHERE id = ?').get('default');
  return success(res, {
    assistant: fromJson(row?.settings_json, {}),
  });
});

router.put('/ai/assistant', (req, res) => {
  const payload = req.body || {};

  if (!String(payload.assistantName || '').trim()) {
    return fail(res, 'Assistant name is required', 40001, {
      field: 'assistantName',
      reason: 'assistantName cannot be empty',
    });
  }

  db.prepare(
    `INSERT INTO ai_assistant_settings (id, settings_json, updated_at)
     VALUES ('default', @settingsJson, @updatedAt)
     ON CONFLICT(id) DO UPDATE SET
       settings_json = excluded.settings_json,
       updated_at = excluded.updated_at`,
  ).run({
    settingsJson: toJson(payload),
    updatedAt: now(),
  });

  return success(res, {
    assistant: payload,
    mock: true,
  });
});

router.get('/ai/runtime-policy', requireAuth, requirePermission(PERMISSIONS.AI_MODEL_READ), (req, res) => {
  const costRow = getAiCostRow();
  const budgetSettings = getBudgetSettings(costRow);
  const policy = getAiProviderRuntimePolicy({ budgetSettings });

  return success(res, {
    policy,
    guardrails: {
      realProviderRequiresBackendSwitch: true,
      realProviderRequiresSafetyApproval: true,
      realProviderRequiresCredentialRef: true,
      rateLimitEnabled: true,
      budgetGuardEnabled: true,
      logsAreSanitized: true,
    },
  });
});

router.post('/ai/generate', requireAuth, async (req, res) => {
  const body = req.body || {};
  const scenario = body.scenario || '';
  const target = body.target || '';

  if (scenario !== 'product_copy') {
    return fail(res, '参数错误', 40001, {
      field: 'scenario',
      reason: '当前阶段仅支持 product_copy',
    });
  }

  if (!productCopyTargets[target]) {
    return fail(res, '参数错误', 40001, {
      field: 'target',
      reason: 'target 仅支持 description / selling_points / live_script / faq / compliance_rewrite',
    });
  }

  const startedAt = Date.now();
  const productId = body.productId || '';
  let product = {};

  if (productId) {
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);

    if (!row) {
      return fail(res, '商品不存在', 40400, { id: productId });
    }

    product = mapProductForAi(row);
  }

  product = mergeProductInput(product, body.draftProduct || {});
  const promptTemplate = getProductCopyPromptTemplate(target, body.promptTemplateId);

  if (body.promptTemplateId && !promptTemplate) {
    return fail(res, 'Prompt template not found', 40400, { id: body.promptTemplateId });
  }

  const sourcePage = body.sourcePage || '商品编辑';
  const options = body.options || {};
  const realProvider = body.realProvider === true;
  const requestedProviderId = body.providerId || '';
  const requestedProvider = requestedProviderId
    ? db.prepare('SELECT * FROM ai_model_providers WHERE id = ?').get(requestedProviderId)
    : null;

  if (requestedProviderId && !requestedProvider) {
    return fail(res, 'AI model provider not found', 40400, { id: requestedProviderId });
  }

  const modelName = requestedProvider?.default_model || 'fake-model';
  const prompt = promptTemplate?.templateContent || `Generate ${productCopyTargets[target].label} for product_copy.`;
  const costRow = getAiCostRow();
  const guardrail = evaluateAiProviderGuardrails({
    realProvider,
    providerId: requestedProvider?.id || 'fake',
    credentialConfigured: Boolean(Number(requestedProvider?.api_key_configured || 0)),
    currentDailyCalls: Number(costRow?.today_calls || 0),
    currentDailyCost: Number(costRow?.today_cost || 0),
    budgetSettings: getBudgetSettings(costRow),
    estimatedCost: 0,
  });

  if (guardrail.blocked) {
    const duration = `${Date.now() - startedAt}ms`;
    const riskTips = [
      {
        level: 'info',
        type: 'provider_guardrail',
        message: guardrail.message,
      },
    ];
    const logId = recordAiCallLog({
      sourcePage,
      type: '商品文案',
      provider: 'guardrail',
      modelName,
      inputSummary: buildProductCopyInputSummary({
        productId: product.id || productId,
        target,
        fieldCount: countFilledProductFields(product),
        promptTemplate,
      }),
      outputSummary: `真实 provider 请求被 guardrails 拦截，reason=${guardrail.reason}，未调用外部模型。`,
      status: '已拦截',
      duration,
      tokens: 0,
      cost: 0,
      errorType: guardrail.reason,
      errorMessage: guardrail.message,
    });
    updateAiCostDaily({
      provider: 'guardrail',
      type: '商品文案',
      cost: 0,
    });

    return success(res, {
      scenario,
      target,
      content: guardrail.message,
      structured: {},
      riskTips,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      },
      cost: 0,
      provider: 'guardrail',
      modelName,
      providerRequestId: '',
      logId,
      mock: true,
      blocked: true,
      realProviderEnabled: false,
      guardrail: serializeGuardrail(guardrail),
      message: guardrail.message,
    });
  }

  const result = await runProviderGenerate({
    realProvider: realProvider && guardrail.allowed,
    scenario,
    prompt,
    input: {
      target,
      product,
      options,
      promptTemplateId: promptTemplate?.id || '',
    },
    modelConfig: {
      modelName,
      defaultModel: modelName,
      target,
      requestTimeoutMs: guardrail.policy.requestTimeoutMs,
    },
  });
  const content = result.content || '';
  const structured = result.structured || {};
  const riskTips = result.riskTips || [];
  const duration = `${Date.now() - startedAt}ms`;
  const tokens = Number(result.usage?.totalTokens || 0);
  const cost = Number(result.cost || 0);
  const logStatus = result.skipped ? '已拦截' : '成功';
  const errorType = result.skipped ? 'real_provider_disabled' : '';
  const errorMessage = result.skipped ? '当前阶段未开启真实模型调用。' : '';
  const logId = recordAiCallLog({
    sourcePage,
    type: '商品文案',
    provider: result.providerId || 'fake',
    modelName,
    inputSummary: buildProductCopyInputSummary({
      productId: product.id || productId,
      target,
      fieldCount: countFilledProductFields(product),
      promptTemplate,
    }),
    outputSummary: buildProductCopyOutputSummary({ target, content, riskTips }),
    status: logStatus,
    duration,
    tokens,
    cost,
    errorType,
    errorMessage,
  });
  updateAiCostDaily({
    provider: result.providerId || 'fake',
    type: '商品文案',
    cost,
  });

  return success(res, {
    scenario,
    target,
    content,
    structured,
    riskTips,
    usage: result.usage || {},
    cost,
    provider: result.providerId || 'fake',
    modelName,
    providerRequestId: result.providerRequestId || '',
    logId,
    mock: true,
    realProviderEnabled: false,
    guardrail: serializeGuardrail(guardrail),
    message: result.message,
  });
});

router.get('/ai/models', (req, res) => {
  const clauses = [];
  const params = {};

  if (req.query.status) {
    params.status = req.query.status;
    clauses.push('status = @status');
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM ai_model_providers ${whereSql} ORDER BY id ASC`).all(params);
  const list = rows.map(mapModel).filter((item) => !req.query.usage || item.usage.includes(req.query.usage));

  return success(res, {
    list,
    total: list.length,
  });
});

router.put('/ai/models/:id', (req, res) => {
  const existing = getModelOrFail(res, req.params.id);

  if (!existing) {
    return null;
  }

  const body = { ...(req.body || {}) };
  delete body.apiKey;
  delete body.key;
  delete body.secret;

  db.prepare(
    `UPDATE ai_model_providers
     SET official_base_url = @officialBaseUrl,
         base_url_options_json = @baseUrlOptions,
         model_options_json = @modelOptions,
         default_model = @defaultModel,
         status = @status,
         enabled = @enabled,
         max_tokens = @maxTokens,
         temperature = @temperature,
         updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id: req.params.id,
    officialBaseUrl: body.officialBaseUrl ?? body.baseUrl ?? existing.official_base_url,
    baseUrlOptions: toJson(body.baseUrlOptions || fromJson(existing.base_url_options_json, [])),
    modelOptions: toJson(body.modelOptions || fromJson(existing.model_options_json, [])),
    defaultModel: body.defaultModel ?? body.modelName ?? existing.default_model,
    status: body.status || (body.enabled ? '已配置' : existing.status),
    enabled: body.enabled === undefined ? Number(existing.enabled || 0) : body.enabled ? 1 : 0,
    maxTokens: Number(body.maxTokens ?? existing.max_tokens ?? 2048),
    temperature: Number(body.temperature ?? existing.temperature ?? 0.7),
    updatedAt: now(),
  });

  const row = db.prepare('SELECT * FROM ai_model_providers WHERE id = ?').get(req.params.id);
  return success(res, {
    model: mapModel(row),
    mock: true,
    message: 'Mock model config saved. Plain API keys are ignored and not persisted.',
  });
});

router.get('/ai/models/:id/credentials', requireAuth, requirePermission(PERMISSIONS.AI_MODEL_READ), (req, res) => {
  const existing = getModelOrFail(res, req.params.id);

  if (!existing) {
    return null;
  }

  const credentialRow = getCredentialRow(req.params.id);

  return success(res, {
    credential: mapCredential(credentialRow, existing),
  });
});

router.put('/ai/models/:id/credentials', requireAuth, requirePermission(PERMISSIONS.AI_MODEL_WRITE), (req, res) => {
  const existing = getModelOrFail(res, req.params.id);

  if (!existing) {
    return null;
  }

  const body = req.body || {};
  const apiKey = String(body.apiKey || '').trim();

  if (!apiKey) {
    return fail(res, '参数错误', 40001, {
      field: 'apiKey',
      reason: 'API Key 不能为空；后端只保存脱敏状态，不保存明文。',
    });
  }

  const updatedAt = now();
  const credentialRef = existing.credential_ref || credentialRefFor(req.params.id);
  const apiKeyMasked = maskApiKey(apiKey);
  const baseUrl = body.baseUrl ?? existing.official_base_url ?? '';
  const modelName = body.modelName ?? existing.default_model ?? '';
  const id = credentialRef;

  db.prepare(
    `INSERT INTO ai_model_credentials (
      id, provider_id, credential_ref, source, api_key_masked,
      base_url, model_name, remark, created_at, updated_at
    ) VALUES (
      @id, @providerId, @credentialRef, @source, @apiKeyMasked,
      @baseUrl, @modelName, @remark, @createdAt, @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      source = excluded.source,
      api_key_masked = excluded.api_key_masked,
      base_url = excluded.base_url,
      model_name = excluded.model_name,
      remark = excluded.remark,
      updated_at = excluded.updated_at`,
  ).run({
    id,
    providerId: req.params.id,
    credentialRef,
    source: body.source || 'local_sqlite_masked',
    apiKeyMasked,
    baseUrl,
    modelName,
    remark: body.remark || '',
    createdAt: updatedAt,
    updatedAt,
  });

  db.prepare(
    `UPDATE ai_model_providers
     SET api_key_configured = 1,
         credential_ref = @credentialRef,
         api_key_masked = @apiKeyMasked,
         official_base_url = @baseUrl,
         default_model = @modelName,
         status = '已配置',
         updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id: req.params.id,
    credentialRef,
    apiKeyMasked,
    baseUrl,
    modelName,
    updatedAt,
  });

  const credentialRow = getCredentialRow(req.params.id);
  const modelRow = db.prepare('SELECT * FROM ai_model_providers WHERE id = ?').get(req.params.id);

  return success(res, {
    credential: mapCredential(credentialRow, modelRow),
  });
});

router.delete('/ai/models/:id/credentials', requireAuth, requirePermission(PERMISSIONS.AI_MODEL_WRITE), (req, res) => {
  const existing = getModelOrFail(res, req.params.id);

  if (!existing) {
    return null;
  }

  const testedAt = now();
  db.prepare('DELETE FROM ai_model_credentials WHERE provider_id = ?').run(req.params.id);
  db.prepare(
    `UPDATE ai_model_providers
     SET api_key_configured = 0,
         credential_ref = '',
         api_key_masked = '',
         status = '未配置',
         enabled = 0,
         updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id: req.params.id,
    updatedAt: testedAt,
  });

  const modelRow = db.prepare('SELECT * FROM ai_model_providers WHERE id = ?').get(req.params.id);

  return success(res, {
    credential: mapCredential(null, modelRow),
  });
});

router.post('/ai/models/:id/test', requireAuth, requirePermission(PERMISSIONS.AI_MODEL_TEST), async (req, res) => {
  const existing = getModelOrFail(res, req.params.id);

  if (!existing) {
    return null;
  }

  const body = req.body || {};
  const startedAt = Date.now();
  const sourcePage = body.sourcePage || 'AI模型配置';
  const scenario = body.scenario || 'model_connection_test';
  const modelName = body.modelName || existing.default_model || 'fake-model';
  const realProvider = body.realProvider === true;
  const costRow = getAiCostRow();
  const guardrail = evaluateAiProviderGuardrails({
    realProvider,
    providerId: req.params.id,
    credentialConfigured: Boolean(Number(existing.api_key_configured || 0)),
    currentDailyCalls: Number(costRow?.today_calls || 0),
    currentDailyCost: Number(costRow?.today_cost || 0),
    budgetSettings: getBudgetSettings(costRow),
    estimatedCost: 0,
  });
  const modelConfig = {
    ...mapModel(existing),
    baseUrl: body.baseUrl || existing.official_base_url,
    modelName,
    requestTimeoutMs: guardrail.policy.requestTimeoutMs,
  };

  if (guardrail.blocked) {
    const duration = `${Date.now() - startedAt}ms`;
    const status = '真实调用已拦截';

    db.prepare('UPDATE ai_model_providers SET last_test_status = ?, last_test_at = ?, updated_at = ? WHERE id = ?').run(
      status,
      now(),
      now(),
      req.params.id,
    );

    const logId = recordAiCallLog({
      sourcePage,
      type: '模型连接测试',
      provider: existing.name,
      modelName,
      inputSummary: summarizeInput({ scenario, modelName, sourcePage }),
      outputSummary: `真实 provider 测试请求被 guardrails 拦截，reason=${guardrail.reason}，未调用外部模型。`,
      status: '已拦截',
      duration,
      tokens: 0,
      cost: 0,
      errorType: guardrail.reason,
      errorMessage: guardrail.message,
    });
    updateAiCostDaily({
      provider: existing.name,
      type: '模型连接测试',
      cost: 0,
    });

    return success(res, {
      id: req.params.id,
      status,
      duration,
      tokens: 0,
      cost: 0,
      logId,
      providerRequestId: '',
      realProviderEnabled: false,
      mock: true,
      blocked: true,
      guardrail: serializeGuardrail(guardrail),
      message: guardrail.message,
    });
  }

  const result = await runProviderGenerate({
    realProvider: realProvider && guardrail.allowed,
    scenario,
    prompt: 'Sanitized local model connection test prompt.',
    input: {
      providerId: req.params.id,
      sourcePage,
    },
    modelConfig,
  });
  const duration = `${Date.now() - startedAt}ms`;
  const tokens = Number(result.usage?.totalTokens || 0);
  const cost = Number(result.cost || 0);
  const status = result.skipped ? '真实调用未开启' : 'Fake通过';
  const logStatus = result.skipped ? '已拦截' : '成功';
  const errorType = result.skipped ? 'real_provider_disabled' : '';
  const errorMessage = result.skipped ? '当前阶段未开启真实模型调用。' : '';

  db.prepare('UPDATE ai_model_providers SET last_test_status = ?, last_test_at = ?, updated_at = ? WHERE id = ?').run(
    status,
    now(),
    now(),
    req.params.id,
  );
  db.prepare('UPDATE ai_model_providers SET today_calls = today_calls + 1, today_cost = today_cost + ? WHERE id = ?').run(
    cost,
    req.params.id,
  );

  const logId = recordAiCallLog({
    sourcePage,
    type: '模型连接测试',
    provider: existing.name,
    modelName,
    inputSummary: summarizeInput({ scenario, modelName, sourcePage }),
    outputSummary: summarizeOutput({ status, providerRequestId: result.providerRequestId }),
    status: logStatus,
    duration,
    tokens,
    cost,
    errorType,
    errorMessage,
  });
  updateAiCostDaily({
    provider: existing.name,
    type: '模型连接测试',
    cost,
  });

  return success(res, {
    id: req.params.id,
    status,
    duration,
    tokens,
    cost,
    logId,
    providerRequestId: result.providerRequestId,
    realProviderEnabled: false,
    mock: true,
    guardrail: serializeGuardrail(guardrail),
    message: result.message,
  });
});

router.get('/ai/models/defaults', (req, res) => {
  const rows = db.prepare('SELECT * FROM ai_model_role_settings ORDER BY id ASC').all();
  return success(res, {
    list: rows.map(mapRoleSetting),
  });
});

router.patch('/ai/models/defaults', (req, res) => {
  const body = req.body || {};

  if (!body.role) {
    return fail(res, 'role is required', 40001, {
      field: 'role',
      reason: 'role cannot be empty',
    });
  }

  const existing = db.prepare('SELECT * FROM ai_model_role_settings WHERE id = ?').get(body.role);

  if (!existing) {
    return fail(res, 'Model default role not found', 40400, { role: body.role });
  }

  const value = body.value || `${body.providerId || existing.provider_id || ''} / ${body.modelName || existing.model_name || ''}`;
  db.prepare(
    `UPDATE ai_model_role_settings
     SET value = @value, provider_id = @providerId, model_name = @modelName, updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id: body.role,
    value,
    providerId: body.providerId || existing.provider_id,
    modelName: body.modelName || existing.model_name,
    updatedAt: now(),
  });

  const rows = db.prepare('SELECT * FROM ai_model_role_settings ORDER BY id ASC').all();
  const updated = rows.find((item) => item.id === body.role);
  return success(res, {
    defaults: rows.map(mapRoleSetting),
    defaultModel: updated ? mapRoleSetting(updated) : null,
    mock: true,
  });
});

router.get('/ai/prompts', (req, res) => {
  const { pageNumber, pageSize, offset } = getPagination(req);
  const params = {
    limit: pageSize,
    offset,
  };
  const clauses = [];

  if (req.query.category) {
    params.category = req.query.category;
    clauses.push('category = @category');
  }

  if (req.query.status) {
    params.status = req.query.status;
    clauses.push('status = @status');
  }

  if (req.query.keyword) {
    params.keyword = `%${req.query.keyword}%`;
    clauses.push('(name LIKE @keyword OR template_content LIKE @keyword)');
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS count FROM prompt_templates ${whereSql}`).get(params).count;
  const rows = db
    .prepare(`SELECT * FROM prompt_templates ${whereSql} ORDER BY updated_at DESC, id ASC LIMIT @limit OFFSET @offset`)
    .all(params);

  return page(res, rows.map(mapPrompt), total, pageNumber, pageSize);
});

router.post('/ai/prompts', (req, res) => {
  const body = req.body || {};

  if (!String(body.name || '').trim() || !String(body.templateContent || '').trim()) {
    return fail(res, 'Prompt name and content are required', 40001, {
      field: 'name/templateContent',
      reason: 'name and templateContent cannot be empty',
    });
  }

  const id = nextId('prompt_templates', 'PT');
  db.prepare(
    `INSERT INTO prompt_templates (
      id, name, category, target_page, default_model, status,
      template_content, variables_json, updated_at
    ) VALUES (
      @id, @name, @category, @targetPage, @defaultModel, @status,
      @templateContent, @variables, @updatedAt
    )`,
  ).run({
    id,
    name: body.name,
    category: body.category || '',
    targetPage: body.targetPage || '',
    defaultModel: body.defaultModel || '',
    status: body.status || '启用中',
    templateContent: body.templateContent,
    variables: toJson(body.variables || []),
    updatedAt: now(),
  });

  const row = db.prepare('SELECT * FROM prompt_templates WHERE id = ?').get(id);
  return success(res, {
    id,
    template: mapPrompt(row),
    mock: true,
  });
});

router.put('/ai/prompts/:id', (req, res) => {
  const existing = getPromptOrFail(res, req.params.id);

  if (!existing) {
    return null;
  }

  const body = req.body || {};
  db.prepare(
    `UPDATE prompt_templates
     SET name = @name,
         category = @category,
         target_page = @targetPage,
         default_model = @defaultModel,
         status = @status,
         template_content = @templateContent,
         variables_json = @variables,
         updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id: req.params.id,
    name: body.name ?? existing.name,
    category: body.category ?? existing.category,
    targetPage: body.targetPage ?? existing.target_page,
    defaultModel: body.defaultModel ?? existing.default_model,
    status: body.status ?? existing.status,
    templateContent: body.templateContent ?? existing.template_content,
    variables: toJson(body.variables || fromJson(existing.variables_json, [])),
    updatedAt: now(),
  });

  const row = db.prepare('SELECT * FROM prompt_templates WHERE id = ?').get(req.params.id);
  const template = mapPrompt(row);
  return success(res, {
    template,
    prompt: template,
    mock: true,
  });
});

router.post('/ai/prompts/:id/copy', (req, res) => {
  const existing = getPromptOrFail(res, req.params.id);

  if (!existing) {
    return null;
  }

  const id = nextId('prompt_templates', 'PT');
  db.prepare(
    `INSERT INTO prompt_templates (
      id, name, category, target_page, default_model, status,
      template_content, variables_json, updated_at
    ) VALUES (
      @id, @name, @category, @targetPage, @defaultModel, @status,
      @templateContent, @variables, @updatedAt
    )`,
  ).run({
    id,
    name: `${existing.name} Copy`,
    category: existing.category,
    targetPage: existing.target_page,
    defaultModel: existing.default_model,
    status: existing.status,
    templateContent: existing.template_content,
    variables: existing.variables_json,
    updatedAt: now(),
  });

  const row = db.prepare('SELECT * FROM prompt_templates WHERE id = ?').get(id);
  const template = mapPrompt(row);
  return success(res, {
    id,
    sourceId: req.params.id,
    template,
    prompt: template,
    mock: true,
  });
});

router.get('/ai/logs', (req, res) => {
  const { pageNumber, pageSize, offset } = getPagination(req);
  const params = {
    limit: pageSize,
    offset,
  };
  const clauses = [];

  if (req.query.provider) {
    params.provider = req.query.provider;
    clauses.push('provider = @provider');
  }

  if (req.query.type) {
    params.type = req.query.type;
    clauses.push('type = @type');
  }

  if (req.query.status) {
    params.status = req.query.status;
    clauses.push('status = @status');
  }

  if (req.query.sourcePage) {
    params.sourcePage = req.query.sourcePage;
    clauses.push('source_page = @sourcePage');
  }

  if (req.query.startTime) {
    params.startTime = req.query.startTime;
    clauses.push('call_time >= @startTime');
  }

  if (req.query.endTime) {
    params.endTime = req.query.endTime;
    clauses.push('call_time <= @endTime');
  }

  if (req.query.keyword) {
    params.keyword = `%${req.query.keyword}%`;
    clauses.push('(source_page LIKE @keyword OR input_summary LIKE @keyword OR output_summary LIKE @keyword)');
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS count FROM ai_call_logs ${whereSql}`).get(params).count;
  const rows = db
    .prepare(`SELECT * FROM ai_call_logs ${whereSql} ORDER BY call_time DESC LIMIT @limit OFFSET @offset`)
    .all(params);

  return page(res, rows.map(mapLog), total, pageNumber, pageSize);
});

router.get('/ai/costs', (req, res) => {
  const row = db.prepare('SELECT * FROM ai_cost_daily ORDER BY updated_at DESC LIMIT 1').get();
  const costs = mapCost(row);

  return success(res, {
    costs,
    ...(costs || {}),
  });
});

router.patch('/ai/costs/budget', (req, res) => {
  const row = db.prepare('SELECT * FROM ai_cost_daily ORDER BY updated_at DESC LIMIT 1').get();

  if (!row) {
    return fail(res, 'AI cost summary not found', 40400);
  }

  const current = mapCost(row);
  const budgetSettings = {
    ...current.budgetSettings,
    ...(req.body || {}),
  };

  db.prepare('UPDATE ai_cost_daily SET budget_settings_json = ?, updated_at = ? WHERE id = ?').run(
    toJson(budgetSettings),
    now(),
    row.id,
  );

  return success(res, {
    budgetSettings,
    mock: true,
  });
});

export default router;
