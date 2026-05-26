# Phase 0｜给 Codex / Claude Code 的完整启动 Prompt

把下面这段直接复制给 Codex / Claude Code。

---

我要从零开始开发一个“数字人直播带货中控系统”的前端后台项目。

请注意：这不是展示型网页，不是单页滚动页面，而是真实后台管理系统原型。

当前阶段只做：

```text
Phase 0：项目初始化与后台骨架
```

不要做真实后端，不要接数据库，不要接 AI API，不要接 OBS，不要接直播平台。

## 一、技术要求

请使用：

```text
React + Vite
React Router
Ant Design
Ant Design Icons
普通 CSS 或 CSS Modules
```

术语说明：

```text
React：前端框架
Vite：前端构建工具
React Router：路由工具，负责页面切换
Ant Design：后台 UI 组件库
Ant Design Icons：图标库
```

## 二、项目结构要求

请创建以下结构：

```text
src/
├── app/
│   └── App.jsx
├── router/
│   └── index.jsx
├── layouts/
│   └── AdminLayout.jsx
├── components/
│   ├── Sidebar.jsx
│   ├── Header.jsx
│   ├── Breadcrumb.jsx
│   ├── PageHeader.jsx
│   ├── StatusTag.jsx
│   └── DataCard.jsx
├── pages/
│   ├── dashboard/
│   ├── live/
│   ├── products/
│   ├── avatar/
│   ├── studio/
│   ├── interaction/
│   ├── delay-control/
│   ├── ai-center/
│   ├── executors/
│   ├── help/
│   └── settings/
├── mock/
│   ├── menu.js
│   ├── dashboard.js
│   └── README.md
├── services/
│   └── README.md
├── hooks/
│   └── README.md
├── utils/
│   └── README.md
└── styles/
    └── global.css
```

## 三、后台布局要求

必须使用 AdminLayout（后台主布局）：

```text
左侧：Sidebar（侧边栏）
顶部：Header（顶部栏）
顶部下方：Breadcrumb（面包屑）
右侧：MainContent（主内容区域）
```

要求：

1. 侧边栏必须是多级树形菜单。
2. 支持展开 / 收起。
3. 点击菜单必须切换路由。
4. 当前菜单必须高亮。
5. 不能做成页面滚动定位。
6. 每个页面必须是独立组件。
7. 不要把所有页面写进 App.jsx。

## 四、第一阶段菜单结构

```text
首页工作台

直播管理
├── 直播间列表
├── 创建直播间
└── 直播任务

商品管理
├── 商品列表
├── 创建商品
└── 商品组

数字人管理
├── 数字人列表
├── 创建数字人
└── 动作库

直播间搭建
├── AI生成背景
├── 画面布局
└── OBS输出预留

实时互动
├── 弹幕捕获
├── 问题队列
└── 人工接管台

延迟播控台
├── 当前播报
├── 待播队列
├── 字幕预览
└── 延迟设置

AI能力中心
├── AI助理设置
├── 模型服务配置
└── Prompt模板管理

执行端管理
├── 执行端列表
├── OBS连接状态
└── 心跳日志

帮助中心
├── 常见问题
├── 快速排查
└── 技术工单

系统设置
├── 用户管理
└── 基础设置
```

## 五、页面要求

每个页面先做占位，但不能空白。

每个页面至少包含：

1. 页面标题
2. 页面说明
3. 2-4 个示例统计卡片或状态卡片
4. 后续功能提示

首页工作台要显示：

```text
今日直播任务
在线执行端
待审核话术
模拟弹幕数量
模型调用状态
最近操作记录
```

## 六、Mimo 和 Kimi API 注意事项

项目文件夹里已经准备了 Mimo 和 Kimi API，但当前阶段不要真实调用。

只做以下预留：

1. AI能力中心 / 模型服务配置页面中显示 Kimi 和 Mimo 两个模型配置卡片。
2. 状态用 Mock：未连接 / 已配置 / 待测试。
3. 不要读取真实 API Key。
4. 不要把 API Key 写进代码。
5. 不要提交 `.env` 或 `.env.local` 文件。

可以创建 `.env.example`：

```text
VITE_KIMI_API_KEY=your_kimi_api_key_here
VITE_MIMO_API_KEY=your_mimo_api_key_here
```

`.gitignore` 必须包含：

```text
.env
.env.local
.env.*.local
```

## 七、GitHub 开发规则

请遵守：

1. 不要直接修改 main 分支。
2. 从 dev 创建 `feature/init-admin-shell` 分支。
3. 修改前先 `git status`、`git branch`、`git pull`。
4. 修改后运行 `npm run dev` 和 `npm run build`。
5. 通过后 commit。
6. push 到 GitHub。
7. 不要合并 main。
8. 完成后更新 `docs/AI开发交接记录.md`。

## 八、禁止事项

1. 禁止做成单页滚动。
2. 禁止所有页面写在 App.jsx。
3. 禁止真实调用 Kimi / Mimo API。
4. 禁止把 API Key 写进代码。
5. 禁止写真实后端。
6. 禁止接数据库。
7. 禁止接 OBS。
8. 禁止接直播平台。
9. 禁止安装大量不必要依赖。
10. 禁止一次性开发所有模块细节。

## 九、完成后请输出

完成后请告诉我：

1. 当前分支
2. 修改了哪些文件
3. 新增了哪些文件
4. npm run dev 是否通过
5. npm run build 是否通过
6. 是否已 commit
7. 是否已 push 到 GitHub
8. 下一阶段建议

并更新：

```text
docs/AI开发交接记录.md
```
