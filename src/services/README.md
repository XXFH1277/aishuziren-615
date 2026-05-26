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
