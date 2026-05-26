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
