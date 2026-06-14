# 2026-06-05 OBS WebSocket 状态接入交接

## 1. 本次目标

在现有执行端通信协议 MVP 上，给 `executor-client` 接入真实 OBS WebSocket 读状态能力，让以下命令由本地执行端真实连接 OBS 并回执：

```text
obs_test
refresh_obs_scenes
```

本次只做 OBS 连接、版本读取、当前场景读取、场景来源读取和状态回报；不做 OBS 控制、推流、数字人画面、TTS、口型同步或直播平台接入。

## 2. 前置条件

- 本机安装 OBS 28+。
- OBS 设置中启用 obs-websocket。
- 默认地址：`ws://127.0.0.1:4455`。
- 如 OBS 配置了密码，需要在执行端本地配置 `OBS_PASSWORD`。

## 3. 新增依赖

仅在 `executor-client/` 子包中安装：

```text
obs-websocket-js
```

未修改根项目 `package.json`，不污染前端 / 后端依赖。

## 4. executor-client 变化

修改：

```text
executor-client/src/index.js
executor-client/package.json
executor-client/package-lock.json
executor-client/config.example.json
executor-client/README.md
```

新增配置项：

```json
{
  "obsUrl": "ws://127.0.0.1:4455",
  "obsPassword": "",
  "obsTimeoutMs": 5000
}
```

支持环境变量：

```text
OBS_URL
OBS_PASSWORD
OBS_TIMEOUT_MS
```

实现内容：

- `obs_test`：连接 OBS，读取 OBS 版本和当前场景，成功则回执 `succeeded`，失败则回执 `failed`。
- `refresh_obs_scenes`：连接 OBS，读取场景列表、当前场景、每个场景的来源，并把数据放入 ack `detail`。
- `restart` / `refresh_config` / `unbind`：保持原有“打印 + 回执”行为。
- 心跳会带上 OBS 连接状态，状态值统一为中文：
  - 执行端状态：`在线` / `离线` / `直播中` / `异常`
  - OBS 状态：`已连接` / `未连接` / `连接异常`
- OBS 连接失败不会让客户端退出，会按现有退避逻辑继续运行。
- OBS 密码不打印到日志，不写入仓库。

## 5. 后端变化

修改：

```text
server/routes/executors.js
server/tests/smoke-test.js
```

实现内容：

- 执行端心跳入库前做状态归一：
  - `online` → `在线`
  - `connected` / `enabled` → `已连接`
  - `error` / `failed` → `连接异常`
- `POST /api/executors/commands/:id/ack` 在接收到 `obs_test` 或 `refresh_obs_scenes` 的 `detail` 后，会 upsert 到：

```text
executor_obs_status
```

写入字段包括：

- OBS 状态
- OBS 版本
- 当前场景
- 来源数量
- 虚拟摄像头状态
- 错误信息
- 场景来源 JSON
- 最近连接时间

## 6. 前端变化

修改：

```text
src/pages/executors/ExecutorList.jsx
src/pages/executors/ObsStatus.jsx
src/components/StatusTag.jsx
```

实现内容：

- 执行端列表增加：
  - `OBS测试`
  - `刷新场景`
- 两个操作会下发对应命令：
  - `POST /api/executors/:id/obs/test`
  - `POST /api/executors/:id/obs/refresh-scenes`
- 执行端列表继续显示“最近命令”，用于观察 pending / succeeded / failed。
- OBS 状态页文案改为“由本地执行端回执”，不再描述为纯 Mock。
- 来源弹窗显示场景名和来源类型。
- `StatusTag` 增加 `连接异常` 显示。

## 7. 端到端验收步骤

1. 启动 OBS，并在 OBS 设置中启用 obs-websocket。
2. 启动后端：`npm run server:dev`。
3. 启动前端：`npm run dev`。
4. 在执行端列表生成绑定码。
5. 配置并启动 `executor-client`：

```powershell
$env:BIND_CODE="BIND-XXXXYYYY"
$env:OBS_URL="ws://127.0.0.1:4455"
$env:OBS_PASSWORD="本机 OBS WebSocket 密码"
npm start
```

6. 后台对该执行端点击 `OBS测试`。
7. 客户端连接 OBS，读取版本和当前场景并回执。
8. 后台对该执行端点击 `刷新场景`。
9. 客户端读取场景列表和来源并回执。
10. 进入执行端管理 / OBS连接状态，确认能看到真实场景和来源。

## 8. 测试结果

```text
npm run server:seed：通过
npm run server:smoke：通过，118 项
npm run build：通过
node --check executor-client/src/index.js：通过
node --check server/routes/executors.js：通过
node --check server/tests/smoke-test.js：通过
```

Smoke Test 新增覆盖：

- 心跳英文状态归一为中文。
- OBS 场景回执写入 `executor_obs_status`。
- 读取写入后的 OBS 当前场景和来源。

## 9. 安全确认

- 未读取 `.env.local`。
- 未读取 `模型api.txt`。
- 未提交真实 OBS 密码。
- 未提交真实 device token。
- 未提交 SQLite 数据库文件。
- OBS 密码只允许放在执行端本地环境变量或 `config.local.json`。
- `config.local.json` 和 `.device.json` 均在 `.gitignore` 中。

## 10. 当前边界

仍未实现：

- OBS 场景切换。
- OBS 来源创建 / 修改 / 删除。
- 虚拟摄像头控制。
- 数字人画面渲染。
- TTS。
- 口型同步。
- 推流。
- 直播平台接口。

## 11. 参考

- `obs-websocket-js` v5 README：连接使用 `connect(url, password)`，请求使用 `call(requestType, data)`。
- OBS WebSocket v5 常用请求：`GetVersion`、`GetCurrentProgramScene`、`GetSceneList`、`GetSceneItemList`。
