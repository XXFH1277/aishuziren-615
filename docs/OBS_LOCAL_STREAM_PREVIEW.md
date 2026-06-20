# OBS 本地流实时预览

这一步的目标是让 OBS 成为唯一正式画面源，同时让中控台通过本机 SRS 播放 OBS 输出，而不是再打开第二条 LiveTalking 预览会话。

## 启动 SRS

```powershell
npm run stream:srs:start
```

脚本会按顺序寻找 SRS：

1. 环境变量 `SRS_HOME`
2. `E:\数字人直播\.local-cache\srs`
3. `F:\AIshuziren\siyuAI_V194\siyuAI_V194\assets\srs`

默认配置使用 `conf\live.conf`，会监听：

- RTMP 推流：`1935`
- HTTP API：`1985`
- Web 播放器：`8080`

## OBS 设置

在 OBS 的直播/推流设置里填写：

- 服务器：`rtmp://127.0.0.1/live`
- 串流密钥：`dh`

完整推流地址等价于：

```text
rtmp://127.0.0.1/live/dh
```

## 软件设置

软件的 OBS 设置页保持默认即可：

- OBS 本地推流地址：`rtmp://127.0.0.1/live/dh`
- 中控台播放地址：`http://127.0.0.1:8080/players/srs_player.html?autostart=true&schema=http&host=127.0.0.1&port=8080&app=live&stream=dh`

## 停止 SRS

```powershell
npm run stream:srs:stop
```

## 目前边界

这一步只补本机直播画面回看链路：

```text
LiveTalking 输出页 -> OBS 浏览器源 -> OBS 推流 -> SRS -> 中控台实时预览
```

还没有自动把 OBS 推到抖音/快手/视频号。后续要做正式平台直播时，OBS 可以同时推平台，或者通过 SRS/FFmpeg 转推到平台 RTMP。
