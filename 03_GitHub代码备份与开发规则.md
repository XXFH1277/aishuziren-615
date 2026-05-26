# GitHub代码备份与开发规则

GitHub 必须作为远程仓库。main 分支保存稳定可运行版本。

## 1. 分支规则

```text
main：稳定版本，只保存能完整运行的代码
dev：日常开发整合分支
feature/xxx：单个功能开发分支
```

## 2. 每次开发前

```bash
git status
git branch
git remote -v
git checkout dev
git pull origin dev
git checkout -b feature/功能名称
```

## 3. 每次开发后

```bash
npm run dev
npm run build
git add .
git commit -m "feat: 本次修改说明"
git push -u origin feature/功能名称
```

## 4. 禁止事项

```text
1. 禁止直接改 main。
2. 禁止不测试就提交。
3. 禁止不 push 就换电脑。
4. 禁止把 .env.local 提交到 GitHub。
5. 禁止把 API Key 写进代码。
6. 禁止一次性大改所有模块。
```

## 5. 多电脑规则

```text
开始前 pull。
结束前 push。
换电脑前必须 push。
换电脑后必须 pull。
```

## 6. AI工具切换规则

```text
Codex 做完必须 commit + push + 写交接日志。
Claude Code 接手前必须 pull 最新分支并阅读交接日志。
额度快用完时，先保存当前状态，不要继续大改。
```
