# Digital Human Live Commerce Development Plan

Created at: `2026-06-13 13:57:17 +08:00`

## Goal

Build a local-first digital human live commerce application whose user-facing effect is close to `F:\AIshuziren\siyuAI_V194`, using `E:\数字人直播` as the main maintainable engineering base.

## First Delivery Target

Decision time: `2026-06-13 14:05:54 +08:00`

The first delivery target is a **self-use local demo version** running on the current Windows machine.

### In Scope For First Version

- Run locally on this machine.
- Start frontend, backend, and executor locally.
- Trigger a digital-human `speak` command from the frontend.
- Show command status, trace ID, and error messages in the UI.
- Use placeholder or first available digital-human runtime for the first demo.
- Use local SRS/ffmpeg and, if available later, OBS for stream output.
- Use demo products, demo scripts, and manually entered live speech.
- Keep full timestamped traceability for every action.

### Out Of Scope For First Version

- SaaS multi-tenant architecture.
- Payment, billing, customer account system, or commercial licensing.
- Full customer installer.
- Multi-platform live integration.
- Long-term unattended production stability.
- Complete parity with `siyuAI_V194`.

### First Demo Success Criteria

- The user can open the local frontend.
- The user can enter a sentence and click a speak/send button.
- The backend creates a traceable `speak` command.
- The executor receives and acknowledges the command.
- A digital-human or placeholder runtime responds.
- A local output route is visible through SRS/ffmpeg or OBS.
- The whole flow can be demonstrated repeatedly on this machine.

## Non-Negotiable Trace Rule

Every conversation summary, agent handoff, code change, test result, runtime observation, and blocker must include:

```text
时间：yyyy-MM-dd HH:mm:ss +08:00
session_id：
角色：
任务ID：
输入：
操作：
输出：
涉及文件：
验证方式：
下一步：
```

## Source Boundary

| Source | Role | Allowed Use | Forbidden Use |
|---|---|---|---|
| `F:\AIshuziren\siyuAI_V194` | Target effect reference | Feature comparison, config reference, runtime behavior observation, SRS/ffmpeg/Python dependency reference | Decompiling protected `.pyd`/`.dll`/`.exe`, copying secrets, modifying purchased package |
| `E:\数字人直播` | Main project base | Reuse frontend, backend, executor, SQLite, docs, service structure | Uncoordinated rewrites, deleting user changes, changing shared contracts without approval |
| New implementation | Product completion | Digital human adapter, TTS, OBS/SRS, platform adapters, test harness, packaging | Hidden dependencies, undocumented credentials, breaking existing MVP flows |
| Third-party projects/services | Runtime acceleration | Digital human SDK/model, LLM provider, platform SDK/API where legal and stable | License violations, credential leakage, unreviewed binary dependency |

## Source Usage By Module

| Module | `siyuAI_V194` Usage | `E:\数字人直播` Usage | New Work |
|---|---|---|---|
| Product target | Feature/effect reference | Gap comparison | Acceptance criteria |
| Frontend console | UX/function reference | Reuse React/Vite routes and pages | Polish live control workflows |
| Backend API | Config/business concept reference | Reuse Express/SQLite routes | Real runtime APIs and health checks |
| Executor | Local runtime behavior reference | Reuse registration, heartbeat, polling skeleton | Real command execution adapters |
| Digital human | Behavior/dependency reference | Reuse placeholder adapter boundaries | Real TTS/lip sync/avatar runtime |
| Streaming | Reference SRS/ffmpeg setup | Reuse OBS command skeleton | SRS/OBS/RTMP/WebRTC output |
| AI scripts | Reference model configuration effect | Reuse AI provider/compliance scaffolding | Prompt templates, provider integration, logs |
| Platform interaction | Reference platform/comment behavior | Reuse interaction/control-room modules | First real platform adapter |
| QA/trace | Reference expected behavior | Reuse existing scripts if available | Smoke tests, traceability, release checklist |

## Agent Collaboration Table

| session_id | Role | Main Ownership | Must Read First |
|---|---|---|---|
| `AGENT-ARCH-001` | 主控/架构 Agent | Plan, contracts, merge, conflict resolution | `TRACE_LOG.md`, `LOCKS.md`, `docs/DEVELOPMENT_PLAN.md` |
| `AGENT-REF-001` | 源码参考 Agent | `siyuAI_V194` analysis | Its prompt, source package configs/docs |
| `AGENT-REUSE-001` | 半成品固化/改造 Agent | Reuse inventory, startup stability | package docs, git status, README files |
| `AGENT-FE-001` | 前端 Agent | `src` UI and services | Frontend prompt, contracts, locks |
| `AGENT-BE-001` | 后端 Agent | `server` APIs, DB, permissions | Backend prompt, executor contract, locks |
| `AGENT-EXEC-001` | 执行端 Agent | `executor-client` | Executor prompt, command contract, locks |
| `AGENT-DH-001` | 数字人 Agent | TTS/digital human runtime | DH prompt, executor contract |
| `AGENT-STREAM-001` | 流媒体 Agent | SRS/OBS/ffmpeg output | Stream prompt, command contract |
| `AGENT-AI-001` | AI 话术/合规 Agent | AI scripts, prompts, compliance | AI prompt, backend AI routes |
| `AGENT-PLATFORM-001` | 平台 Agent | Live comments/platform events | Platform prompt, event contract when created |
| `AGENT-QA-001` | 测试 Agent | Validation and bug evidence | QA prompt, contracts, current worklog |

## Parallel Development Rules

1. Every agent must use its own `session_id`.
2. Every agent must check `LOCKS.md` before editing.
3. Every agent must lock files before editing and release the lock after review.
4. Agents must not edit files outside their ownership without `AGENT-ARCH-001` approval.
5. Shared contracts in `docs/contracts/` are stable boundaries.
6. Contract changes require architecture approval before implementation.
7. Mainline integration is done by `AGENT-ARCH-001` only.
8. Each merge needs a trace entry, changed file list, and validation evidence.

## Phase Plan

| Phase | Duration | Goal | Lead Agent |
|---|---:|---|---|
| 0. Trace foundation | 0.5-1 day | Logs, locks, contracts, prompts | `AGENT-ARCH-001` |
| 1. Reuse inventory | 2-3 days | Stabilize semi-finished project and identify reusable modules | `AGENT-REUSE-001` |
| 2. Target feature map | 3-5 days | Compare target source package with semi-finished project | `AGENT-REF-001` |
| 3. Local speak loop | 7-14 days | UI -> backend -> executor -> digital human/placeholder -> stream output | `AGENT-BE-001`, `AGENT-EXEC-001`, `AGENT-DH-001`, `AGENT-STREAM-001` |
| 4. MVP live flow | 4-6 weeks | Product, script, AI reply, manual control, executor status | `AGENT-FE-001`, `AGENT-AI-001`, `AGENT-QA-001` |
| 5. Deliverable local version | 2-3.5 months | Real runtime, logs, installer/startup, recovery | All agents |
| 6. Target-effect version | 4-6 months | Approach `siyuAI_V194` product effect | All agents |

## Immediate Next Milestone

Milestone: `M1_LOCAL_SPEAK_LOOP`

Acceptance criteria:

- Frontend can send a `speak` request.
- Backend creates a traceable `speak` command.
- Executor receives and acknowledges the command.
- Digital human adapter handles the command through placeholder or first available runtime.
- Stream adapter reports a local output route through SRS/ffmpeg first, OBS later if installed/configured.
- QA records timestamps and evidence for every step.

## Current Known Machine Context

Observed on `2026-06-13`:

- GPU: NVIDIA GeForce RTX 4070 Ti SUPER, 16GB VRAM.
- Memory: about 62GB total, about 35GB available at inspection time.
- Node: v22.22.1.
- npm: 10.9.4 through `npm.cmd`.
- Git: available.
- Bundled Python: `F:\AIshuziren\siyuAI_V194\siyuAI_V194\env\python.exe`, Python 3.10.16.
- Bundled ffmpeg: `F:\AIshuziren\siyuAI_V194\siyuAI_V194\env\ffmpeg\bin\ffmpeg.exe`.
- SRS process was listening on ports 1935, 1985, and 8080.
- OBS was not found in common install paths during inspection.
