# SZR Live Executor Client MVP

This directory contains the local executor Node CLI MVP. It is independent from the React/Vite frontend build.

## Requirements

- Node.js 18+
- Local API server running at `http://localhost:3000`
- Optional for OBS commands: OBS 28+ with obs-websocket enabled

## Local Config

You can configure the client with environment variables:

```bash
EXECUTOR_BASE_URL=http://localhost:3000
BIND_CODE=BIND-XXXXYYYY
OBS_URL=ws://127.0.0.1:4455
OBS_PASSWORD=your-local-obs-password
DH_ADAPTER=print
```

Or create `executor-client/config.local.json`:

```json
{
  "baseUrl": "http://localhost:3000",
  "bindCode": "BIND-XXXXYYYY",
  "heartbeatIntervalSeconds": 10,
  "requestTimeoutMs": 8000,
  "obsUrl": "ws://127.0.0.1:4455",
  "obsPassword": "",
  "obsTimeoutMs": 5000,
  "dhAdapter": "print",
  "duix": {},
  "siyu": {
    "runtimeRoot": "F:/AIshuziren/siyuAI_V194/siyuAI_V194",
    "configPath": "config/config.yaml",
    "pythonPath": "env/python.exe",
    "entryScript": "start.py",
    "exePath": "数字人直播.exe",
    "launchMode": "bridge",
    "autoStart": false,
    "bridgeDir": "E:/数字人直播/executor-client/runtime/siyu-bridge",
    "bridgeScript": "src/bridges/siyu_local_bridge.py",
    "bridgePollIntervalSeconds": 0.5
  }
}
```

`config.local.json` and `.device.json` are ignored by Git. Do not commit OBS passwords or device tokens.

## Start

```bash
cd executor-client
npm start
```

First run:

1. The client uses `BIND_CODE` to register with `/api/executors/register`.
2. The backend returns a device token once.
3. The client saves the token to `.device.json`.

Later runs reuse `.device.json` and skip registration.

## Commands

- `restart`, `refresh_config`, `unbind`: print-only MVP commands, then ack `succeeded`.
- `obs_test`: connects to OBS, reads version and current scene, then acks with status/detail.
- `refresh_obs_scenes`: connects to OBS, reads scene list and scene sources, then acks with scene data in `detail`.
- `speak`: sends one utterance to the configured digital human adapter and acks with the speech result.

If OBS is unreachable or disabled, OBS commands ack `failed` with a sanitized reason. The client continues running and retries later.

## Digital Human Adapter

`DH_ADAPTER=print` is the default and only fully working MVP adapter. It prints the utterance to the terminal and returns a simulated success ack.

`DH_ADAPTER=duix` is a placeholder adapter. It does not call DUIX yet because the SDK/API details still need manual verification. The placeholder returns a clear failed ack instead of inventing unverified API calls.

`DH_ADAPTER=siyu` is a local runtime bridge. It does not call siyuAI remote APIs, does not reuse `server_url` / `token` / `update_url`, and does not require `healthUrl` or `speakUrl`. It validates the local siyuAI runtime root, `config/config.yaml`, Python/EXE/bridge launch target, and model paths copied from the reference deployment. Speak commands are written as JSON files under `executor-client/runtime/siyu-bridge/commands` so a local siyuAI bridge process can consume them.

Use `launchMode=bridge` for the local demo path. When `siyu.autoStart=true`, the executor starts `env/python.exe src/bridges/siyu_local_bridge.py`, which consumes queued JSON commands and calls the local packaged `main.Api.speak(text)` entrypoint. Keep `autoStart=false` while you are only validating config/model paths.

Use `launchMode=python` or `launchMode=exe` only when you intentionally want the executor to start the original `start.py` or configured EXE.

## Boundaries

- `DH_ADAPTER=siyu` queues commands to a local bridge directory. Real rendering requires the siyuAI local bridge consumer and a prepared live runtime/model in the reference environment.
- No TTS.
- No lip sync.
- No streaming platform integration.
- No OBS control beyond connect/read status/read scenes.
- No device token or OBS password is printed in logs.
