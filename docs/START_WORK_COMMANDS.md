# Start Work Commands

Created at: `2026-06-13 14:10:38 +08:00`

This document tells the user how to start the first development round with a small number of agents.

## First Version Goal

Build a self-use local demo version on the current Windows machine.

First milestone: `M1_LOCAL_SPEAK_LOOP`

Target flow:

```text
Frontend speak button
-> Backend creates speak command
-> Executor receives command
-> Placeholder or real digital human responds
-> Local SRS/ffmpeg/OBS output is visible
-> UI shows status and trace ID
```

## Do Not Start All Agents

For the first round, start only these 5 sessions:

| Order | session_id | Role |
|---:|---|---|
| 1 | `AGENT-ARCH-001` | 主控/架构 Agent |
| 2 | `AGENT-REUSE-001` | 半成品固化/改造 Agent |
| 3 | `AGENT-FE-001` | 前端 Agent |
| 4 | `AGENT-BE-001` | 后端 Agent |
| 5 | `AGENT-EXEC-001` | 执行端 Agent |

Keep these agents paused for now:

| session_id | Reason |
|---|---|
| `AGENT-DH-001` | Start after placeholder speak command works. |
| `AGENT-STREAM-001` | Start after executor can receive commands. |
| `AGENT-AI-001` | Start after manual speech works. |
| `AGENT-PLATFORM-001` | Start after local demo works. |
| `AGENT-QA-001` | Start when the first loop is ready for validation. |
| `AGENT-REF-001` | Merge into `AGENT-REUSE-001` during the first round. |

## Session 1 Command: AGENT-ARCH-001

Open a new Codex session in `E:\数字人直播`, then paste:

```text
你现在是 AGENT-ARCH-001。

请先读取：
1. E:\数字人直播\docs\agent-prompts\AGENT-ARCH-001.md
2. E:\数字人直播\docs\DEVELOPMENT_PLAN.md
3. E:\数字人直播\TRACE_LOG.md
4. E:\数字人直播\LOCKS.md
5. E:\数字人直播\docs\contracts\executor-command-contract.md

第一版目标：自己用的本机展示版。
当前里程碑：M1_LOCAL_SPEAK_LOOP。

你的任务：
1. 作为主控 agent，确认本轮只启动 AGENT-REUSE-001、AGENT-FE-001、AGENT-BE-001、AGENT-EXEC-001。
2. 输出本轮任务拆分、文件所有权和合并顺序。
3. 要求所有输出必须带：
   时间、session_id、角色、任务ID、输入、操作、输出、涉及文件、验证方式、下一步。
4. 不要直接大改业务代码，先协调任务边界。
```

## Session 2 Command: AGENT-REUSE-001

Open a new Codex session in `E:\数字人直播`, then paste:

```text
你现在是 AGENT-REUSE-001。

请先读取：
1. E:\数字人直播\docs\agent-prompts\AGENT-REUSE-001.md
2. E:\数字人直播\docs\DEVELOPMENT_PLAN.md
3. E:\数字人直播\TRACE_LOG.md
4. E:\数字人直播\LOCKS.md
5. E:\数字人直播\package.json
6. E:\数字人直播\server\README.md
7. E:\数字人直播\executor-client\README.md

第一版目标：自己用的本机展示版。
当前里程碑：M1_LOCAL_SPEAK_LOOP。

你的任务：
1. 盘点半成品当前可复用模块。
2. 确认前端、后端、执行端的启动命令。
3. 找出 speak 闭环已经存在的代码和缺口。
4. 不修改业务代码，先输出复用清单和风险清单。
5. 输出时必须带 session_id=AGENT-REUSE-001 和精确到秒的时间。
```

## Session 3 Command: AGENT-FE-001

Open a new Codex session in `E:\数字人直播`, then paste:

```text
你现在是 AGENT-FE-001。

请先读取：
1. E:\数字人直播\docs\agent-prompts\AGENT-FE-001.md
2. E:\数字人直播\docs\DEVELOPMENT_PLAN.md
3. E:\数字人直播\LOCKS.md
4. E:\数字人直播\docs\contracts\executor-command-contract.md
5. E:\数字人直播\src\router\index.jsx

第一版目标：自己用的本机展示版。
当前里程碑：M1_LOCAL_SPEAK_LOOP。

你的任务：
1. 找到最适合放“测试话术输入框”和“发送给数字人”按钮的现有页面。
2. 设计最小前端改动：输入文本、发送 speak 请求、显示 command status 和 trace ID。
3. 先不要改代码，先输出需要修改的文件清单、接口依赖和 UI 验收标准。
4. 等 AGENT-ARCH-001 批准后再加 LOCKS 并动手。
5. 输出时必须带 session_id=AGENT-FE-001 和精确到秒的时间。
```

## Session 4 Command: AGENT-BE-001

Open a new Codex session in `E:\数字人直播`, then paste:

```text
你现在是 AGENT-BE-001。

请先读取：
1. E:\数字人直播\docs\agent-prompts\AGENT-BE-001.md
2. E:\数字人直播\docs\DEVELOPMENT_PLAN.md
3. E:\数字人直播\LOCKS.md
4. E:\数字人直播\docs\contracts\executor-command-contract.md
5. E:\数字人直播\server\routes\executors.js
6. E:\数字人直播\server\routes\liveSessions.js
7. E:\数字人直播\server\routes\liveControlRoom.js

第一版目标：自己用的本机展示版。
当前里程碑：M1_LOCAL_SPEAK_LOOP。

你的任务：
1. 确认现有后端是否已有创建 speak 命令的接口。
2. 对照 executor-command-contract，找出缺少的字段：trace、status、ack、查询接口。
3. 先不要改代码，先输出最小后端改动方案和 API 验收标准。
4. 等 AGENT-ARCH-001 批准后再加 LOCKS 并动手。
5. 输出时必须带 session_id=AGENT-BE-001 和精确到秒的时间。
```

## Session 5 Command: AGENT-EXEC-001

Open a new Codex session in `E:\数字人直播`, then paste:

```text
你现在是 AGENT-EXEC-001。

请先读取：
1. E:\数字人直播\docs\agent-prompts\AGENT-EXEC-001.md
2. E:\数字人直播\docs\DEVELOPMENT_PLAN.md
3. E:\数字人直播\LOCKS.md
4. E:\数字人直播\docs\contracts\executor-command-contract.md
5. E:\数字人直播\executor-client\README.md

第一版目标：自己用的本机展示版。
当前里程碑：M1_LOCAL_SPEAK_LOOP。

你的任务：
1. 盘点 executor-client 当前注册、心跳、轮询、ack、print adapter 的实现。
2. 确认它能否接收 speak 命令并返回 received/running/done。
3. 先不要改代码，先输出执行端缺口、需要修改的文件、验证命令。
4. 等 AGENT-ARCH-001 批准后再加 LOCKS 并动手。
5. 输出时必须带 session_id=AGENT-EXEC-001 和精确到秒的时间。
```

## Main Session Command

In the original/main conversation, use this command after the five agents finish their first analysis:

```text
时间：请使用当前系统时间，精确到秒。
session_id：AGENT-ARCH-001
角色：主控/架构 Agent

我已经收到了 AGENT-REUSE-001、AGENT-FE-001、AGENT-BE-001、AGENT-EXEC-001 的首轮分析。
请你汇总它们的结论，决定第一轮具体代码修改顺序。
要求：
1. 明确哪个 agent 先改哪些文件。
2. 明确 LOCKS.md 应该如何加锁。
3. 明确接口契约是否需要调整。
4. 明确每个修改完成后的验证命令。
5. 不允许多个 agent 同时改同一个文件。
```

## First Round Merge Order

Use this order unless `AGENT-ARCH-001` changes it:

1. `AGENT-BE-001`: Backend speak command and status API.
2. `AGENT-EXEC-001`: Executor receive and ack speak command.
3. `AGENT-FE-001`: Minimal UI trigger and status display.
4. `AGENT-REUSE-001`: Update reuse inventory and startup notes.
5. `AGENT-ARCH-001`: Integrate, run validation, update trace log.

## First Round Stop Condition

Stop the first round when:

- The frontend can send text.
- The backend creates a command.
- The executor receives it.
- The executor returns `done` through print or placeholder adapter.
- The frontend can show command result and trace ID.

Do not start real digital human, OBS, AI, or platform integration until this loop works.
