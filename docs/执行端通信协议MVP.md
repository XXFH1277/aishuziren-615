# 执行端通信协议 MVP

日期：2026-06-02  
适用产品：数字人直播带货中控系统  
文档性质：协议设计与后端 MVP 接口说明，不实现真实本地执行端、不接真实 OBS、不接直播平台。

## 1. 目标与边界

执行端（Local Agent / 本地直播客户端）未来安装在商家的直播电脑上，负责接收云端后台任务、上报状态、执行播报/OBS/虚拟摄像头相关命令。本 MVP 只建立后端通信协议骨架：

- 后台管理员生成一次性绑定码。
- 执行端用绑定码注册，换取长期 `deviceToken`。
- 执行端用独立 device token 上报心跳。
- 执行端用 HTTP 轮询拉取命令，并回执结果。
- 命令只入库和改状态，不触发真实 OBS、TTS、数字人或推流。

本协议刻意把执行端 token 与后台用户登录 token 分离：执行端不能获得用户权限，也不能调用用户管理、商品管理、AI 配置等后台接口。

## 2. 执行端技术栈建议

| 技术栈 | 优点 | 风险 / 成本 | 推荐度 |
| --- | --- | --- | --- |
| Electron | Node 生态成熟，适合调用本地脚本、管理窗口、与 OBS / 浏览器源 / 虚拟摄像头方案协作；前端团队上手成本低 | 包体较大，性能和安全边界需要治理 | 首选 MVP |
| Tauri | 包体小，Rust 安全性和性能好，桌面体验更轻 | Rust 学习成本更高，Windows 本地能力和音视频链路需要更多工程验证 | 中长期可评估 |
| Python 客户端 | 音视频、AI、OBS 脚本生态丰富，快速验证友好 | 桌面 UI、分发、自动更新和权限管理较弱；生产可维护性依赖团队能力 | 适合研发验证 |

推荐：MVP 先用 Electron。理由是当前系统前端为 React + Vite，执行端也可以复用 Web UI/状态面板思路，同时 Node 侧便于对接 OBS WebSocket、HTTP 轮询、文件缓存和本地脚本。若后续追求更小包体和更强系统安全边界，再评估 Tauri。Python 更适合作为音视频算法验证或本地插件，而不是第一版完整客户端。

## 3. 注册 / 绑定流程

### 3.1 流程

```text
管理员在后台点击“生成绑定码”
→ 后端生成一次性绑定码，仅返回一次明文
→ 后端只保存绑定码哈希、过期时间、使用状态
→ 执行端输入/扫码绑定码
→ 执行端调用注册接口
→ 后端校验绑定码未过期、未使用
→ 后端创建 executors 记录并生成 deviceToken
→ 后端只保存 deviceToken 哈希
→ 执行端保存明文 deviceToken 到本地安全存储
→ 后续心跳、拉命令、回执均使用 deviceToken
```

### 3.2 API

#### 管理员生成绑定码

Method: `POST`  
Path: `/api/executors/bind-code`  
鉴权：后台用户 token + 执行端操作权限  

Body:

```json
{
  "expiresInMinutes": 10
}
```

Response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "bindCode": "BIND-ABCD1234",
    "expiresAt": "2026-06-02T10:00:00.000Z",
    "expiresInMinutes": 10,
    "bindCodeId": "BC_xxx",
    "tokenVisibleOnce": true
  }
}
```

#### 执行端注册

Method: `POST`  
Path: `/api/executors/register`  
鉴权：绑定码校验，不使用用户 token  

Body:

```json
{
  "bindCode": "BIND-ABCD1234",
  "name": "公司直播电脑01",
  "deviceName": "Windows Live PC",
  "deviceId": "LOCAL-DEVICE-ID",
  "os": "Windows 11",
  "version": "0.1.0"
}
```

Response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "executor": {},
    "deviceToken": "dev_xxx",
    "tokenType": "Bearer",
    "tokenVisibleOnce": true
  }
}
```

注意：
- `deviceToken` 只返回一次。
- 数据库只保存 `device_token_hash`。
- 绑定码使用后写入 `used_at` 和 `used_executor_id`，不允许重复注册。

## 4. 鉴权模型

| 调用方 | Token 类型 | 可访问接口 | 权限边界 |
| --- | --- | --- | --- |
| 后台用户 | 用户登录 token | 后台管理 API | 按 RBAC 权限控制 |
| 执行端 | device token | 心跳、拉命令、回执 | 只能访问自己的 executor 资源 |

执行端请求统一使用：

```http
Authorization: Bearer dev_xxx
```

服务端根据 token 哈希查找 executor，并校验路径中的 `executorId` 与 token 所属 executor 一致。

## 5. 心跳协议

### 5.1 API

Method: `POST`  
Path: `/api/executors/:id/heartbeat`  
鉴权：device token  

Body:

```json
{
  "onlineStatus": "online",
  "obsStatus": "connected",
  "virtualCameraStatus": "enabled",
  "cpuUsage": 12,
  "memoryUsage": 34,
  "networkLatency": 28,
  "version": "0.1.0",
  "timestamp": "2026-06-02T10:00:00.000Z",
  "errorMessage": "",
  "level": "info"
}
```

字段说明：
- `onlineStatus`: `online` / `busy` / `abnormal`。
- `obsStatus`: `unknown` / `disconnected` / `connected` / `error`。
- `virtualCameraStatus`: `unknown` / `disabled` / `enabled` / `error`。
- `cpuUsage`: CPU 占用百分比，MVP 只做展示。
- `memoryUsage`: 内存占用百分比，MVP 只做展示。
- `networkLatency`: 客户端到后端估算延迟，单位 ms。
- `version`: 执行端版本号。
- `timestamp`: 客户端上报时间；服务端另有 `created_at` 落库时间。

### 5.2 上报频率与离线判定

MVP 建议：
- 心跳频率：5 秒一次。
- 后端离线判定：连续 3 个周期未收到心跳，即超过 15 秒可标记为疑似离线。
- 生产建议：结合网络抖动，把正式离线阈值设为 30 秒或更高。

当前 MVP 只写入心跳并刷新 `executors.last_heartbeat_at`，暂不实现定时离线扫描任务。

## 6. 命令下发协议

### 6.1 为什么 MVP 用 HTTP 轮询

HTTP 轮询的优点：
- 不需要引入 WebSocket 基础设施。
- 易于本地开发、Smoke Test 和错误排查。
- 命令幂等、重试、回执可以先通过数据库状态验证。

后续升级 WebSocket 的迁移点：
- 保留命令表结构和回执接口。
- WebSocket 只负责“通知有新命令”，执行端仍可用 HTTP 拉取详情。
- WebSocket 断开时自动回退 HTTP 轮询。

### 6.2 拉取待执行命令

Method: `GET`  
Path: `/api/executors/:id/commands/pending`  
鉴权：device token  

Response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "id": "CMD001",
        "commandType": "restart",
        "payload": {},
        "status": "pending",
        "idempotencyKey": "EX001:CMD001",
        "timeoutAt": "2026-06-02T10:05:00.000Z",
        "retryCount": 0
      }
    ],
    "total": 1,
    "pollingIntervalSeconds": 5
  }
}
```

### 6.3 命令回执

Method: `POST`  
Path: `/api/executors/commands/:id/ack`  
鉴权：device token  

Body:

```json
{
  "status": "succeeded",
  "resultMessage": "Command completed",
  "errorCode": "",
  "detail": {}
}
```

支持状态：
- `running`
- `succeeded`
- `failed`
- `timeout`

### 6.4 幂等、超时、重试

- 每条命令有 `idempotency_key`，建议格式：`executorId:commandId`。
- 执行端遇到重复命令时，不应重复执行真实动作；应返回上一次执行结果。
- 每条命令有 `timeout_at`，超时后执行端不应继续执行，应回执 `timeout` 或忽略。
- `retry_count` 用于后续服务端重试策略，MVP 仅落字段。
- 命令状态流转：`pending` → `running` → `succeeded` / `failed` / `timeout`。

## 7. 执行端状态机

```text
offline
  └─ 注册成功或心跳恢复 → online

online
  ├─ 开始执行直播任务 / OBS 操作 → busy
  ├─ OBS 异常 / CPU 过高 / 心跳异常 → abnormal
  └─ 超过离线阈值未心跳 → offline

busy
  ├─ 任务完成 → online
  ├─ 执行失败 → abnormal
  └─ 超过离线阈值未心跳 → offline

abnormal
  ├─ 客户端恢复并上报正常心跳 → online
  └─ 超过离线阈值未心跳 → offline
```

MVP 后端只接收状态，不主动推导全部状态；后续可以增加定时任务扫描 `last_heartbeat_at`，自动把超时执行端置为 `offline`。

## 8. 数据库落点

本阶段新增或补强：
- `executor_bind_codes`: 保存绑定码哈希、过期时间、使用状态。
- `executors.device_token_hash`: 保存 device token 哈希，不存明文。
- `executors.registered_at`: 注册时间。
- `executor_heartbeats.reported_at`: 客户端上报时间。
- `executor_heartbeats.version`: 执行端版本。
- `executor_commands.idempotency_key`: 命令幂等键。
- `executor_commands.timeout_at`: 命令超时点。
- `executor_commands.retry_count`: 重试次数。
- `executor_commands.ack_payload_json`: 回执详情。
- `executor_commands.acked_at`: 回执时间。
- `executor_commands.updated_at`: 命令更新时间。

## 9. 安全要求

- device token 与用户登录 token 分离。
- device token 只返回一次，后端只保存哈希。
- 执行端只能访问自己的心跳、命令拉取和命令回执。
- 执行端不能调用后台用户 API。
- 绑定码一次性、短有效期、使用后失效。
- 不在前端、文档、日志中记录明文 device token。
- 当前不接真实 OBS、直播伴侣、直播平台、TTS、数字人执行端。

## 10. MVP 验收链路

```text
POST /api/executors/bind-code
→ POST /api/executors/register
→ POST /api/executors/:id/heartbeat
→ 管理端写入一条 executor_commands
→ GET /api/executors/:id/commands/pending
→ POST /api/executors/commands/:id/ack
```

Smoke Test 已覆盖该链路，验证的只是协议、鉴权、落库和状态回执，不代表真实客户端或 OBS 已接入。
