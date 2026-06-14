# Agent Worklog Rules

Every agent must leave local written records so the main conversation can understand work done in other sessions.

## Required Files

| File | Purpose |
|---|---|
| `E:\数字人直播\docs\AGENT_STATUS_BOARD.md` | Short latest status for the main conversation. |
| `E:\数字人直播\docs\agent-worklog\YYYY-MM-DD.md` | Detailed daily worklog. |
| `E:\数字人直播\TRACE_LOG.md` | Canonical chronological audit trail. |
| `E:\数字人直播\LOCKS.md` | File locks for active edits. |

## After Every Meaningful Work Round

Each agent must:

1. Update its row in `docs/AGENT_STATUS_BOARD.md`.
2. Append a detailed entry to `docs/agent-worklog/YYYY-MM-DD.md`.
3. Append to `TRACE_LOG.md` when there is a decision, file change, contract change, blocker, or test result.
4. Update `LOCKS.md` when starting or finishing file edits.

## Daily Worklog Entry Template

```text
## DH-YYYYMMDD-HHMMSS-MODULE-TITLE

时间：
事件ID：
session_id：
角色：
任务：
输入：
操作：
输出：
涉及文件：
来源标签：
依赖其他Agent：
是否阻塞：
验证方式：
下一步：
```

## Main Conversation Read Order

When the main conversation needs to catch up, read in this order:

1. `docs/AGENT_STATUS_BOARD.md`
2. `docs/agent-worklog/YYYY-MM-DD.md`
3. `TRACE_LOG.md`
4. Relevant files mentioned by agent entries
