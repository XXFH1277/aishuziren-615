# Services

当前阶段为前端 Mock 原型，不创建真实请求服务。

Phase 8.5 起，业务页面遵循：

```text
页面组件
↓
service 函数
↓
mock 数据
```

后续接入后端时，请优先替换 service 内部实现，例如从读取 `src/mock` 改为请求后端 API，页面组件尽量不直接感知数据来源变化。

安全约束：

- 不要在前端 service 中读取 `.env.local`。
- 不要在前端 service 中读取 `模型api.txt`。
- 不要在前端 service 中写入或暴露任何真实 API Key。
- Kimi / Mimo 等模型 API Key 只能由后端代理服务读取和调用。

## Phase 12 本地 API 切换预留

当前默认链路仍是：

```text
service -> mock
```

后续逐步切换为：

```text
service -> fetch(`${API_BASE_URL}/api/xxx`)
```

建议：

- `API_BASE_URL` 通过前端环境变量配置，例如 `VITE_API_BASE_URL=http://localhost:3000`。
- 前端环境变量只能存放公开地址，不允许存放 API Key。
- 页面组件尽量继续调用 service 函数，不直接感知 mock 或 API 来源。
- Phase 12 先跑通本地后端 MVP，不强制全量切换前端 service。

## Phase 12.5 商品 Service API 试点

当前已切换：

```text
productService -> fetch(`${API_BASE_URL}/api/products`)
productService -> fetch(`${API_BASE_URL}/api/product-groups`)
```

说明：

- 商品列表、商品详情、创建商品、编辑商品、商品组读取本地 Express + SQLite。
- 本阶段不做静默 Mock fallback；本地 API 未启动时页面会提示“本地 API 服务未连接，请先运行 npm run server:dev”。
- `getProductCategories()`、`getProductStatuses()`、`getProductGroupTypes()` 仍使用前端静态选项。
- 非商品模块暂不切 API；直播间页面如需商品组下拉，仍显式使用 Mock helper，避免扩大试点范围。

## Phase 12.6 数字人 Service API 试点

当前已切换：

```text
avatarService -> fetch(`${API_BASE_URL}/api/avatars`)
avatarService -> fetch(`${API_BASE_URL}/api/avatar-actions`)
```

说明：

- 数字人列表、数字人详情、创建数字人、编辑数字人、动作库读取本地 Express + SQLite。
- 本阶段不做静默 Mock fallback；本地 API 未启动时页面会提示“本地 API 服务未连接，请先运行 npm run server:dev”。
- `getAvatarCategories()`、`getAvatarStatuses()`、`getVoiceOptions()`、`getAvatarActionTypes()` 仍使用前端静态选项。
- 非数字人模块暂不切 API；直播间页面如需数字人下拉，仍显式使用 Mock helper，避免扩大试点范围。

## Phase 12.7 直播管理 Service API 试点

当前已切换：

```text
liveService -> fetch(`${API_BASE_URL}/api/live-rooms`)
liveService -> fetch(`${API_BASE_URL}/api/live-tasks`)
```

说明：

- 直播间列表、直播间详情、创建直播间、编辑直播间、直播任务列表、创建直播任务、修改直播任务状态读取本地 Express + SQLite。
- 本阶段不做静默 Mock fallback；本地 API 未启动时页面会提示“本地 API 服务未连接，请先运行 npm run server:dev”。
- `getLivePlatforms()`、`getLiveRoomStatuses()`、`getLiveTaskStatuses()`、`getExecutorOptions()` 仍使用前端静态选项。
- 直播中控台暂不切 API，仍显式使用 Mock helper，避免扩大试点范围。

## Phase 12.8 系统设置 Service API 试点

当前已切换：

```text
settingsService -> fetch(`${API_BASE_URL}/api/settings/users`)
settingsService -> fetch(`${API_BASE_URL}/api/settings/roles`)
settingsService -> fetch(`${API_BASE_URL}/api/settings/basic`)
settingsService -> fetch(`${API_BASE_URL}/api/settings/logs`)
```

说明：

- 用户列表、角色列表、基础设置读取/保存、操作日志读取本地 Express + SQLite。
- 本阶段不接真实登录系统、真实权限系统或真实通知服务。
- 用户新增/编辑/禁用、角色权限编辑、通知规则读取/编辑/测试仍使用前端 Mock。
- `getNotificationRules()`、`getNotificationChannels()`、`getPermissionTree()`、`getSettingsOptions()` 仍使用前端静态或 Mock 数据。
- 本阶段不做静默 Mock fallback；本地 API 未启动时页面会提示“本地 API 服务未连接，请先运行 npm run server:dev”。

## Phase 12.9 帮助中心 Service API 试点

当前已切换：

```text
helpService -> fetch(`${API_BASE_URL}/api/help/faq`)
helpService -> fetch(`${API_BASE_URL}/api/help/troubleshooting`)
helpService -> fetch(`${API_BASE_URL}/api/help/tickets`)
helpService -> fetch(`${API_BASE_URL}/api/help/tutorials`)
helpService -> fetch(`${API_BASE_URL}/api/help/status`)
helpService -> fetch(`${API_BASE_URL}/api/help/changelog`)
```

说明：

- FAQ、快速排查、技术工单、操作教程、系统状态、更新日志读取本地 Express + SQLite。
- `createTicket()` 会写入本地 SQLite，但不发送邮件、短信、企业微信、飞书、钉钉，也不接真实外部工单系统。
- `getTicketTypes()`、`getTicketUrgencies()`、`getTicketStatuses()`、`getFaqCategories()`、`getTutorialCategories()` 仍使用前端静态选项。
- 工单回复、工单附件、真实文件上传、真实通知推送暂不实现。
- 本阶段不做静默 Mock fallback；本地 API 未启动时页面会提示“本地 API 服务未连接，请先运行 npm run server:dev”。

## Phase 12.10 执行端管理 Service API 试点

当前已切换：

```text
executorService -> fetch(`${API_BASE_URL}/api/executors`)
executorService -> fetch(`${API_BASE_URL}/api/executor-obs`)
executorService -> fetch(`${API_BASE_URL}/api/executor-heartbeats`)
```

说明：

- 执行端列表、执行端详情、OBS 状态列表、单执行端 OBS 状态、心跳日志读取本地 Express + SQLite。
- `bindExecutorMock()`、`restartExecutor()`、`unbindExecutor()`、`refreshExecutorConfig()`、`testExecutorObsConnection()`、`refreshExecutorObsScenes()` 通过本地 API 返回或记录 Mock 指令，不触达真实设备。
- `getExecutorStatusOptions()`、`getHeartbeatLevels()`、`getObsChecklist()` 仍使用前端静态选项或本地 API 返回的检查项兜底。
- 本阶段不接真实 OBS WebSocket、本地执行端、虚拟摄像头、直播伴侣、直播平台或真实 WebSocket 心跳。
- 本阶段不做静默 Mock fallback；本地 API 未启动时页面会提示“本地 API 服务未连接，请先运行 npm run server:dev”。

## Phase 12.13 直播间搭建 Service API 试点

当前已切换：

```text
studioService -> fetch(`${API_BASE_URL}/api/studio/backgrounds`)
studioService -> fetch(`${API_BASE_URL}/api/studio/layouts`)
studioService -> fetch(`${API_BASE_URL}/api/studio/output-status`)
studioService -> fetch(`${API_BASE_URL}/api/studio/backgrounds/generate-mock`)
```

说明：

- AI生成背景、画面布局、OBS输出预留页面读取本地 Express + SQLite。
- `generateStudioBackgroundMock()` 只在本地 SQLite 新增一条 Mock 背景记录，不调用真实图片生成 API。
- `getStudioRoomTypes()`、`getStudioCategories()`、`getStudioVisualStyles()`、`getStudioRatios()`、`getStudioLayers()`、`getOutputMethods()` 仍使用前端静态选项。
- 本阶段不接真实 OBS、OBS WebSocket、虚拟摄像头、直播伴侣、真实执行端、云端推流或真实图片生成服务。
- 本阶段不做静默 Mock fallback；API 未启动时页面提示“本地 API 服务未连接，请先运行 npm run server:dev”。

## Phase 12.14B 延迟播控 Service API 试点

当前已切换：

```text
delayControlService -> fetch(`${API_BASE_URL}/api/delay-control/current`)
delayControlService -> fetch(`${API_BASE_URL}/api/delay-control/queue`)
delayControlService -> fetch(`${API_BASE_URL}/api/delay-control/subtitles`)
delayControlService -> fetch(`${API_BASE_URL}/api/delay-control/settings`)
```

说明：

- 当前播报、待播队列、字幕预览、播控设置页面读取本地 Express + SQLite。
- 待播队列的通过、驳回、修改、删除、插队，以及字幕样式保存、播控设置保存都只写本地 SQLite 或返回 Mock 成功结果。
- `getSpeechActions()`、`getSpeechTones()`、`getReviewStatuses()`、`getDelayModes()` 等选项仍使用前端静态选项。
- 直播中控台聚合页暂不切 API，仍保留同步 Mock helper，避免扩大本阶段范围。
- 本阶段不接真实数字人播报、TTS、口型同步、OBS、执行端、WebSocket 或直播平台。
- 本阶段不做静默 Mock fallback；API 未启动时页面提示“本地 API 服务未连接，请先运行 npm run server:dev”。

## Phase 12.15 AI能力中心 Service API 试点

当前已切换：

```text
aiService -> fetch(`${API_BASE_URL}/api/ai/assistant`)
aiService -> fetch(`${API_BASE_URL}/api/ai/models`)
aiService -> fetch(`${API_BASE_URL}/api/ai/models/defaults`)
aiService -> fetch(`${API_BASE_URL}/api/ai/prompts`)
aiService -> fetch(`${API_BASE_URL}/api/ai/logs`)
aiService -> fetch(`${API_BASE_URL}/api/ai/costs`)
```

说明：

- AI助理设置、模型服务配置、Prompt模板、调用日志、成本监控页面读取本地 Express + SQLite。
- 模型配置保存、模型连接测试、默认模型设置、Prompt编辑/复制、成本预算保存均为本地 Mock API，不调用 Kimi、Mimo、OpenAI 或任何真实模型服务。
- `PUT /api/ai/models/:id` 会忽略 `apiKey` / `key` / `secret` 字段；当前不保存明文密钥。
- 真实密钥后续必须走后端凭据接口和脱敏存储，前端只显示 `apiKeyConfigured`、`apiKeyMasked`、`credentialRef` 等安全状态。
- `getModelStatusOptions()`、`getModelUsageScenes()`、`getPromptCategories()`、`getPromptTemplateStatuses()`、`getPromptVariables()` 仍使用前端静态选项。
- 本阶段不做静默 Mock fallback；API 未启动时页面提示“本地 API 服务未连接，请先运行 npm run server:dev”。
- 本阶段不做静默 Mock fallback；API 未启动时页面提示“本地 API 服务未连接，请先运行 npm run server:dev”。

## Phase 12.16 直播中控台聚合 Service API 试点

当前已切换：

```text
liveControlRoomService -> fetch(`${API_BASE_URL}/api/live/control-room/overview`)
liveControlRoomService -> fetch(`${API_BASE_URL}/api/live/control-room/comments`)
liveControlRoomService -> fetch(`${API_BASE_URL}/api/live/control-room/questions`)
liveControlRoomService -> fetch(`${API_BASE_URL}/api/live/control-room/broadcast`)
liveControlRoomService -> fetch(`${API_BASE_URL}/api/live/control-room/manual-speech`)
liveControlRoomService -> fetch(`${API_BASE_URL}/api/live/control-room/speech-queue/:id`)
```

说明：

- `/live/control-room` 现在通过聚合 API 读取直播任务、直播间、OBS输出状态、弹幕、问题、当前播报、待播队列、字幕和风险提示。
- 聚合 API 不新增业务表，复用已落地的 `live_tasks`、`live_rooms`、`comments`、`questions`、`manual_takeover_state`、`delay_control_state`、`speech_queue`、`subtitle_settings`、`studio_output_status`。
- 人工播报和待播队列操作仍是本地 Mock API，不调用真实数字人、TTS、OBS、执行端或直播平台。
- 弹幕模拟继续使用 dev-only `/api/dev/interaction/comments/simulate`，不接真实 WebSocket。
- 互动播控、延迟播控的功能管理页继续走各自 service；中控台只作为运行态聚合页。
