# API密钥与模型配置安全规范

当前项目中已经准备了 Mimo 和 Kimi API。

## 1. 最重要原则

```text
API Key 不能写死在代码里。
API Key 不能提交到 GitHub。
API Key 不能出现在截图、日志、交接文档里。
API Key 不能放在 mock 数据里。
```

## 2. 正确存放位置

本地开发时，API Key 放在：

```text
.env.local
```

示例：

```text
VITE_KIMI_API_KEY=你的Kimi密钥
VITE_MIMO_API_KEY=你的Mimo密钥
```

但 `.env.local` 不能提交 GitHub。

## 3. 必须创建 .env.example

可以提交模板文件：

```text
.env.example
```

内容：

```text
VITE_KIMI_API_KEY=your_kimi_api_key_here
VITE_MIMO_API_KEY=your_mimo_api_key_here
VITE_DEFAULT_TEXT_MODEL=kimi
```

## 4. .gitignore 必须包含

```text
.env
.env.local
.env.*.local
```

## 5. 当前阶段如何处理 Kimi / Mimo

Phase 0 到 Phase 7 之前：

```text
只做模型服务配置页面。
不真实调用 Kimi / Mimo。
只用 Mock 状态。
```

## 6. 什么时候接真实 API

建议在：

```text
Phase 14：接入 Kimi / Mimo 文案生成
```

再接真实 API。

正确结构：

```text
前端点击 AI生成
↓
请求自己的后端 /api/ai/generate
↓
后端读取 .env.local 里的 API Key
↓
后端调用 Kimi / Mimo
↓
后端返回结果给前端
```

这样 API Key 不会暴露到浏览器。
