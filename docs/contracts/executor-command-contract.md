# Executor Command Contract

This contract defines how the backend sends commands to the local executor client.
Agents may work in parallel as long as they do not break this contract without approval from `AGENT-ARCH-001`.

## Ownership

| Area | Owner |
|---|---|
| Contract approval | `AGENT-ARCH-001` |
| Backend command producer | `AGENT-BE-001` |
| Executor command consumer | `AGENT-EXEC-001` |
| Digital human command handling | `AGENT-DH-001` |
| Stream output command handling | `AGENT-STREAM-001` |
| QA validation | `AGENT-QA-001` |

## Source Tags

| Part | Source |
|---|---|
| Backend command queue skeleton | `SOURCE-SEMI-REUSE` |
| Executor polling skeleton | `SOURCE-SEMI-REUSE` |
| Digital human runtime behavior reference | `SOURCE-SIYU-REFERENCE` |
| Real TTS/digital human/OBS/SRS integrations | `SOURCE-NEW` or `SOURCE-THIRD-PARTY` |

## Command Envelope

```json
{
  "id": "cmd_20260613_135228_001",
  "type": "speak",
  "priority": 5,
  "createdAt": "2026-06-13T13:52:28+08:00",
  "expiresAt": "2026-06-13T13:53:28+08:00",
  "payload": {},
  "trace": {
    "eventId": "DH-20260613-135228-EXEC-SPEAK",
    "source": "SOURCE-SEMI-REUSE",
    "requestedBy": "AGENT-BE-001"
  }
}
```

## Command Types

| Type | Purpose | Required Consumer |
|---|---|---|
| `speak` | Make the digital human speak text | `AGENT-EXEC-001`, `AGENT-DH-001` |
| `stop_speak` | Stop current speech | `AGENT-EXEC-001`, `AGENT-DH-001` |
| `refresh_obs_scenes` | Read OBS scenes and sources | `AGENT-EXEC-001`, `AGENT-STREAM-001` |
| `switch_scene` | Switch OBS/SRS output scene | `AGENT-EXEC-001`, `AGENT-STREAM-001` |
| `obs_test` | Test OBS websocket connectivity | `AGENT-EXEC-001`, `AGENT-STREAM-001` |
| `start_stream` | Start local stream output | `AGENT-EXEC-001`, `AGENT-STREAM-001` |
| `stop_stream` | Stop local stream output | `AGENT-EXEC-001`, `AGENT-STREAM-001` |
| `health_check` | Report executor/runtime status | `AGENT-EXEC-001`, `AGENT-QA-001` |

## speak Payload

```json
{
  "text": "欢迎来到直播间，今天这款产品福利非常好。",
  "avatarId": "avatar_001",
  "voiceId": "voice_default",
  "speed": 1.0,
  "emotion": "friendly",
  "interrupt": false,
  "subtitle": true,
  "productId": "product_001",
  "roomId": "room_001"
}
```

## Ack Payload

```json
{
  "commandId": "cmd_20260613_135228_001",
  "status": "done",
  "receivedAt": "2026-06-13T13:52:29+08:00",
  "startedAt": "2026-06-13T13:52:30+08:00",
  "finishedAt": "2026-06-13T13:52:35+08:00",
  "message": "Speech completed",
  "runtime": {
    "adapter": "print",
    "streamUrl": "rtmp://127.0.0.1/live/avatar",
    "durationMs": 5000
  },
  "error": null
}
```

## Status Values

| Status | Meaning |
|---|---|
| `pending` | Created by backend and waiting for executor. |
| `received` | Executor received the command. |
| `running` | Runtime is executing the command. |
| `done` | Command completed successfully. |
| `failed` | Command failed. |
| `expired` | Command was not executed before `expiresAt`. |
| `cancelled` | Command was cancelled by user or system. |

## Compatibility Rules

- New fields must be optional by default.
- Removing or renaming fields requires approval from `AGENT-ARCH-001`.
- Command `type` values are stable public contract fields.
- Backend must tolerate unknown ack `runtime` fields.
- Executor must ignore unknown payload fields unless the command type requires them.

## Validation Checklist

- Backend can create a `speak` command.
- Executor can poll and receive pending commands.
- Executor can ack `received`, `running`, and final status.
- UI can display command status and error message.
- Trace log contains event ID, session ID, timestamps, and involved files.
