# 本机展示版启动说明

更新时间：2026-06-13

## 一键启动

双击项目根目录：

```text
start-local-demo.cmd
```

或在项目根目录执行：

```powershell
npm run demo:start
```

如需使用 siyuAI 本地运行时桥接模式启动执行端：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local-demo.ps1 -DigitalHumanAdapter siyu
```

脚本会做三件事：

1. 修复本机展示任务 `LT001` 与当前本机执行端的绑定。
2. 清理超过 2 分钟仍未完成的旧 pending/running 演示命令。
3. 启动或复用后端、前端和本机执行端。

## 常用命令

```powershell
npm run demo:repair
npm run demo:health
```

如需把登录密码也纳入健康检查，可在当前终端临时设置：

```powershell
$env:DEMO_ADMIN_PASSWORD='你的当前本机演示密码'
npm run demo:health
```

注意：脚本不会自动重置 admin 密码，也不会打印或重建执行端 token。`executor-client/.device.json` 已被 Git 忽略，只作为本机运行凭据保存。

## 访问地址

```text
登录页：http://localhost:5173/login
中控台：http://localhost:5173/live/control-room
后端健康：http://localhost:3000/api/health
```

本机日志默认写入：

```text
C:\tmp\szr-server.out.log
C:\tmp\szr-vite.out.log
C:\tmp\szr-executor.out.log
```
