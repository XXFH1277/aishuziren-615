import express from 'express';
import { db, fromJson, nextId, now, toJson } from '../db/database.js';
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

router.post('/ai/models/:id/test', (req, res) => {
  const existing = getModelOrFail(res, req.params.id);

  if (!existing) {
    return null;
  }

  const testedAt = now();
  const status = Number(existing.enabled || 0) ? 'Mock通过' : 'Mock待配置';

  db.prepare('UPDATE ai_model_providers SET last_test_status = ?, last_test_at = ?, updated_at = ? WHERE id = ?').run(
    status,
    testedAt,
    testedAt,
    req.params.id,
  );

  return success(res, {
    id: req.params.id,
    status,
    duration: '0.3s',
    mock: true,
    message: 'Mock test only. No Kimi, Mimo, OpenAI, or any real model API was called.',
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
