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

## 已实现 API

- `GET /api/health`
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
- `GET /api/settings/users`
- `GET /api/settings/roles`
- `GET /api/settings/basic`
- `PUT /api/settings/basic`
- `GET /api/settings/logs`

## 当前未实现

- 真实登录鉴权与权限校验
- 文件上传
- AI 模型真实调用
- OBS / 执行端真实通信
- WebSocket / 实时弹幕
- 全量 API 文档中的所有扩展接口

## 安全注意事项

- 不读取 `模型api.txt`。
- 不读取 `.env.local` 中的模型 Key。
- 不写入任何真实 API Key。
- 当前所有用户、邮箱、设备、IP 都是 Mock 数据。
- 真实模型调用后续必须走后端代理，并按文档做脱敏、限流和费用保护。
