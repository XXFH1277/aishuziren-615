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
