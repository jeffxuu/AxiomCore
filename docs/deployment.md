# 部署说明

> 面向产品视角的部署摘要。底层细节（Nginx 配置、systemd unit、shell 脚本）见 [server-setup/DEPLOYMENT.md](../server-setup/DEPLOYMENT.md)。

## 部署目标

| 形态 | 触发命令 | 入口 URL |
|------|---------|---------|
| 本地开发 | `python axiom_server.py` + `npm run dev` | http://127.0.0.1:5173 |
| 本地一体化 | `python axiom_server.py` | http://127.0.0.1:8765/app |
| 云端 | `scripts/deploy_axiom_cloud.ps1` | https://jeffxu.cc |

## 一键云端部署

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy_axiom_cloud.ps1
```

脚本会：
1. 从 DPAPI 加密配置读取 `AXIOM_SSH_HOST` / `AXIOM_SSH_USER` / `AXIOM_SSH_KEY_PATH`
2. SSH 登录云端服务器
3. 执行 `$RemoteAppDir/server-setup/deploy-axiom-web.sh`（默认 `/opt/axiom-core/server-setup/deploy-axiom-web.sh`）

远端脚本逻辑（应包含）：
1. `git pull --ff-only origin main`
2. `cd web && npm ci && npm run build`
3. `systemctl restart axiom-core.service`
4. Nginx 已在跑（独立维护，不在每次部署重启）

## 部署前自检

```powershell
git status --short --branch
# 1. 应该是 "## main...origin/main"
# 2. 没有未提交的本地变更
# 3. 没有任何 .env / 私钥 / *.pdf 待提交
```

如果有未提交变更：
```powershell
git add -A; git commit -m "..."
git push origin main
# 然后再 deploy
```

## 部署后验证

```powershell
# 1. 健康检查
curl https://jeffxu.cc/api/health
# 应返回 {"ok": true, "service": "Axiom Core", "time": "..."}

# 2. 品牌配置
curl https://jeffxu.cc/api/config
# 应返回 {"ok": true, "brandName": "Axiom Core", "tagline": "个人决策智能核心"}

# 3. 登录页可达
curl -I https://jeffxu.cc/login
# 应返回 200
```

## 命名约定（greenfield 后不再变更）

| 类型 | 名称 |
|------|------|
| systemd 服务 | `axiom-core.service` |
| 安装目录 | `/opt/axiom-core/` |
| 环境变量前缀 | `AXIOM_*` |
| Nginx upstream | `axiom_backend` |
| 数据库文件 | `data/axiom_core.db` |
| Python 入口 | `axiom_server.py` |
| Web npm 包名 | `axiom-core-web` |
| localStorage 主题 key | `axiom-theme` |
| Markdown 区块标记 | `<!-- AXIOM:BEGIN -->` / `<!-- AXIOM:END -->` |
| Session cookie | `axiom_session` |

下次再改这些名字 = 重做一遍 Phase 2 焦土。慎重。

## 回滚

```bash
# 在云端
cd /opt/axiom-core
git log --oneline -10                    # 找到上一个可用 commit
git checkout <commit-sha>
cd web && npm ci && npm run build
systemctl restart axiom-core.service
```

完成后立刻 `git checkout main` 让代码回到追踪状态——但不要 push。

## 常见部署故障

| 症状 | 排查 |
|------|------|
| 部署后 502 | `systemctl status axiom-core.service` 看 Uvicorn 是否启动失败 |
| 部署后样式错乱 | 检查 `web/dist/index.html` 是否新版；Nginx 是否缓存了旧 HTML |
| 部署后登录失败 | `journalctl -u axiom-core.service` 看是否 `AXIOM_SESSION_SECRET` 缺失 |
| 飞书消息无响应 | 检查飞书开放平台事件订阅 URL 是否正确；服务端 `/api/feishu/events` 日志 |
| Git pull 被本地变更阻塞 | 之前用过 `npm install` 而不是 `npm ci`，重写了 lock 文件；`git checkout web/package-lock.json` |
