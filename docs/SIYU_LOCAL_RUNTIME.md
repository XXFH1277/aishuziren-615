# siyuAI 本地运行时适配说明

更新时间：2026-06-13 15:11:35 +08:00
session_id：FULLSTACK-DEV-001

## 目标

执行端的 `DH_ADAPTER=siyu` 不再走 `healthUrl` / `speakUrl` 这类 HTTP API 调用方式。

新的方向是参考 siyuAI_V194 的模型选择和部署配置，在本机使用同类模型路径、Python/CUDA 环境、SRS/OBS 输出链路。

明确不使用：

- `server_url`
- `token`
- `update_url`
- 参考源码的远程用户服务、授权服务、更新服务

## 配置示例

`executor-client/config.local.json`：

```json
{
  "baseUrl": "http://localhost:3000",
  "dhAdapter": "siyu",
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

## 当前实现

`executor-client/src/adapters/SiyuAdapter.js` 会：

1. 检查 siyuAI runtime 根目录是否存在。
2. 读取 `config/config.yaml` 的顶层模型路径。
3. 校验 TTS、ASR、Hubert、RoBERTa、UNet/ONNX、face detect、Wenet 等关键模型文件/目录。
4. 忽略并脱敏展示 `server_url`、`token`、`update_url`。
5. 收到 speak 命令时写入本地 bridge 队列：

```text
executor-client/runtime/siyu-bridge/commands/*.json
executor-client/runtime/siyu-bridge/latest-speak.json
```
6. 当 `autoStart=true` 且 `launchMode=bridge` 时，启动 `env\python.exe src\bridges\siyu_local_bridge.py` 消费队列，并调用本机 `main.Api.speak(text)`。

## 已确认的本地入口

2026-06-13 15:25:26 +08:00，使用参考源码自带 `env\python.exe` 只导入 `main`、不执行 `main()` 做反射确认：

- `start.py` 只是 `from main import main`，核心逻辑在 `main.cp310-win_amd64.pyd`。
- `main.Api.speak(self, text: str) -> Dict[str, Any]` 存在，说明注释为“添加手动回复”。
- `main.Api.start_live(self, data: Dict[str, Any])`、`stop_live()`、`get_stream_urls()` 也存在。
- `run_ipc_server(port=12345)` 存在，但从二进制字符串看更像直播保镖触发通道，不能直接假设它就是完整 speak HTTP API。

因此下一步 bridge consumer 优先做“本机 Python 进程导入本地封装入口并调用 `Api.speak(text)`”，而不是猜测远程或本地 HTTP speakUrl。

## 后续要做

1. 用一条真实话术验证 bridge consumer 能否在未打开 GUI 的情况下调用 `Api.speak(text)`。
2. 如果需要直播上下文，再补 `start_live(data)` 前置流程。
3. 把输出接到 OBS/SRS：RTMP `1935`、HTTP API `1985`、HTTP-FLV/HLS `8080`。
4. 在后台增加运行时状态页：模型存在、GPU/CUDA、进程、桥接队列、SRS 状态。
