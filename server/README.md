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
| `40101` | 未登录 | 当前仅占位，未接真实登录 |
| `40301` | 无权限 | 当前仅占位，未接真实 RBAC |
| `40401` | 资源不存在 | 后续新接口优先使用 |
| `50001` | 服务异常 | 后端未知错误 |

兼容说明：

```text
历史接口中仍可返回 40100 / 40300 / 40400 / 40900 / 50000。
response.js 已保留这些旧错误码到 HTTP 状态码的映射，避免大范围改动现有路由。
```

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

## 权限 Key 占位

权限 key 常量位于：

```text
server/utils/permissions.js
```

当前阶段未实现真实登录鉴权，也不会在路由中强制权限校验。`permissions.js` 仅作为后续 RBAC 的 key 约定，避免前后端继续扩展时命名发散。

## 操作日志占位

操作日志工具位于：

```text
server/utils/operationLog.js
```

`recordOperationLog(db, payload)` 当前只是本地 SQLite 占位工具，用于后续审计日志接入前统一字段约定。本阶段不实现真实审计系统、不记录敏感 Prompt、不记录任何 API Key。

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
- `GET /api/ai/models`
- `PUT /api/ai/models/:id`
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

- 真实登录鉴权与权限校验（`/api/auth/*` 当前仅为 Mock 登录态占位）
- 真实文件上传（`POST /api/files/upload` 当前仅接受 JSON Mock 请求，不保存真实文件）
- AI 模型真实调用
- OBS / 执行端真实通信
- WebSocket / 实时弹幕
- 工单回复、工单附件和真实文件上传
- 真实外部工单系统或通知系统
- 真实执行端绑定、重启、解绑、配置下发和 OBS WebSocket 控制
- 全量 API 文档中的所有扩展接口

## 安全注意事项

- 不读取 `模型api.txt`。
- 不读取 `.env.local` 中的模型 Key。
- 不写入任何真实 API Key。
- 模型 API Key 只能作为后端环境变量读取，不能使用 `VITE_` 前缀进入浏览器 bundle。
- `.env.example` 仅允许公开前端地址使用 `VITE_API_BASE_URL`。
- 当前所有用户、邮箱、设备、IP 都是 Mock 数据。
- 真实模型调用后续必须走后端代理，并按文档做脱敏、限流和费用保护。
