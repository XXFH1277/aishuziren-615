# Agent Prompts Index

Each file in this directory is an opening prompt for a dedicated Codex session.
When starting a new agent session, copy the matching prompt into that session first.

## Required Logging

Every agent response must begin with:

```text
时间：
session_id：
角色：
任务ID：
```

All timestamps must use Asia/Shanghai time with second precision:

```text
yyyy-MM-dd HH:mm:ss +08:00
```

## Agent List

| Prompt File | session_id | Role |
|---|---|---|
| `AGENT-ARCH-001.md` | `AGENT-ARCH-001` | 主控/架构 Agent |
| `AGENT-REF-001.md` | `AGENT-REF-001` | 源码参考 Agent |
| `AGENT-REUSE-001.md` | `AGENT-REUSE-001` | 半成品固化/改造 Agent |
| `AGENT-FE-001.md` | `AGENT-FE-001` | 前端 Agent |
| `AGENT-BE-001.md` | `AGENT-BE-001` | 后端 Agent |
| `AGENT-EXEC-001.md` | `AGENT-EXEC-001` | 执行端 Agent |
| `AGENT-DH-001.md` | `AGENT-DH-001` | 数字人 Agent |
| `AGENT-STREAM-001.md` | `AGENT-STREAM-001` | 流媒体 Agent |
| `AGENT-AI-001.md` | `AGENT-AI-001` | AI 话术/合规 Agent |
| `AGENT-PLATFORM-001.md` | `AGENT-PLATFORM-001` | 平台 Agent |
| `AGENT-QA-001.md` | `AGENT-QA-001` | 测试 Agent |

## Parallel Work Rule

An agent may work in parallel only when:

- It has read `TRACE_LOG.md`, `LOCKS.md`, and the relevant contract files.
- It has declared file ownership in `LOCKS.md`.
- It does not modify files owned by another active lock.
- It does not change shared contracts without `AGENT-ARCH-001` approval.
- It writes a trace entry after each meaningful action.
