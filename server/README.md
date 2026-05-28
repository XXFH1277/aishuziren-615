# Local API Server

本目录是 Phase 12 新增的本地 Node 后端基础框架，用于把项目从纯前端 Mock 过渡到：

```text
页面组件
↓
Service 层
↓
本地 API
↓
SQLite 数据库
```

当前只实现核心 MVP 接口，不接真实后端、真实模型服务、OBS、执行端或直播平台。

## 安装依赖

项目根目录执行：

```bash
npm install
```

Phase 12 新增依赖：

- `express`
- `cors`
- `better-sqlite3`
- `nodemon`

## 初始化数据库

```bash
npm run server:seed
```

数据库文件位置：

```text
server/data/dev.sqlite
```

`server/data/*.sqlite` 和 `server/data/*.db` 已加入 `.gitignore`，不要提交数据库文件。

## 启动后端

开发模式：

```bash
npm run server:dev
```

普通启动：

```bash
npm run server:start
```

默认端口：

```text
http://localhost:3000
```

## 本地开发命令

```bash
npm install
npm run server:seed
npm run server:dev
npm run server:smoke
npm run build
```

说明：

- `server:seed` 会重复初始化本地 SQLite Mock 数据。
- `server:dev` 启动本地 Express API。
- `server:smoke` 检查当前已实现的核心本地 API。
- `build` 检查前端生产构建。

## Smoke Test

先启动后端：

```bash
npm run server:dev
```

再在另一个终端运行：

```bash
npm run server:smoke
```

说明：

- Smoke test 使用 Node 原生 `fetch`，不引入测试框架。
- 默认检查 `http://localhost:3000`；如需指定地址，可设置 `SMOKE_BASE_URL=http://localhost:3000`。
- 检查范围覆盖 health、商品、数字人、直播管理、直播间搭建、互动播控输入侧、延迟播控输出侧、系统设置、帮助中心、执行端管理的核心本地 API。
- 测试只访问本地 API，不读取 `模型api.txt`，不读取 `.env.local`，不连接真实外部服务。

## 错误码

后端错误码集中在 `server/utils/errorCodes.js`，`server/utils/response.js` 负责统一包装响应。

| code | 含义 | 说明 |
| --- | --- | --- |
| `0` | 成功 | `success()` 默认返回 |
| `40001` | 参数错误 | Query / Body 不合法 |
| `40101` | 未登录 | 未提供 token、token 失效或会话过期 |
| `40301` | 无权限 | 当前角色缺少对应权限 key |
| `40401` | 资源不存在 | 后续新接口优先使用 |
| `50001` | 服务异常 | 后端未知错误 |

兼容说明：

```text
历史接口中仍可返回 40100 / 40300 / 40400 / 40900 / 50000。
response.js 已保留这些旧错误码到 HTTP 状态码的映射，避免大范围改动现有路由。
```

## 前端错误态约定

前端 `src/services/request.js` 已统一消费本地 API 响应：

- `code === 0` 视为成功，返回 `data`。
- `code !== 0` 或 HTTP 非 2xx 视为业务错误，优先展示后端 `message`，并附带 `error.field` / `error.reason`。
- 本地 API 未启动、端口不可达或网络失败时，统一提示“本地 API 服务未连接，请先运行 npm run server:dev”。
- 本地 API 返回非 JSON 时，前端提示“本地 API 返回格式异常：HTTP xxx”。

当前所有接口仍为本地开发链路，不接真实 AI、真实文件存储、OBS、执行端、WebSocket 或直播平台。

## 参数校验

轻量校验工具位于：

```text
server/utils/validators.js
```

当前提供：

- `required(value)`
- `assertRequired(value, fieldName, reason)`
- `validatePagination(page, pageSize)`

当前已在少量写接口中示范使用，例如商品创建、数字人创建、基础设置保存。`PUT /api/settings/basic` 会校验 `systemName` 不能为空。

## Auth / RBAC MVP

Phase 13 已将 `/api/auth/*` 从 Mock 登录态升级为本地 Auth / RBAC MVP：

- `POST /api/auth/login` 使用 SQLite `users.password_hash` 校验密码。
- 登录成功后创建 `auth_sessions` 会话，只返回一次明文 Bearer token，数据库只保存 token hash。
- `GET /api/auth/me` 和 `POST /api/auth/refresh` 需要 `Authorization: Bearer <token>`。
- `POST /api/auth/logout` 会作废当前会话 token。
- Seed 默认本地演示账号为 `admin / admin123456`。
- 系统设置接口已示范接入基础权限校验：用户列表、角色列表、基础设置和操作日志需要登录，其中部分接口需要对应权限 key。

这仍不是生产级鉴权系统：暂未实现 Cookie 策略、CSRF 防护、密码重置、登录频率限制、多端会话管理、数据权限过滤或全量业务接口强制鉴权。

## 权限 Key

权限 key 常量位于：

```text
server/utils/permissions.js
```

`permissions.js` 导出权限 key 常量和本地角色到权限 key 的 MVP 映射。当前只在少量接口中示范强制校验，后续接真实 File、AI、执行端、WebSocket 前，应继续把关键写接口接入 `requirePermission()`。

## 操作日志占位

操作日志工具位于：

```text
server/utils/operationLog.js
```

`recordOperationLog(db, payload)` 当前只是本地 SQLite 占位工具，用于后续审计日志接入前统一字段约定。本阶段不实现真实审计系统、不记录敏感 Prompt、不记录任何 API Key。

## 本地文件上传

Phase 14 已将 `POST /api/files/upload` 升级为本地真实上传 MVP：

- 请求格式：`multipart/form-data`
- 字段：`file`、`module`、`businessId`、`fileType`
- 鉴权：需要 `Authorization: Bearer <token>`
- 存储目录：`server/uploads`
- 访问路径：`/uploads/*`
- 元信息表：`file_assets`
- 大小限制：单文件最大 5MB
- 类型限制：PNG、JPG、WEBP、GIF、PDF、TXT、MP4、WEBM、MOV、MP3、WAV、M4A、AAC
- 已接入入口：商品主图、工单附件、数字人素材、数字人授权文件、系统 Logo

当前不接云存储、不做病毒扫描、不做生产级文件权限隔离。`server/uploads/*` 已加入 `.gitignore`，不要提交上传产物。

## AI 后端代理基础

Phase 18A 增加 AI 后端代理基础框架，但默认不调用真实模型：

- credentials 接口：`GET /api/ai/models/:id/credentials`、`PUT /api/ai/models/:id/credentials`、`DELETE /api/ai/models/:id/credentials`
- 凭证接口需要本地登录 token 和 AI 模型配置权限。
- `PUT /api/ai/models/:id/credentials` 接收 `source`、`apiKey`、`baseUrl`、`modelName`、`remark`，但不保存明文 `apiKey`。
- SQLite 仅保存 `credential_ref`、`api_key_masked`、`api_key_configured` 和非密钥元信息。
- `POST /api/ai/models/:id/test` 默认使用 `server/ai/fakeProvider.js`，不会调用 Kimi、Mimo、OpenAI、DeepSeek 或任何真实模型服务。
- `server/ai/openaiCompatibleProvider.js` 当前只保留框架，真实调用默认未开启。
- 模型测试会写入 `ai_call_logs` 和 `ai_cost_daily`，日志只记录脱敏摘要、token 数、耗时、状态和费用估算，不记录 API Key、Authorization header、完整 Prompt 或用户隐私。
- `POST /api/ai/generate` 当前只支持 `scenario=product_copy`，默认使用 fake provider 打通商品文案生成闭环。
- `product_copy` 支持 `description`、`selling_points`、`live_script`、`faq`、`compliance_rewrite` 五类 target，并写入脱敏调用日志。
- Phase 18B-2 新增 `GET /api/ai/runtime-policy` 和 `server/ai/providerGuardrails.js`，用于展示真实 provider 灰度开关、频率限制、预算保护和脱敏策略。
- 默认需要同时设置后端环境变量 `AI_REAL_PROVIDER_ENABLED=true` 与 `AI_REAL_PROVIDER_SAFETY_APPROVED=true` 才允许进入真实 provider 保护流程；当前适配器仍不会默认发起外部模型调用。
- `realProvider=true` 的模型测试或商品文案生成请求会先经过 guardrails；默认会被拦截并写入脱敏日志，不记录 API Key、完整 Prompt 或完整商品草稿。

后续进入真实模型前，必须先确认后端环境变量或密钥管理方案、限流、超时、费用保护和脱敏日志策略。前端不得使用任何 `VITE_` 模型 Key。

## 已实现 API

- `GET /api/health`
- `GET /api/dashboard/overview`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/refresh`
- `POST /api/files/upload`
- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/products`
- `PUT /api/products/:id`
- `PATCH /api/products/:id/status`
- `GET /api/product-groups`
- `POST /api/product-groups`
- `GET /api/avatars`
- `GET /api/avatars/:id`
- `POST /api/avatars`
- `PUT /api/avatars/:id`
- `GET /api/avatar-actions`
- `GET /api/live-rooms`
- `GET /api/live-rooms/:id`
- `POST /api/live-rooms`
- `PUT /api/live-rooms/:id`
- `GET /api/live-tasks`
- `POST /api/live-tasks`
- `PATCH /api/live-tasks/:id/status`
- `GET /api/studio/backgrounds`
- `POST /api/studio/backgrounds/generate-mock`
- `GET /api/studio/layouts`
- `GET /api/studio/output-status`
- `GET /api/interaction/comments`
- `POST /api/dev/interaction/comments/simulate`
- `GET /api/interaction/questions`
- `POST /api/interaction/questions/:id/reply`
- `POST /api/interaction/questions/:id/add-to-queue`
- `POST /api/interaction/questions/:id/ignore`
- `GET /api/interaction/manual-takeover`
- `POST /api/interaction/manual-speech`
- `GET /api/delay-control/current`
- `GET /api/delay-control/queue`
- `PATCH /api/delay-control/queue/:id`
- `POST /api/delay-control/queue/:id/approve`
- `POST /api/delay-control/queue/:id/reject`
- `POST /api/delay-control/queue/:id/insert`
- `DELETE /api/delay-control/queue/:id`
- `GET /api/delay-control/subtitles`
- `PUT /api/delay-control/subtitles/settings`
- `GET /api/delay-control/settings`
- `PUT /api/delay-control/settings`
- `GET /api/live/control-room/overview`
- `GET /api/live/control-room/comments`
- `GET /api/live/control-room/questions`
- `GET /api/live/control-room/broadcast`
- `POST /api/live/control-room/manual-speech`
- `PATCH /api/live/control-room/speech-queue/:id`
- `GET /api/ai/assistant`
- `PUT /api/ai/assistant`
- `POST /api/ai/generate`
- `GET /api/ai/models`
- `GET /api/ai/runtime-policy`
- `PUT /api/ai/models/:id`
- `GET /api/ai/models/:id/credentials`
- `PUT /api/ai/models/:id/credentials`
- `DELETE /api/ai/models/:id/credentials`
- `POST /api/ai/models/:id/test`
- `GET /api/ai/models/defaults`
- `PATCH /api/ai/models/defaults`
- `GET /api/ai/prompts`
- `POST /api/ai/prompts`
- `PUT /api/ai/prompts/:id`
- `POST /api/ai/prompts/:id/copy`
- `GET /api/ai/logs`
- `GET /api/ai/costs`
- `PATCH /api/ai/costs/budget`
- `GET /api/settings/users`
- `GET /api/settings/roles`
- `GET /api/settings/basic`
- `PUT /api/settings/basic`
- `GET /api/settings/logs`
- `GET /api/help/faq`
- `GET /api/help/troubleshooting`
- `GET /api/help/tickets`
- `POST /api/help/tickets`
- `GET /api/help/tutorials`
- `GET /api/help/status`
- `GET /api/help/changelog`
- `GET /api/executors`
- `GET /api/executors/:id`
- `POST /api/executors/bind`
- `POST /api/executors/:id/restart`
- `POST /api/executors/:id/unbind`
- `POST /api/executors/:id/refresh-config`
- `POST /api/executors/:id/obs/test`
- `POST /api/executors/:id/obs/refresh-scenes`
- `GET /api/executor-obs`
- `GET /api/executor-obs/:executorId`
- `GET /api/executor-heartbeats`
- `GET /api/executor-heartbeats/:executorId`

## 当前未实现

- 生产级登录鉴权、密码重置、登录限流、Cookie / CSRF 策略和全量接口权限校验
- 云存储、病毒扫描、文件内容识别和生产级文件访问权限
- AI 模型真实调用
- OBS / 执行端真实通信
- WebSocket / 实时弹幕
- 工单回复和关闭工单真实处理
- 真实外部工单系统或通知系统
- 真实执行端绑定、重启、解绑、配置下发和 OBS WebSocket 控制
- 全量 API 文档中的所有扩展接口

## 安全注意事项

- 不读取 `模型api.txt`。
- 不读取 `.env.local` 中的模型 Key。
- 不写入任何真实 API Key。
- 模型 API Key 只能作为后端环境变量读取，不能使用 `VITE_` 前缀进入浏览器 bundle。
- `.env.example` 仅允许公开前端地址使用 `VITE_API_BASE_URL`。
- 当前所有用户、邮箱、设备、IP 都是 Mock 数据；默认登录密码仅用于本地演示，不可作为生产密码。
- 真实模型调用后续必须走后端代理，并按文档做脱敏、限流和费用保护。
