# AI 真实 Provider 手动试点方案

生成时间：2026-05-29 11:53:38 CST  
执行身份：开发 Codex（OpenAI）

本文档冻结 Phase 18C 的实施边界：先确认真实 AI provider 的手动试点方案，不在本阶段调用 Kimi、Mimo、OpenAI、DeepSeek 或其他真实模型，不读取 `.env.local`，不读取 `模型api.txt`，不写入真实 API Key。

## 1. 当前基线

- 稳定点：`v0.18-review-core-hardening`。
- 当前默认模式：`fake_provider_only`。
- 已有接口：`GET /api/ai/runtime-policy`、`PUT/GET/DELETE /api/ai/models/:id/credentials`、`POST /api/ai/models/:id/test`、`POST /api/ai/generate`。
- 已有保护：后端 credentials 脱敏状态、fake provider、`providerGuardrails`、单分钟限制、单日调用限制、单日预算、单次预计费用保护、脱敏调用日志、日切成本统计。
- 当前真实 provider 状态：`server/ai/openaiCompatibleProvider.js` 仍是占位适配器，不默认发起外部网络请求。

## 2. 本阶段结论

Phase 18C 只冻结手动试点方案，不启用真实模型调用。

下一阶段如要进入真实 provider 手动试点，必须另开功能分支，并由用户明确提供真实调用授权。真实调用仍只能由后端代理发起，前端不得接触真实 Key。

## 3. 首个试点场景

建议首个真实 provider 试点继续限定在：

- `scenario=product_copy`
- 第一批 target：`description`、`selling_points`
- 页面入口：`/products/ai-copy` 优先，其次 `/products/:id/edit` 字段旁 AI 生成按钮

原因：

- 输入结构已经在 fake provider 闭环中验证过。
- 商品文案风险低于弹幕实时回复、直播中控台自动播控、数字人训练等场景。
- 可通过 `productId + draftProduct` 控制输入范围，便于脱敏和人工复核。
- 输出是文本，不触发 OBS、执行端、TTS、数字人训练或直播平台行为。

暂不进入真实调用的场景：

- 弹幕回复。
- 直播中控台自动发言。
- 数字人训练、声音克隆、TTS、口型同步。
- AI 背景生成。
- 执行端命令、OBS 控制、WebSocket 实时链路。

## 4. 手动开闸条件

真实 provider 请求必须同时满足以下条件：

1. 后端环境变量 `AI_REAL_PROVIDER_ENABLED=true`。
2. 后端环境变量 `AI_REAL_PROVIDER_SAFETY_APPROVED=true`。
3. 请求体明确传入 `realProvider=true`。
4. 当前用户已登录，并具备 AI 模型测试或 AI 文案生成相关权限。
5. 模型服务商凭证状态为 `apiKeyConfigured=true`，且仅保存脱敏状态或后端凭证引用。
6. 未超过 `AI_PROVIDER_PER_MINUTE_LIMIT`。
7. 未超过 `AI_PROVIDER_DAILY_CALL_LIMIT`。
8. 未超过 `AI_PROVIDER_DAILY_BUDGET`。
9. 如设置 `AI_PROVIDER_MAX_COST_PER_CALL`，预计单次费用不得超过该上限。
10. `scenario` 必须在后端 allowlist 中，首批只允许 `product_copy`。
11. `target` 必须在后端 allowlist 中，首批只允许 `description`、`selling_points`。

任一条件不满足时，应返回明确拦截原因，并写入脱敏日志。不得静默 fallback 到真实 provider。

## 5. 密钥与凭证方案

真实 API Key 只能出现在后端运行环境或后端密钥管理系统中，不进入浏览器和 Git。

允许的保存方式：

- 本地手动试点：由用户在本机后端运行环境中设置 provider API Key。
- 后续生产：使用服务端密钥管理、容器 Secret 或加密存储。

禁止：

- 写入 `src/`、`src/mock/`、docs、交接记录。
- 写入任何 `VITE_` 环境变量。
- 通过接口返回明文。
- 写入日志、错误栈、AI 调用记录。
- 由开发 AI 读取 `.env.local` 或 `模型api.txt`。

建议后端环境变量命名：

```text
KIMI_API_KEY
MIMO_API_KEY
OPENAI_API_KEY
DEEPSEEK_API_KEY
AI_REAL_PROVIDER_ENABLED
AI_REAL_PROVIDER_SAFETY_APPROVED
AI_PROVIDER_TIMEOUT_MS
AI_PROVIDER_PER_MINUTE_LIMIT
AI_PROVIDER_DAILY_CALL_LIMIT
AI_PROVIDER_DAILY_BUDGET
AI_PROVIDER_MAX_COST_PER_CALL
```

前端 credentials 页面只展示：

```json
{
  "apiKeyConfigured": true,
  "apiKeyMasked": "sk-****abcd",
  "credentialRef": "cred_xxx",
  "updatedAt": "2026-05-29T00:00:00.000Z"
}
```

## 6. Provider 适配策略

下一阶段真实试点建议先做一个 OpenAI-compatible 最小适配器，仍然只服务 `product_copy`。

适配器必须具备：

- 请求超时。
- 明确的请求体字段映射。
- 只发送必要 prompt 和商品字段。
- 响应格式归一化为现有 `content`、`usage`、`cost`、`providerRequestId`。
- 错误类型归一化，例如 `timeout`、`rate_limited`、`provider_error`、`invalid_response`、`budget_blocked`。
- 不把原始 provider 错误完整返回前端。

不得一次性扩展到所有 provider。应先选择一个用户确认的 provider 和官方文档，再小范围实现。

## 7. Prompt 与输入控制

真实试点 prompt 继续复用 `prompt_templates`。

输入只允许包含：

- 商品 id。
- 商品名称。
- 商品分类。
- 商品价格区间。
- 公开卖点。
- 已在表单中输入的非敏感草稿字段。
- target、style、length、complianceCheck。

输入不得包含：

- API Key。
- Authorization header。
- 用户密码、token、手机号、地址等个人敏感信息。
- 未经确认的真实客户素材内容。
- 完整后台状态快照。

## 8. 日志与成本记录

`ai_call_logs` 应记录：

- `sourcePage`
- `type=商品文案`
- `scenario=product_copy`
- `target`
- `provider`
- `modelName`
- `status`
- `duration`
- token 数
- 费用估算
- `errorType`
- `guardrail.reason`
- `inputSummary`
- `outputSummary`

`inputSummary` 只记录：

- 商品 id。
- target。
- 草稿字段数量。
- 模板 id。
- 是否真实 provider。

`outputSummary` 只记录：

- 输出类型。
- 输出长度。
- riskTips 数量。
- 是否成功。

不得记录：

- API Key。
- Authorization header。
- 完整 Prompt。
- 完整商品草稿。
- 完整模型输出中的敏感内容。
- 原始 provider 错误栈。
- 真实用户隐私。

`ai_cost_daily` 应按当前日期更新，真实费用仍以估算值为准，不读取 provider 账单。

## 9. 手动试点流程

真实调用试点必须由用户显式触发，建议流程：

1. 从 `dev` 新建功能分支，例如 `feature/ai-real-provider-manual-trial`。
2. 先确认 provider 官方文档和 baseUrl，不猜测未确认的服务地址。
3. 小范围实现 OpenAI-compatible adapter 的真实请求能力。
4. 保持默认 fake provider；真实调用只在 `realProvider=true` 且双开关开启时执行。
5. 用户自行在后端运行环境设置真实 API Key，开发 AI 不读取。
6. 运行 `npm run server:seed`。
7. 启动后端时手动开启安全开关和预算限制。
8. 登录后台，进入 `/ai-center/models`，确认 runtime policy 显示真实 provider guarded。
9. 先测试 `POST /api/ai/models/:id/test`。
10. 再测试 `POST /api/ai/generate`，只使用 `product_copy + description`。
11. 查看 `/ai-center/logs` 和 `/ai-center/costs`，确认日志脱敏、成本更新、错误可读。
12. 测试完成后关闭 `AI_REAL_PROVIDER_ENABLED`，必要时撤销或轮换真实 Key。

## 10. 回滚与熔断

任何异常都应优先关闭真实调用：

```text
AI_REAL_PROVIDER_ENABLED=false
AI_REAL_PROVIDER_SAFETY_APPROVED=false
```

可接受的回滚动作：

- 保持 fake provider 默认模式。
- 删除或清除 credentials 脱敏状态。
- 撤销 provider API Key。
- 回退真实 provider 试点分支，不影响 `dev`。

不应执行的动作：

- 把真实 Key 写入代码以便调试。
- 为了通过测试放宽日志脱敏。
- 为了绕过失败关闭 guardrails。
- 在未人工确认前扩大到弹幕、直播、执行端或 OBS 场景。

## 11. 验收标准

真实试点进入下一阶段前，必须满足：

- fake provider smoke test 仍通过。
- `realProvider=false` 行为完全不变。
- 未开启双开关时，`realProvider=true` 明确被拦截。
- 开启双开关后，仅 allowlist 场景可进入真实 provider。
- 单分钟、单日调用、单日预算、单次预计费用保护均可观察。
- 超时、限流、provider 错误、返回格式异常都有稳定错误态。
- `ai_call_logs` 不包含明文 Key、完整 Prompt、完整商品草稿。
- `ai_cost_daily` 按日期累计。
- 前端只展示脱敏状态。
- `npm run server:smoke` 和 `npm run build` 通过。

## 12. 推荐下一步

Phase 18C 完成后，建议进入：

1. `feature/ai-real-provider-manual-trial`：只实现一个 provider、一个场景、一个 target 的真实手动试点。
2. 或先做 `feature/compliance-center-mvp`：全局合规 / 敏感词中心 MVP，为真实 AI 输出提供统一前置和后置校验。

如果目标是降低真实 AI 风险，优先建议先做合规中心 MVP，再开真实 provider 手动试点。
