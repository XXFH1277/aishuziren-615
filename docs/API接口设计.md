# API接口设计

Phase：11  
状态：设计文档，暂不实现后端代码  
适用前端：当前 React + Vite 后台原型  
目标后端：后续本地 Node 后端 + SQLite  

## 1. 设计原则

- API 统一前缀：`/api`
- 当前只做设计，不写 Express / Node 后端代码。
- 当前不接数据库，不创建 SQLite 文件。
- 当前不调用 Kimi / Mimo，不读取 `模型api.txt`，不读取 `.env.local`。
- 前端页面继续遵循：页面组件 -> Service 层 -> Mock 数据。
- 后续 Phase 13 真实化时，优先替换 `src/services/*.js` 内部实现，页面尽量不改。

## 2. 通用响应格式

成功：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

失败：

```json
{
  "code": 40001,
  "message": "参数错误",
  "data": null,
  "requestId": "req_mock_001"
}
```

分页：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [],
    "total": 100,
    "page": 1,
    "pageSize": 20
  }
}
```

## 3. 通用错误码

| code | 含义 | 场景 |
| --- | --- | --- |
| 0 | 成功 | 请求成功 |
| 40001 | 参数错误 | Query / Body 不合法 |
| 40101 | 未登录 | 缺少登录态、token 失效或会话过期 |
| 40301 | 无权限 | 角色权限不足 |
| 40401 | 资源不存在 | id 不存在 |
| 40900 | 状态冲突 | 重复提交、状态不允许 |
| 50001 | 服务异常 | 后端未知错误 |

## 4. Phase 11 Review 修正规则

### 4.1 Response 包装统一

详情接口统一使用命名对象包装，不直接把详情对象平铺到 `data`：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "product": {}
  }
}
```

常用详情字段命名：

- `data.product`
- `data.avatar`
- `data.liveRoom`
- `data.liveTask`
- `data.executor`
- `data.ticket`
- `data.settings`

列表接口统一使用：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [],
    "total": 100,
    "page": 1,
    "pageSize": 20
  }
}
```

### 4.2 时间筛选参数统一

所有时间范围筛选统一使用：

- `startTime`
- `endTime`

不要再使用：

- `timeRange`
- `dateRange`
- `page` 表示调用页面

AI 调用日志中的“调用页面”字段统一命名为：

- `sourcePage`

### 4.3 分页和实时流规则

普通列表统一使用：

- `page`
- `pageSize`

实时流统一使用：

- `cursor`
- `sinceId`
- `limit`

需要补充分页的列表接口包括：

- `/api/avatar-actions`
- `/api/studio/backgrounds`
- `/api/studio/layouts`
- `/api/ai/prompts`
- `/api/help/faq`
- `/api/help/troubleshooting`
- `/api/help/tutorials`
- `/api/help/changelog`
- `/api/settings/roles`
- `/api/settings/notifications`

直播弹幕流建议使用 `cursor / sinceId / limit`，不要使用传统页码分页。

### 4.4 关联字段命名规则

涉及关联对象时，API Response 建议同时保留 id 和 name：

- `executorId` + `executorName`
- `productId` + `productName`
- `liveRoomId` + `liveRoomName`
- `liveTaskId` + `liveTaskName`
- `avatarId` + `avatarName`
- `productGroupId` + `productGroupName`

### 4.5 权限 key 对照表

| 模块 | 权限 key | 说明 |
| --- | --- | --- |
| 商品 | `product:read` | 查看商品、商品组 |
| 商品 | `product:write` | 新增、编辑、上下架、复制商品 |
| 商品 | `product:delete` | 删除或归档商品 |
| 数字人 | `avatar:read` | 查看数字人和动作库 |
| 数字人 | `avatar:write` | 新增、编辑、复制、测试数字人 |
| 数字人 | `avatar:delete` | 删除或归档数字人 |
| 直播 | `live:room:read` | 查看直播间 |
| 直播 | `live:room:write` | 新增、编辑、复制、启停直播间 |
| 直播 | `live:task:read` | 查看直播任务 |
| 直播 | `live:task:write` | 新建、编辑直播任务 |
| 直播 | `live:task:start` | 启动直播任务 |
| 直播 | `live:task:stop` | 暂停、结束直播任务 |
| 互动播控 | `interaction:read` | 查看弹幕、问题、人工接管状态 |
| 互动播控 | `interaction:write` | 处理弹幕、编辑回复、加入待播 |
| 互动播控 | `live:manual-takeover` | 直播中人工接管播报 |
| 互动播控 | `speech:read` | 查看当前播报、待播队列、字幕 |
| 互动播控 | `speech:review` | 通过、驳回、标记风险 |
| 互动播控 | `speech:write` | 修改、删除、插队待播内容 |
| 执行端 | `executor:read` | 查看执行端、OBS、心跳 |
| 执行端 | `executor:restart` | 重启执行端 |
| 执行端 | `executor:unbind` | 解绑执行端 |
| 执行端 | `executor:obs:operate` | OBS 测试连接、刷新场景、重启连接 |
| AI | `ai:model:read` | 查看模型配置 |
| AI | `ai:model:write` | 保存模型配置 |
| AI | `ai:model:test` | 测试模型连接 |
| AI | `ai:prompt:read` | 查看 Prompt 模板 |
| AI | `ai:prompt:write` | 新增、编辑、复制、停用 Prompt 模板 |
| AI | `ai:logs:read` | 查看 AI 调用日志 |
| AI | `ai:costs:read` | 查看 AI 成本监控 |
| 系统设置 | `settings:user:read` | 查看用户 |
| 系统设置 | `settings:user:write` | 新增、编辑、启禁用户 |
| 系统设置 | `settings:user:reset-password` | 重置用户密码 |
| 系统设置 | `settings:role:read` | 查看角色权限 |
| 系统设置 | `settings:role:write` | 编辑角色权限 |
| 系统设置 | `settings:basic:write` | 保存基础设置 |
| 系统设置 | `settings:logs:read` | 查看操作日志 |
| 帮助中心 | `help:read` | 查看 FAQ、教程、状态、更新日志 |
| 帮助中心 | `ticket:read` | 查看工单 |
| 帮助中心 | `ticket:write` | 创建、关闭工单 |
| 帮助中心 | `ticket:reply` | 回复工单 |

## 5. Auth API 登录态

说明：Phase 13 已落地本地 Auth / RBAC MVP，使用 SQLite 用户、密码 hash、Bearer token 和 `auth_sessions` 表。该能力用于本地开发闭环，仍未达到生产级登录安全要求。
对应前端：登录页、Header 当前用户、菜单权限过滤、页面入口 403。

| 接口名称 | Method | Path | 用途说明 | 请求参数 | 返回字段 | 成功示例 | 失败示例 | 登录 | 权限 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 登录 | POST | `/api/auth/login` | 后台账号登录 | Body: `username`, `password` | `user`, `roles`, `permissions`, `menuPermissions`, `token`, `sessionExpiresAt` | `{"code":0,"data":{"user":{"id":"U001"},"token":"...","permissions":["product:read"]}}` | `{"code":40101,"message":"账号或密码错误"}` | 否 | 无 |
| 退出登录 | POST | `/api/auth/logout` | 清理登录态 | Header: `Authorization: Bearer <token>` | `success` | `{"code":0,"data":{"success":true}}` | `{"code":50001,"message":"退出失败"}` | 是 | 无 |
| 当前用户 | GET | `/api/auth/me` | 获取当前用户、角色和权限 | Header: `Authorization: Bearer <token>` | `user`, `roles`, `permissions` | `{"code":0,"data":{"user":{"id":"U001"},"roles":[],"permissions":[]}}` | `{"code":40101,"message":"请先登录"}` | 是 | 无 |
| 刷新登录状态 | POST | `/api/auth/refresh` | 延长登录会话 | Header: `Authorization: Bearer <token>` | `sessionExpiresAt` | `{"code":0,"data":{"sessionExpiresAt":"2026-05-27 23:59:59"}}` | `{"code":40101,"message":"登录已过期"}` | 是 | 无 |

## 6. Dashboard API 首页工作台

对应前端：首页工作台
对应未来 Service：`getDashboardOverview()`
对应当前 Mock：`src/mock/dashboard.js`

| 接口名称 | Method | Path | 用途说明 | 请求参数 | 返回字段 | 成功示例 | 失败示例 | 登录 | 权限 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 获取首页概览 | GET | `/api/dashboard/overview` | 获取首页工作台统计数据、AI 调用状态和最近操作记录 | 无 | `todayLiveTaskCount`, `onlineExecutorCount`, `pendingSpeechReviewCount`, `todayCommentCount`, `aiCallStatus`, `recentOperations` | `{"code":0,"data":{"overview":{"todayLiveTaskCount":3,"onlineExecutorCount":4,"pendingSpeechReviewCount":6,"todayCommentCount":128,"aiCallStatus":"正常","recentOperations":[]}}}` | `{"code":50000,"message":"首页统计读取失败"}` | 是 | `live:task:read` |

## 7. File API 文件上传

说明：Phase 14 已实现本地真实上传 MVP，文件保存到 `server/uploads`，元信息写入 `file_assets`。Phase 17 已扩展到数字人素材、数字人授权文件和系统 Logo。当前不接云存储、不做病毒扫描。
适用场景：商品图片、数字人素材、授权文件、直播间背景、工单截图、系统 Logo。
当前允许类型：PNG、JPG、WEBP、GIF、PDF、TXT、MP4、WEBM、MOV、MP3、WAV、M4A、AAC；单文件最大 5MB。

| 接口名称 | Method | Path | 用途说明 | 请求参数 | 返回字段 | 成功示例 | 失败示例 | 登录 | 权限 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 上传文件 | POST | `/api/files/upload` | 上传业务附件或素材 | `multipart/form-data`: `file`, `module`, `businessId`, `fileType`。常用 `module`: `product`、`ticket`、`avatar`、`avatar_authorization`、`settings`；常用 `fileType`: `image`、`video`、`audio`、`document`、`logo` | `fileId`, `fileName`, `fileUrl`, `fileType`, `size`, `mimeType`, `uploadedAt` | `{"code":0,"data":{"file":{"fileId":"FILE001","fileName":"demo.png","fileUrl":"/uploads/avatar/FILE001-demo.png","fileType":"image","size":102400,"mimeType":"image/png","uploadedAt":"2026-05-26 23:30:00"},"mock":false}}` | `{"code":40001,"message":"文件类型不支持"}` | 是 | 当前仅校验登录 token |

## 8. Product API 商品管理

对应 Service：`src/services/productService.js`  
对应 Mock：`src/mock/products.js`、`src/mock/productGroups.js`

| 接口名称 | Method | Path | 用途说明 | 请求参数 | 返回字段 | 成功示例 | 失败示例 | 登录 | 权限 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 获取商品列表 | GET | `/api/products` | 获取商品列表，支持搜索、分类、状态和分页 | Query: `keyword`, `category`, `status`, `page`, `pageSize` | `list`, `total`, `page`, `pageSize` | `{"code":0,"data":{"list":[],"total":8}}` | `{"code":40001,"message":"分页参数错误"}` | 是 | 商品查看 |
| 获取商品详情 | GET | `/api/products/:id` | 获取单个商品详情，用于编辑页回填 | Params: `id` | `product` | `{"code":0,"data":{"id":"P001","name":"舟山海鲜礼盒"}}` | `{"code":40400,"message":"商品不存在"}` | 是 | 商品查看 |
| 创建商品 | POST | `/api/products` | 创建商品草稿或正式商品 | Body: 商品基础信息、规格、卖点、话术、禁用表达 | `id`, `product` | `{"code":0,"data":{"id":"P009"}}` | `{"code":40001,"message":"商品名称不能为空"}` | 是 | 商品新增 |
| 更新商品 | PUT | `/api/products/:id` | 保存商品编辑内容 | Params: `id`; Body: 商品完整结构 | `product` | `{"code":0,"data":{"id":"P001"}}` | `{"code":40400,"message":"商品不存在"}` | 是 | 商品编辑 |
| 更新商品状态 | PATCH | `/api/products/:id/status` | 上架、下架、保存草稿 | Params: `id`; Body: `status` | `id`, `status` | `{"code":0,"data":{"id":"P001","status":"已下架"}}` | `{"code":40900,"message":"当前状态不允许操作"}` | 是 | 商品编辑 |
| 复制商品 | POST | `/api/products/:id/copy` | 复制商品资料生成新草稿 | Params: `id` | `id`, `sourceId` | `{"code":0,"data":{"id":"P010","sourceId":"P001"}}` | `{"code":40400,"message":"商品不存在"}` | 是 | 商品新增 |
| 获取商品组列表 | GET | `/api/product-groups` | 获取商品组卡片 / 列表数据 | Query: `type`, `keyword`, `page`, `pageSize` | `list`, `total` | `{"code":0,"data":{"list":[],"total":5}}` | `{"code":40001,"message":"参数错误"}` | 是 | 商品组查看 |
| 创建商品组 | POST | `/api/product-groups` | 新建商品组 | Body: `name`, `type`, `productIds`, `mainProductId`, `liveRoomScope` | `id`, `group` | `{"code":0,"data":{"id":"G006"}}` | `{"code":40001,"message":"商品组名称不能为空"}` | 是 | 商品组新增 |
| 更新商品组 | PUT | `/api/product-groups/:id` | 更新商品组配置 | Params: `id`; Body: 商品组字段 | `group` | `{"code":0,"data":{"id":"G001"}}` | `{"code":40400,"message":"商品组不存在"}` | 是 | 商品组编辑 |
| 商品 AI 文案生成 | POST | `/api/products/:id/ai-copy` | 为商品生成简介、卖点、口播、FAQ 或合规改写 | Params: `id`; Body: `target`, `style`, `length`, `complianceCheck` | `content`, `riskTips` | `{"code":0,"data":{"content":"Mock文案"}}` | `{"code":40900,"message":"模型服务未配置"}` | 是 | AI文案使用 |

当前对应 Service 函数：`getProducts()`、`getProductById(id)`、`getProductCategories()`、`getProductStatuses()`、`getProductGroups()`、`getProductGroupTypes()`

## 9. Avatar API 数字人管理

对应 Service：`src/services/avatarService.js`  
对应 Mock：`src/mock/avatars.js`、`src/mock/avatarActions.js`

| 接口名称 | Method | Path | 用途说明 | 请求参数 | 返回字段 | 成功示例 | 失败示例 | 登录 | 权限 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 获取数字人列表 | GET | `/api/avatars` | 获取数字人资产列表 | Query: `keyword`, `status`, `category`, `voiceName`, `page`, `pageSize` | `list`, `total` | `{"code":0,"data":{"list":[],"total":6}}` | `{"code":40001,"message":"筛选参数错误"}` | 是 | 数字人查看 |
| 获取数字人详情 | GET | `/api/avatars/:id` | 获取创建 / 编辑页回填数据 | Params: `id` | `avatar` | `{"code":0,"data":{"id":"A001","name":"海岛好物推荐官"}}` | `{"code":40400,"message":"数字人不存在"}` | 是 | 数字人查看 |
| 创建数字人 | POST | `/api/avatars` | 创建数字人配置 | Body: 基础信息、形象、声音、行为、素材、授权 | `id`, `avatar` | `{"code":0,"data":{"id":"A007"}}` | `{"code":40001,"message":"数字人名称不能为空"}` | 是 | 数字人新增 |
| 更新数字人 | PUT | `/api/avatars/:id` | 保存数字人配置 | Params: `id`; Body: 完整数字人配置 | `avatar` | `{"code":0,"data":{"id":"A001"}}` | `{"code":40400,"message":"数字人不存在"}` | 是 | 数字人编辑 |
| 删除数字人 | DELETE | `/api/avatars/:id` | 删除或归档数字人 | Params: `id` | `id` | `{"code":0,"data":{"id":"A006"}}` | `{"code":40900,"message":"数字人已绑定直播间"}` | 是 | 数字人删除 |
| 复制数字人 | POST | `/api/avatars/:id/copy` | 复制数字人配置 | Params: `id` | `id`, `sourceId` | `{"code":0,"data":{"id":"A008","sourceId":"A001"}}` | `{"code":40400,"message":"数字人不存在"}` | 是 | 数字人新增 |
| 测试数字人 | POST | `/api/avatars/:id/test` | 测试话术、语气、动作预览 | Params: `id`; Body: `script`, `tone`, `action` | `previewText`, `status` | `{"code":0,"data":{"status":"预览中"}}` | `{"code":40900,"message":"执行端未连接"}` | 是 | 数字人测试 |
| 获取动作库 | GET | `/api/avatar-actions` | 获取全局动作模板 | Query: `type`, `status`, `page`, `pageSize` | `list`, `total`, `page`, `pageSize` | `{"code":0,"data":{"list":[],"total":10,"page":1,"pageSize":20}}` | `{"code":40001,"message":"参数错误"}` | 是 | 动作查看 |
| 新建动作 | POST | `/api/avatar-actions` | 新建动作模板 | Body: `name`, `type`, `triggerScene`, `suitableTone`, `description` | `id`, `action` | `{"code":0,"data":{"id":"ACT011"}}` | `{"code":40001,"message":"动作名称不能为空"}` | 是 | 动作新增 |
| 预览动作 | POST | `/api/avatar-actions/:id/preview` | 预览动作模板效果 | Params: `id` | `previewStatus` | `{"code":0,"data":{"previewStatus":"预览中"}}` | `{"code":40400,"message":"动作不存在"}` | 是 | 动作查看 |

当前对应 Service 函数：`getAvatars()`、`getAvatarById(id)`、`getAvatarCategories()`、`getAvatarStatuses()`、`getVoiceOptions()`、`getAvatarActions()`、`getAvatarActionTypes()`

## 10. Live API 直播管理

对应 Service：`src/services/liveService.js`  
对应 Mock：`src/mock/liveRooms.js`、`src/mock/liveTasks.js`

| 接口名称 | Method | Path | 用途说明 | 请求参数 | 返回字段 | 成功示例 | 失败示例 | 登录 | 权限 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 获取直播间列表 | GET | `/api/live-rooms` | 获取直播间配置列表 | Query: `keyword`, `platform`, `status`, `avatarId`, `productGroupId`, `page`, `pageSize` | `list`, `total` | `{"code":0,"data":{"list":[],"total":6}}` | `{"code":40001,"message":"筛选参数错误"}` | 是 | 直播间查看 |
| 获取直播间详情 | GET | `/api/live-rooms/:id` | 获取直播间编辑页回填 | Params: `id` | `liveRoom` | `{"code":0,"data":{"id":"LR001"}}` | `{"code":40400,"message":"直播间不存在"}` | 是 | 直播间查看 |
| 创建直播间 | POST | `/api/live-rooms` | 创建直播间配置 | Body: 基础信息、平台、数字人、商品组、场景、互动、播控 | `id`, `liveRoom` | `{"code":0,"data":{"id":"LR007"}}` | `{"code":40001,"message":"直播间名称不能为空"}` | 是 | 直播间新增 |
| 更新直播间 | PUT | `/api/live-rooms/:id` | 保存直播间配置 | Params: `id`; Body: 完整配置 | `liveRoom` | `{"code":0,"data":{"id":"LR001"}}` | `{"code":40400,"message":"直播间不存在"}` | 是 | 直播间编辑 |
| 更新直播间状态 | PATCH | `/api/live-rooms/:id/status` | 启用、停用直播间 | Params: `id`; Body: `status` | `id`, `status` | `{"code":0,"data":{"id":"LR001","status":"停用"}}` | `{"code":40900,"message":"直播中不可停用"}` | 是 | 直播间编辑 |
| 复制直播间 | POST | `/api/live-rooms/:id/copy` | 复制直播间配置 | Params: `id` | `id`, `sourceId` | `{"code":0,"data":{"id":"LR008","sourceId":"LR001"}}` | `{"code":40400,"message":"直播间不存在"}` | 是 | 直播间新增 |
| 获取直播任务列表 | GET | `/api/live-tasks` | 获取直播任务列表 | Query: `keyword`, `status`, `liveRoomId`, `executorId`, `executorName`, `startTime`, `endTime`, `page`, `pageSize` | `list`, `total`, `page`, `pageSize` | `{"code":0,"data":{"list":[],"total":8,"page":1,"pageSize":20}}` | `{"code":40001,"message":"时间范围错误"}` | 是 | 直播任务查看 |
| 创建直播任务 | POST | `/api/live-tasks` | 创建一次具体直播任务 | Body: `taskName`, `liveRoomId`, `scheduledStartTime`, `executorName`, `notes` | `id`, `task` | `{"code":0,"data":{"id":"LT009"}}` | `{"code":40001,"message":"直播间不能为空"}` | 是 | 直播任务新增 |
| 更新任务状态 | PATCH | `/api/live-tasks/:id/status` | 启动、暂停、结束、复盘任务 | Params: `id`; Body: `status`, `reason` | `id`, `status` | `{"code":0,"data":{"id":"LT001","status":"直播中"}}` | `{"code":40900,"message":"执行端离线"}` | 是 | 直播任务操作 |
| 基于直播间创建任务 | POST | `/api/live-rooms/:id/tasks` | 从直播间列表快速创建任务 | Params: `id`; Body: 任务基础字段 | `id`, `task` | `{"code":0,"data":{"id":"LT010"}}` | `{"code":40400,"message":"直播间不存在"}` | 是 | 直播任务新增 |

当前对应 Service 函数：`getLiveRooms()`、`getLiveRoomById(id)`、`getLivePlatforms()`、`getLiveRoomStatuses()`、`getLiveTasks()`、`getLiveTaskStatuses()`、`getExecutorOptions()`

## 11. Studio API 直播间搭建

对应 Service：`src/services/studioService.js`  
对应 Mock：`src/mock/studioBackgrounds.js`、`src/mock/studioLayouts.js`、`src/mock/studioOutput.js`

| 接口名称 | Method | Path | 用途说明 | 请求参数 | 返回字段 | 成功示例 | 失败示例 | 登录 | 权限 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 获取背景列表 | GET | `/api/studio/backgrounds` | 获取 AI 背景 Mock 结果或已保存背景 | Query: `category`, `style`, `ratio`, `status`, `page`, `pageSize` | `list`, `total`, `page`, `pageSize` | `{"code":0,"data":{"list":[],"total":4,"page":1,"pageSize":20}}` | `{"code":40001,"message":"参数错误"}` | 是 | 搭建查看 |
| 生成背景 | POST | `/api/studio/backgrounds/generate-mock` | 根据 Prompt 生成 Mock 背景方案，当前不调用真实图片生成 API | Body: 背景生成表单字段 | `background`, `mock` | `{"code":0,"data":{"background":{"id":"SB007"},"mock":true}}` | `{"code":40001,"message":"参数错误"}` | 是 | 背景生成 |
| 应用背景 | POST | `/api/studio/backgrounds/:id/apply` | 将背景应用到布局 | Params: `id`; Body: `layoutId`, `liveRoomId` | `id`, `status` | `{"code":0,"data":{"id":"SB001","status":"已应用"}}` | `{"code":40400,"message":"背景不存在"}` | 是 | 搭建编辑 |
| 删除背景 | DELETE | `/api/studio/backgrounds/:id` | 删除背景方案 | Params: `id` | `id` | `{"code":0,"data":{"id":"SB001"}}` | `{"code":40900,"message":"背景已被使用"}` | 是 | 搭建删除 |
| 获取布局模板 | GET | `/api/studio/layouts` | 获取布局模板和图层信息 | Query: `ratio`, `status`, `page`, `pageSize` | `list`, `total`, `page`, `pageSize` | `{"code":0,"data":{"list":[],"total":6,"page":1,"pageSize":20}}` | `{"code":40001,"message":"参数错误"}` | 是 | 布局查看 |
| 应用布局 | POST | `/api/studio/layouts/:id/apply` | 应用布局模板到直播间 | Params: `id`; Body: `liveRoomId` | `id`, `status` | `{"code":0,"data":{"id":"SL001","status":"已应用"}}` | `{"code":40400,"message":"布局不存在"}` | 是 | 布局编辑 |
| 获取 OBS 输出状态 | GET | `/api/studio/output-status` | 获取 OBS 输出预留状态 | Query: `liveRoomId` | `outputStatus` | `{"code":0,"data":{"outputStatus":{"obsStatus":"未连接"}}}` | `{"code":40001,"message":"直播间参数错误"}` | 是 | 输出查看 |
| 测试 OBS 连接 | POST | `/api/studio/output/test-connection` | 测试 OBS 连接，后续由后端 / 执行端代理 | Body: `executorId`, `mode` | `status`, `message` | `{"code":0,"data":{"status":"测试中"}}` | `{"code":40900,"message":"执行端未在线"}` | 是 | 输出操作 |
| 发送预览画面 | POST | `/api/studio/output/preview` | 将预览画面发送到输出链路 | Body: `liveRoomId`, `layoutId` | `status` | `{"code":0,"data":{"status":"预览中"}}` | `{"code":40900,"message":"OBS未连接"}` | 是 | 输出操作 |

当前对应 Service 函数：`getStudioBackgrounds()`、`getStudioRoomTypes()`、`getStudioCategories()`、`getStudioVisualStyles()`、`getStudioRatios()`、`getStudioLayouts()`、`getStudioLayers()`、`getStudioOutput()`、`getOutputMethods()`

## 12. Interaction Control API 互动播控

对应 Service：`src/services/interactionService.js`、`src/services/delayControlService.js`  
对应 Mock：`src/mock/comments.js`、`src/mock/questions.js`、`src/mock/manualTakeover.js`、`src/mock/delayControl.js`、`src/mock/speechQueue.js`、`src/mock/subtitles.js`、`src/mock/delaySettings.js`

| 接口名称 | Method | Path | 用途说明 | 请求参数 | 返回字段 | 成功示例 | 失败示例 | 登录 | 权限 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 获取弹幕列表 | GET | `/api/interaction/comments` | 获取弹幕捕获记录 | Query: `liveRoomId`, `type`, `riskLevel`, `replyStatus`, `page`, `pageSize` | `list`, `total`, `connection` | `{"code":0,"data":{"list":[],"total":12}}` | `{"code":40900,"message":"弹幕服务未连接"}` | 是 | 弹幕查看 |
| 模拟新弹幕 | POST | `/api/dev/interaction/comments/simulate` | 开发阶段追加一条弹幕，仅 dev 环境可用，正式环境禁用 | Body: `liveRoomId` | `comment` | `{"code":0,"data":{"comment":{"id":"C013"}}}` | `{"code":40300,"message":"正式环境禁用调试接口"}` | 是 | 弹幕调试 |
| 加入问题队列 | POST | `/api/interaction/comments/:id/to-question` | 将弹幕转为问题 | Params: `id`; Body: `relatedProduct`, `type` | `questionId` | `{"code":0,"data":{"questionId":"Q009"}}` | `{"code":40400,"message":"弹幕不存在"}` | 是 | 问题处理 |
| 忽略弹幕 | PATCH | `/api/interaction/comments/:id/ignore` | 标记弹幕为忽略 | Params: `id`; Body: `reason` | `id`, `replyStatus` | `{"code":0,"data":{"id":"C001","replyStatus":"已忽略"}}` | `{"code":40400,"message":"弹幕不存在"}` | 是 | 问题处理 |
| 获取问题队列 | GET | `/api/interaction/questions` | 获取问题处理队列 | Query: `liveRoomId`, `status`, `riskLevel`, `type` | `list`, `total` | `{"code":0,"data":{"list":[],"total":8}}` | `{"code":40001,"message":"参数错误"}` | 是 | 问题查看 |
| 生成推荐回复 | POST | `/api/interaction/questions/:id/reply` | 生成或更新 AI 推荐回复，当前只返回 Mock 回复，不调用真实模型 | Params: `id`; Body: `replyText`, `style`, `length` | `question`, `mock` | `{"code":0,"data":{"question":{"aiReply":"Mock回复"},"mock":true}}` | `{"code":40400,"message":"问题不存在"}` | 是 | AI回复使用 |
| 编辑回复 | PATCH | `/api/interaction/questions/:id/reply` | 修改问题回复内容 | Params: `id`; Body: `replyText` | `id`, `aiReply`, `status` | `{"code":0,"data":{"status":"已编辑"}}` | `{"code":40400,"message":"问题不存在"}` | 是 | 问题编辑 |
| 加入待播队列 | POST | `/api/interaction/questions/:id/add-to-queue` | 将回复送入待播队列，当前只做本地 Mock 状态更新 | Params: `id`; Body: `action`, `tone`, `scheduledMode` | `question`, `mock` | `{"code":0,"data":{"question":{"status":"已加入待播"},"mock":true}}` | `{"code":40900,"message":"高风险内容需人工确认"}` | 是 | 播控操作 |
| 获取人工接管状态 | GET | `/api/interaction/manual-takeover` | 获取直播状态、推荐回复和待播预览 | Query: `liveRoomId` | `manualTakeover` | `{"code":0,"data":{"manualTakeover":{"executorStatus":"在线"}}}` | `{"code":40400,"message":"直播间不存在"}` | 是 | 人工接管查看 |
| 提交人工播报 | POST | `/api/interaction/manual-speech` | 人工输入一句话并选择语气 / 动作 / 播报方式 | Body: `text`, `tone`, `action`, `broadcastMode`, `liveRoomId` | `speechId`, `status` | `{"code":0,"data":{"status":"已加入待播"}}` | `{"code":40001,"message":"播报内容不能为空"}` | 是 | 人工接管 |

当前对应 Service 函数：`getComments()`、`getCommentConnection()`、`getCommentTypes()`、`getInteractionLiveRooms()`、`getRiskLevels()`、`getQuestions()`、`getQuestionStatuses()`、`getAiReplyTemplates()`、`getManualTakeover()`、`getTakeoverTones()`、`getTakeoverActions()`、`getBroadcastModes()`、`getDelayControl()`、`getSpeechQueue()`、`getSubtitles()`、`getDelaySettings()`

## 13. Delay Control API 延迟播控

对应前端：`/delay-control/current`、`/delay-control/queue`、`/delay-control/subtitles`、`/delay-control/settings`
对应 Service：`src/services/delayControlService.js`
对应 Mock：`src/mock/delayControl.js`、`src/mock/speechQueue.js`、`src/mock/subtitles.js`、`src/mock/delaySettings.js`

| 接口名称 | Method | Path | 用途说明 | 请求参数 | 返回字段 | 成功示例 | 失败示例 | 登录 | 权限 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 获取当前播报 | GET | `/api/delay-control/current` | 获取当前播报、下一句、下两句和风险总览 | Query: `liveTaskId`, `liveRoomId` | `currentSpeech`, `nextSpeech`, `upcomingSpeech`, `riskSummary` | `{"code":0,"data":{"currentSpeech":{},"nextSpeech":{},"upcomingSpeech":[]}}` | `{"code":40400,"message":"直播任务不存在"}` | 是 | `speech:read` |
| 获取待播队列 | GET | `/api/delay-control/queue` | 获取待播队列，支持状态、风险等级、直播任务筛选 | Query: `liveTaskId`, `liveRoomId`, `reviewStatus`, `riskLevel`, `page`, `pageSize` | `list`, `total`, `page`, `pageSize` | `{"code":0,"data":{"list":[],"total":10,"page":1,"pageSize":20}}` | `{"code":40001,"message":"参数错误"}` | 是 | `speech:read` |
| 修改待播内容 | PATCH | `/api/delay-control/queue/:id` | 修改待播台词、动作、语气、风险状态 | Params: `id`; Body: `text`, `action`, `tone`, `riskLevel`, `reviewStatus` | `speechItem` | `{"code":0,"data":{"speechItem":{"id":"SQ001"}}}` | `{"code":40900,"message":"当前句正在播出，不可修改"}` | 是 | `speech:write` |
| 通过待播内容 | POST | `/api/delay-control/queue/:id/approve` | 人工审核通过一条待播内容 | Params: `id`; Body: `reviewNote` | `id`, `reviewStatus`, `approvedBy`, `approvedAt` | `{"code":0,"data":{"id":"SQ001","reviewStatus":"已通过"}}` | `{"code":40400,"message":"待播内容不存在"}` | 是 | `speech:review` |
| 驳回待播内容 | POST | `/api/delay-control/queue/:id/reject` | 驳回一条待播内容 | Params: `id`; Body: `reason` | `id`, `reviewStatus` | `{"code":0,"data":{"id":"SQ001","reviewStatus":"已驳回"}}` | `{"code":40900,"message":"当前状态不可驳回"}` | 是 | `speech:review` |
| 插队待播内容 | POST | `/api/delay-control/queue/:id/insert` | 将待播内容插队到下一句或指定位置 | Params: `id`; Body: `position`, `reason` | `id`, `orderNo`, `reviewStatus` | `{"code":0,"data":{"id":"SQ001","orderNo":1}}` | `{"code":40900,"message":"执行端离线，无法插队"}` | 是 | `speech:write` |
| 删除待播内容 | DELETE | `/api/delay-control/queue/:id` | 删除一条待播内容 | Params: `id`; Body: `reason` | `id` | `{"code":0,"data":{"id":"SQ001"}}` | `{"code":40900,"message":"当前句正在播出，不可删除"}` | 是 | `speech:write` |
| 获取字幕预览 | GET | `/api/delay-control/subtitles` | 获取字幕预览、字幕队列和字幕样式 | Query: `liveTaskId`, `liveRoomId` | `currentSubtitle`, `nextSubtitle`, `upcomingSubtitles`, `subtitleStyle` | `{"code":0,"data":{"currentSubtitle":{},"subtitleStyle":{}}}` | `{"code":40400,"message":"直播任务不存在"}` | 是 | `speech:read` |
| 保存字幕样式 | PUT | `/api/delay-control/subtitles/settings` | 保存字幕位置、字号、背景透明度等样式 | Body: `liveRoomId`, `fontSize`, `position`, `backgroundOpacity`, `showSpeakerName`, `showRiskTip` | `subtitleStyle` | `{"code":0,"data":{"subtitleStyle":{"position":"底部"}}}` | `{"code":40001,"message":"字号参数错误"}` | 是 | `speech:write` |
| 获取播控设置 | GET | `/api/delay-control/settings` | 获取延迟模式、审核策略、队列策略和风险规则 | Query: `liveRoomId` | `delayMode`, `delaySeconds`, `reviewRules`, `queueRules`, `riskRules` | `{"code":0,"data":{"delayMode":"5秒延迟"}}` | `{"code":40400,"message":"直播间不存在"}` | 是 | `speech:read` |
| 保存播控设置 | PUT | `/api/delay-control/settings` | 保存延迟模式、审核策略、队列策略、风险规则 | Body: `liveRoomId`, `delayMode`, `delaySeconds`, `reviewRules`, `queueRules`, `riskRules` | `settings` | `{"code":0,"data":{"settings":{"delaySeconds":5}}}` | `{"code":40001,"message":"延迟秒数不合法"}` | 是 | `speech:write` |

当前对应 Service 函数：`getDelayControl()`、`getSpeechQueue()`、`getReviewStatuses()`、`getSubtitles()`、`getDelayModes()`、`getDelaySettings()`

## 14. Live Control Room API 直播中控台

对应 Service：组合 `liveService`、`interactionService`、`delayControlService`、`studioService`  
对应 Mock：`src/mock/liveRooms.js`、`src/mock/liveTasks.js`、`src/mock/comments.js`、`src/mock/questions.js`、`src/mock/manualTakeover.js`、`src/mock/delayControl.js`、`src/mock/speechQueue.js`、`src/mock/subtitles.js`、`src/mock/studioOutput.js`

| 接口名称 | Method | Path | 用途说明 | 请求参数 | 返回字段 | 成功示例 | 失败示例 | 登录 | 权限 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 获取中控台总览 | GET | `/api/live/control-room/overview` | 一次性聚合直播任务、直播间、数字人、商品组、OBS、风险统计 | Query: `taskId` | `task`, `room`, `statusBar`, `riskSummary` | `{"code":0,"data":{"task":{"id":"LT001"}}}` | `{"code":40400,"message":"直播任务不存在"}` | 是 | 直播中控查看 |
| 获取中控弹幕流 | GET | `/api/live/control-room/comments` | 获取中控台滚动弹幕流 | Query: `taskId`, `filter`, `cursor`, `sinceId`, `limit` | `list`, `nextCursor`, `unhandledCount` | `{"code":0,"data":{"list":[],"nextCursor":"C013","unhandledCount":3}}` | `{"code":40900,"message":"弹幕服务未连接"}` | 是 | 直播中控操作 |
| 获取中控问题流 | GET | `/api/live/control-room/questions` | 获取待处理问题和推荐回复 | Query: `taskId`, `status` | `list`, `pendingCount` | `{"code":0,"data":{"list":[],"pendingCount":5}}` | `{"code":40001,"message":"任务参数错误"}` | 是 | 直播中控操作 |
| 获取播报状态 | GET | `/api/live/control-room/broadcast` | 获取当前播报、下一句、待播队列和字幕 | Query: `taskId` | `currentSpeech`, `speechQueue`, `subtitles` | `{"code":0,"data":{"currentSpeech":{"id":"SQ001"}}}` | `{"code":40900,"message":"执行端离线"}` | 是 | 播控查看 |
| 中控人工播报 | POST | `/api/live/control-room/manual-speech` | 在中控台直接插队、句后播报或加入待播 | Body: `taskId`, `text`, `tone`, `action`, `broadcastMode` | `speechId`, `status` | `{"code":0,"data":{"status":"即将播出"}}` | `{"code":40001,"message":"播报内容不能为空"}` | 是 | 人工接管 |
| 待播审核操作 | PATCH | `/api/live/control-room/speech-queue/:id` | 通过、修改、删除、插队、标记高风险 | Params: `id`; Body: `operation`, `text`, `riskLevel` | `id`, `reviewStatus` | `{"code":0,"data":{"id":"SQ001","reviewStatus":"已通过"}}` | `{"code":40900,"message":"当前句正在播出"}` | 是 | 播控审核 |

## 15. AI Center API AI能力中心

对应 Service：`src/services/aiService.js`  
对应 Mock：`src/mock/aiModels.js`、`src/mock/promptTemplates.js`、`src/mock/aiCallLogs.js`、`src/mock/aiCosts.js`

### AI助理设置

对应前端：`/ai-center/assistant`
对应未来 Service：`getAiAssistantSettings()`、`saveAiAssistantSettings(data)`

| 接口名称 | Method | Path | 用途说明 | 请求参数 | 返回字段 | 成功示例 | 失败示例 | 登录 | 权限 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 获取 AI 助理设置 | GET | `/api/ai/assistant` | 获取右下角 AI 助理开关、默认模式、上下文权限和合规提醒设置 | 无 | `enabled`, `assistantName`, `defaultMode`, `defaultTone`, `allowReadPageContext`, `allowFillForm`, `enableComplianceReminder`, `allowedContextScopes` | `{"code":0,"data":{"assistant":{"enabled":true,"assistantName":"运营助手"}}}` | `{"code":50000,"message":"读取 AI 助理设置失败"}` | 是 | `ai:model:read` |
| 保存 AI 助理设置 | PUT | `/api/ai/assistant` | 保存 AI 助理行为设置 | Body: `enabled`, `assistantName`, `defaultMode`, `defaultTone`, `allowReadPageContext`, `allowFillForm`, `enableComplianceReminder`, `allowedContextScopes` | `assistant` | `{"code":0,"data":{"assistant":{"enabled":true}}}` | `{"code":40001,"message":"助理名称不能为空"}` | 是 | `ai:model:write` |

### 模型、Prompt、日志和成本

| 接口名称 | Method | Path | 用途说明 | 请求参数 | 返回字段 | 成功示例 | 失败示例 | 登录 | 权限 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 获取模型服务商 | GET | `/api/ai/models` | 获取 Kimi、Mimo、DeepSeek 等模型配置状态 | Query: `status`, `usage` | `list` | `{"code":0,"data":{"list":[]}}` | `{"code":40001,"message":"参数错误"}` | 是 | AI配置查看 |
| AI 内容生成 | POST | `/api/ai/generate` | 统一 AI 生成入口；Phase 18B-1 仅支持 `scenario=product_copy`，默认 fake provider，不调用真实模型 | Body: `scenario`, `target`, `sourcePage`, `productId`, `draftProduct`, `options`, `promptTemplateId`, `realProvider` | `content`, `structured`, `riskTips`, `usage`, `cost`, `provider`, `modelName`, `logId`, `mock` | `{"code":0,"data":{"scenario":"product_copy","target":"description","content":"fake文案","provider":"fake","mock":true}}` | `{"code":40001,"message":"参数错误"}` | 是 | AI文案使用 |
| 更新模型配置 | PUT | `/api/ai/models/:id` | 保存 baseUrl、modelName、maxTokens 等配置，API Key 只允许后端安全保存 | Params: `id`; Body: 不含明文 key 的配置字段 | `model` | `{"code":0,"data":{"id":"kimi","status":"已配置"}}` | `{"code":40001,"message":"baseUrl格式错误"}` | 是 | AI配置编辑 |
| 保存模型凭证脱敏状态 | PUT | `/api/ai/models/:id/credentials` | 后端接收 API Key 并只保存脱敏状态，本阶段不保存明文、不调用真实模型 | Params: `id`; Body: `source`, `apiKey`, `baseUrl`, `modelName`, `remark` | `credential.apiKeyConfigured`, `credential.apiKeyMasked`, `credential.credentialRef` | `{"code":0,"data":{"credential":{"apiKeyConfigured":true,"apiKeyMasked":"sk-****abcd","credentialRef":"cred_kimi"}}}` | `{"code":40001,"message":"参数错误"}` | 是 | `ai:model:write` |
| 读取模型凭证脱敏状态 | GET | `/api/ai/models/:id/credentials` | 查询模型凭证是否配置，只返回脱敏信息 | Params: `id` | `credential` | `{"code":0,"data":{"credential":{"apiKeyConfigured":true}}}` | `{"code":40400,"message":"模型不存在"}` | 是 | `ai:model:read` |
| 删除模型凭证脱敏状态 | DELETE | `/api/ai/models/:id/credentials` | 清除凭证引用并标记未配置 | Params: `id` | `credential` | `{"code":0,"data":{"credential":{"apiKeyConfigured":false}}}` | `{"code":40400,"message":"模型不存在"}` | 是 | `ai:model:write` |
| 测试模型连接 | POST | `/api/ai/models/:id/test` | 通过后端代理测试模型；Phase 18A 默认使用 fake provider，不调用真实模型，并写入脱敏日志 | Params: `id`; Body: `sourcePage`, `scenario`, `realProvider` | `status`, `duration`, `tokens`, `cost`, `logId`, `realProviderEnabled` | `{"code":0,"data":{"status":"Fake通过","realProviderEnabled":false}}` | `{"code":40900,"message":"真实模型调用未开启"}` | 是 | `ai:model:test` |
| 更新默认模型 | PATCH | `/api/ai/models/defaults` | 更新普通文案、合规审核等默认模型 | Body: `role`, `providerId`, `modelName` | `defaults` | `{"code":0,"data":{"role":"questionReply"}}` | `{"code":40400,"message":"模型不存在"}` | 是 | AI配置编辑 |
| 获取 Prompt 模板 | GET | `/api/ai/prompts` | 获取 Prompt 模板列表 | Query: `category`, `status`, `keyword`, `page`, `pageSize` | `list`, `total`, `page`, `pageSize` | `{"code":0,"data":{"list":[],"total":10,"page":1,"pageSize":20}}` | `{"code":40001,"message":"参数错误"}` | 是 | Prompt查看 |
| 创建 Prompt 模板 | POST | `/api/ai/prompts` | 新建模板 | Body: `name`, `category`, `templateContent`, `variables` | `id`, `template` | `{"code":0,"data":{"id":"PT011"}}` | `{"code":40001,"message":"模板内容不能为空"}` | 是 | Prompt新增 |
| 更新 Prompt 模板 | PUT | `/api/ai/prompts/:id` | 编辑模板内容 | Params: `id`; Body: 模板字段 | `template` | `{"code":0,"data":{"id":"PT001"}}` | `{"code":40400,"message":"模板不存在"}` | 是 | Prompt编辑 |
| 复制 Prompt 模板 | POST | `/api/ai/prompts/:id/copy` | 复制模板 | Params: `id` | `id`, `sourceId` | `{"code":0,"data":{"id":"PT012"}}` | `{"code":40400,"message":"模板不存在"}` | 是 | Prompt新增 |
| 获取调用日志 | GET | `/api/ai/logs` | 查询 AI 调用记录 | Query: `startTime`, `endTime`, `sourcePage`, `provider`, `type`, `status`, `user`, `page`, `pageSize` | `list`, `total`, `page`, `pageSize` | `{"code":0,"data":{"list":[],"total":12,"page":1,"pageSize":20}}` | `{"code":40001,"message":"时间范围错误"}` | 是 | AI日志查看 |
| 获取成本监控 | GET | `/api/ai/costs` | 获取调用次数、费用、占比和预算设置 | Query: `startTime`, `endTime` | `summary`, `providerBreakdown`, `typeBreakdown`, `budgetSettings` | `{"code":0,"data":{"todayCalls":128}}` | `{"code":40001,"message":"时间范围错误"}` | 是 | AI成本查看 |
| 更新成本预算 | PATCH | `/api/ai/costs/budget` | 更新日预算、月预算和提醒开关 | Body: `dailyBudget`, `monthlyBudget`, `alerts` | `budgetSettings` | `{"code":0,"data":{"dailyBudget":100}}` | `{"code":40001,"message":"预算必须大于0"}` | 是 | AI成本设置 |

当前对应 Service 函数：`getModelProviders()`、`getModelStatusOptions()`、`getModelRoleSettings()`、`getModelUsageScenes()`、`getPromptTemplates()`、`getPromptCategories()`、`getPromptTemplateStatuses()`、`getPromptVariables()`、`getAiCallLogs()`、`getAiCallTypes()`、`getAiCallStatuses()`、`getAiCosts()`

## 16. Executor API 执行端管理

对应 Service：`src/services/executorService.js`  
对应 Mock：`src/mock/executors.js`、`src/mock/executorObs.js`、`src/mock/executorHeartbeats.js`

路由修正规则：OBS 状态与心跳日志使用独立资源前缀，避免 Express 中 `/api/executors/:id` 抢占 `/api/executors/obs-status` 或 `/api/executors/heartbeats` 一类静态路径。

| 接口名称 | Method | Path | 用途说明 | 请求参数 | 返回字段 | 成功示例 | 失败示例 | 登录 | 权限 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 获取执行端列表 | GET | `/api/executors` | 查看本地执行端状态 | Query: `keyword`, `status`, `page`, `pageSize` | `list`, `total`, `page`, `pageSize`, `stats` | `{"code":0,"data":{"list":[],"total":6,"page":1,"pageSize":20}}` | `{"code":40001,"message":"参数错误"}` | 是 | `executor:read` |
| 获取执行端详情 | GET | `/api/executors/:id` | 查看执行端详情 | Params: `id` | `executor` | `{"code":0,"data":{"executor":{"id":"EX001"}}}` | `{"code":40400,"message":"执行端不存在"}` | 是 | `executor:read` |
| 生成绑定信息 | POST | `/api/executors/bind` | 生成绑定码、二维码或绑定链接 | Body: `expiresInMinutes` | `code`, `expiresAt`, `bindUrl` | `{"code":0,"data":{"code":"MOCK-2026"}}` | `{"code":40900,"message":"绑定码生成过于频繁"}` | 是 | `executor:read` |
| 重启执行端 | POST | `/api/executors/:id/restart` | 下发重启指令，后续由本地执行端执行 | Params: `id` | `commandId`, `status` | `{"code":0,"data":{"commandId":"CMD001","status":"已下发"}}` | `{"code":40900,"message":"执行端离线"}` | 是 | `executor:restart` |
| 解绑执行端 | POST | `/api/executors/:id/unbind` | 解绑执行端，不使用 DELETE 以便记录操作原因和命令日志 | Params: `id`; Body: `reason` | `id`, `status` | `{"code":0,"data":{"id":"EX006","status":"已解绑"}}` | `{"code":40900,"message":"直播中不可解绑"}` | 是 | `executor:unbind` |
| 刷新执行端配置 | POST | `/api/executors/:id/refresh-config` | 下发刷新配置指令 | Params: `id` | `commandId`, `status` | `{"code":0,"data":{"commandId":"CMD002","status":"已下发"}}` | `{"code":40900,"message":"执行端离线"}` | 是 | `executor:read` |
| 获取 OBS 状态列表 | GET | `/api/executor-obs` | 获取各执行端 OBS 连接状态 | Query: `executorId`, `obsStatus`, `page`, `pageSize` | `list`, `total`, `page`, `pageSize`, `checklist` | `{"code":0,"data":{"list":[],"total":6,"page":1,"pageSize":20}}` | `{"code":40001,"message":"参数错误"}` | 是 | `executor:read` |
| 获取单执行端 OBS 状态 | GET | `/api/executor-obs/:executorId` | 获取指定执行端 OBS 状态和场景来源 | Params: `executorId` | `obsStatus`, `sceneSources`, `checklist` | `{"code":0,"data":{"obsStatus":{"executorId":"EX001"}}}` | `{"code":40400,"message":"OBS状态不存在"}` | 是 | `executor:read` |
| 测试 OBS 连接 | POST | `/api/executors/:id/obs/test` | 测试某执行端 OBS 连接 | Params: `id` | `commandId`, `status`, `message` | `{"code":0,"data":{"status":"测试中"}}` | `{"code":40900,"message":"执行端离线"}` | 是 | `executor:obs:operate` |
| 刷新 OBS 场景 | POST | `/api/executors/:id/obs/refresh-scenes` | 刷新 OBS 场景来源 | Params: `id` | `commandId`, `sceneSources` | `{"code":0,"data":{"sceneSources":[]}}` | `{"code":40900,"message":"OBS未连接"}` | 是 | `executor:obs:operate` |
| 获取心跳日志 | GET | `/api/executor-heartbeats` | 查询执行端心跳日志 | Query: `executorId`, `level`, `isAbnormal`, `startTime`, `endTime`, `page`, `pageSize` | `list`, `total`, `page`, `pageSize` | `{"code":0,"data":{"list":[],"total":12,"page":1,"pageSize":20}}` | `{"code":40001,"message":"时间范围错误"}` | 是 | `executor:read` |
| 获取单执行端心跳日志 | GET | `/api/executor-heartbeats/:executorId` | 查询指定执行端心跳日志 | Params: `executorId`; Query: `level`, `isAbnormal`, `startTime`, `endTime`, `page`, `pageSize` | `list`, `total`, `page`, `pageSize` | `{"code":0,"data":{"list":[],"total":4,"page":1,"pageSize":20}}` | `{"code":40400,"message":"执行端不存在"}` | 是 | `executor:read` |

当前对应 Service 函数：`getExecutors()`、`getExecutorById(id)`、`getExecutorStatusOptions()`、`getBindingDeviceMock()`、`getExecutorObsList()`、`getObsChecklist()`、`getExecutorHeartbeats()`、`getHeartbeatLevels()`

## 17. Help Center API 帮助中心

对应 Service：`src/services/helpService.js`  
对应 Mock：`src/mock/helpFaq.js`、`src/mock/troubleshooting.js`、`src/mock/tickets.js`、`src/mock/tutorials.js`、`src/mock/systemStatus.js`、`src/mock/changelog.js`

| 接口名称 | Method | Path | 用途说明 | 请求参数 | 返回字段 | 成功示例 | 失败示例 | 登录 | 权限 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 获取 FAQ | GET | `/api/help/faq` | 获取常见问题列表 | Query: `keyword`, `category`, `page`, `pageSize` | `list`, `categories`, `total`, `page`, `pageSize` | `{"code":0,"data":{"list":[],"total":8,"page":1,"pageSize":20}}` | `{"code":40001,"message":"参数错误"}` | 是 | 帮助查看 |
| 获取快速排查 | GET | `/api/help/troubleshooting` | 获取故障排查步骤 | Query: `category`, `keyword`, `page`, `pageSize` | `list`, `total`, `page`, `pageSize` | `{"code":0,"data":{"list":[],"total":9,"page":1,"pageSize":20}}` | `{"code":40001,"message":"参数错误"}` | 是 | 帮助查看 |
| 获取工单列表 | GET | `/api/help/tickets` | 查询技术工单 | Query: `type`, `urgency`, `status`, `keyword`, `page`, `pageSize` | `list`, `total`；每条工单包含 `attachments` | `{"code":0,"data":{"list":[]}}` | `{"code":40001,"message":"参数错误"}` | 是 | 工单查看 |
| 创建工单 | POST | `/api/help/tickets` | 提交技术工单，可绑定已上传附件 | Body: `type`, `description`, `urgency`, `relatedLiveRoom`, `relatedAvatar`, `relatedProduct`, `relatedExecutor`, `contact`, `attachmentIds` | `id`, `ticket`；`ticket.attachments` | `{"code":0,"data":{"id":"TCK-001","ticket":{"attachments":[]}}}` | `{"code":40001,"message":"问题描述不能为空"}` | 是 | 工单提交 |
| 更新工单 | PATCH | `/api/help/tickets/:id` | 回复、关闭、更新工单状态 | Params: `id`; Body: `status`, `reply` | `ticket` | `{"code":0,"data":{"status":"已解决"}}` | `{"code":40400,"message":"工单不存在"}` | 是 | 工单处理 |
| 获取操作教程 | GET | `/api/help/tutorials` | 获取教程卡片 | Query: `category`, `difficulty`, `page`, `pageSize` | `list`, `categories`, `total`, `page`, `pageSize` | `{"code":0,"data":{"list":[],"total":10,"page":1,"pageSize":20}}` | `{"code":40001,"message":"参数错误"}` | 是 | 帮助查看 |
| 获取系统状态 | GET | `/api/help/status` | 获取系统关键模块状态 Mock | Query: `serviceName` | `list`, `summary` | `{"code":0,"data":{"list":[]}}` | `{"code":50000,"message":"状态服务异常"}` | 是 | 系统状态查看 |
| 获取更新日志 | GET | `/api/help/changelog` | 获取版本更新记录 | Query: `version`, `important`, `page`, `pageSize` | `list`, `total`, `page`, `pageSize` | `{"code":0,"data":{"list":[],"total":8,"page":1,"pageSize":20}}` | `{"code":40001,"message":"参数错误"}` | 是 | 帮助查看 |

当前对应 Service 函数：`getFaqList()`、`getFaqCategories()`、`getTroubleshootingList()`、`getTickets()`、`getTicketTypes()`、`getTicketUrgencies()`、`getTicketStatuses()`、`getTutorials()`、`getTutorialCategories()`、`getSystemStatus()`、`getChangelog()`

## 18. Settings API 系统设置

对应 Service：`src/services/settingsService.js`  
对应 Mock：`src/mock/settings.js`

| 接口名称 | Method | Path | 用途说明 | 请求参数 | 返回字段 | 成功示例 | 失败示例 | 登录 | 权限 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 获取用户列表 | GET | `/api/settings/users` | 获取后台用户账号 | Query: `keyword`, `role`, `status`, `page`, `pageSize` | `list`, `total`, `stats` | `{"code":0,"data":{"list":[],"total":6}}` | `{"code":40001,"message":"参数错误"}` | 是 | 用户查看 |
| 创建用户 | POST | `/api/settings/users` | 新增后台用户 | Body: `username`, `nickname`, `email`, `phone`, `role`, `status`, `notes` | `id`, `user` | `{"code":0,"data":{"id":"U007"}}` | `{"code":40001,"message":"用户名不能为空"}` | 是 | 用户新增 |
| 更新用户 | PUT | `/api/settings/users/:id` | 编辑用户资料 | Params: `id`; Body: 用户字段 | `user` | `{"code":0,"data":{"id":"U001"}}` | `{"code":40400,"message":"用户不存在"}` | 是 | 用户编辑 |
| 更新用户状态 | PATCH | `/api/settings/users/:id/status` | 启用、禁用、锁定用户 | Params: `id`; Body: `status` | `id`, `status` | `{"code":0,"data":{"status":"禁用"}}` | `{"code":40900,"message":"不能禁用当前账号"}` | 是 | 用户编辑 |
| 重置密码 | POST | `/api/settings/users/:id/reset-password` | 重置密码，后续由后端发送通知 | Params: `id` | `id`, `status` | `{"code":0,"data":{"status":"已发送"}}` | `{"code":40900,"message":"通知服务未配置"}` | 是 | 用户编辑 |
| 获取角色列表 | GET | `/api/settings/roles` | 获取角色和权限范围 | Query: `status`, `page`, `pageSize` | `list`, `total`, `page`, `pageSize` | `{"code":0,"data":{"list":[],"total":6,"page":1,"pageSize":20}}` | `{"code":40001,"message":"参数错误"}` | 是 | 角色查看 |
| 更新角色权限 | PUT | `/api/settings/roles/:id` | 保存菜单权限、数据权限、操作权限 | Params: `id`; Body: `menuPermissions`, `dataScope`, `operationPermissions` | `role` | `{"code":0,"data":{"id":"R001"}}` | `{"code":40400,"message":"角色不存在"}` | 是 | 角色编辑 |
| 获取基础设置 | GET | `/api/settings/basic` | 获取系统名称、默认项、安全开关 | 无 | `basicSettings` | `{"code":0,"data":{"systemName":"数字人直播带货中控系统"}}` | `{"code":50000,"message":"读取配置失败"}` | 是 | 设置查看 |
| 保存基础设置 | PUT | `/api/settings/basic` | 保存基础设置 | Body: 基础设置字段 | `basicSettings` | `{"code":0,"data":{"mockMode":true}}` | `{"code":40001,"message":"系统名称不能为空"}` | 是 | 设置编辑 |
| 获取通知规则 | GET | `/api/settings/notifications` | 获取通知规则列表 | Query: `scene`, `enabled`, `page`, `pageSize` | `list`, `channels`, `total`, `page`, `pageSize` | `{"code":0,"data":{"list":[],"total":8,"page":1,"pageSize":20}}` | `{"code":40001,"message":"参数错误"}` | 是 | 通知查看 |
| 更新通知规则 | PUT | `/api/settings/notifications/:id` | 保存通知规则 | Params: `id`; Body: `name`, `scene`, `channels`, `enabled`, `recipients` | `rule` | `{"code":0,"data":{"id":"N001"}}` | `{"code":40400,"message":"通知规则不存在"}` | 是 | 通知编辑 |
| 测试通知 | POST | `/api/settings/notifications/:id/test` | 测试通知通道，后续由后端发送 | Params: `id` | `status` | `{"code":0,"data":{"status":"已发送"}}` | `{"code":40900,"message":"通知渠道未配置"}` | 是 | 通知测试 |
| 获取操作日志 | GET | `/api/settings/logs` | 查询系统操作日志 | Query: `operator`, `module`, `actionType`, `result`, `startTime`, `endTime`, `page`, `pageSize` | `list`, `total` | `{"code":0,"data":{"list":[],"total":10}}` | `{"code":40001,"message":"时间范围错误"}` | 是 | 操作日志查看 |

当前对应 Service 函数：`getUsers()`、`getRoles()`、`getBasicSettings()`、`getNotificationRules()`、`getNotificationChannels()`、`getOperationLogs()`、`getPermissionTree()`、`getSettingsOptions()`、`saveBasicSettingsMock(data)`、`updateUserMock(id,data)`、`updateRoleMock(id,data)`

## 19. 后续实现优先级建议

1. 先实现基础 CRUD：商品、商品组、数字人、直播间、直播任务。
2. 再实现设置与执行端状态：用户、角色、系统设置、执行端、心跳。
3. 再实现互动播控链路：弹幕、问题、待播队列、延迟设置。
4. 最后接 AI 模型代理、OBS、本地执行端和直播平台真实接口。
## 20. Phase 12.18 Dashboard / Auth / File 实现同步说明

- Dashboard 已实现 `GET /api/dashboard/overview`，当前返回 `data.overview.stats`、`data.overview.aiCallStatus`、`data.overview.recentOperations`、`data.overview.liveTaskStatusStats`、`data.overview.executorStatusStats`、`data.overview.riskSummary`。首页工作台通过 `dashboardService.getDashboardOverview()` 读取，不再直接 import `src/mock/dashboard.js`。
- Auth 已在 Phase 13 升级为本地 Auth / RBAC MVP：`POST /api/auth/login` 校验 SQLite 密码 hash，返回 Bearer token；`GET /api/auth/me`、`POST /api/auth/refresh` 需要登录；前端根据 `menuPermissions` 控制菜单和页面入口。
- File 已在 Phase 14 升级为本地上传 MVP：`POST /api/files/upload` 接受 `multipart/form-data`，保存到 `server/uploads`，返回 `data.file`，并记录 `file_assets`。当前不上传云端、不做病毒扫描。
- 当前实现路径已统一为 `/api/live-rooms`、`/api/live-tasks`、`/api/studio/output-status`、`/api/interaction/manual-takeover`、`/api/interaction/manual-speech`、`/api/dev/interaction/comments/simulate`。
