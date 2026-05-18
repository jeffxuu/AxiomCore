# 日常运维

## 本地服务管理

### 启动

```powershell
# 推荐：双击桌面快捷方式
打开LifeOS.cmd

# 或本地看板
启动本地看板.cmd

# 或手动
python lifeos_server.py
```

### 停止

```powershell
# Ctrl+C in 终端
# 或
Get-Process python | Where-Object { $_.Path -like "*LifeOS*" } | Stop-Process
```

## 云端服务管理

```bash
# 状态
systemctl status lifeos.service

# 重启
systemctl restart lifeos.service

# 日志
journalctl -u lifeos.service -f

# 仅看错误
journalctl -u lifeos.service -p err -n 50
```

## Windows 计划任务

| 任务名 | 频率 | 用途 |
|--------|------|------|
| `PersonalAIProfileGitSync` | 5 分钟 | 检测本地变更，自动 git add+commit+push |
| `LifeOSCloudPullSync` | 5 分钟 | 拉取云端最新数据到本地 |

查看：
```powershell
Get-ScheduledTask -TaskName PersonalAIProfileGitSync, LifeOSCloudPullSync | Format-Table TaskName, State, LastRunTime
```

禁用（临时维护）：
```powershell
Disable-ScheduledTask -TaskName PersonalAIProfileGitSync
Disable-ScheduledTask -TaskName LifeOSCloudPullSync
```

重新启用：
```powershell
Enable-ScheduledTask -TaskName PersonalAIProfileGitSync
Enable-ScheduledTask -TaskName LifeOSCloudPullSync
```

## 数据维护

### 备份

本地数据库每天打包：
```powershell
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
Copy-Item data/lifeos.db "data/lifeos.db.$stamp.bak"
```

git 历史本身就是备份（除了 `data/lifeos.db`，它不进 Git）。

### 重建 SQLite

如果数据库损坏：
```powershell
# 1. 备份当前文件
Copy-Item data/lifeos.db data/lifeos.db.corrupted

# 2. 删除
Remove-Item data/lifeos.db

# 3. 重启服务，会自动 init_db()
python lifeos_server.py

# 4. 从 02_每日记录/*.md 重新导入
# （目前还没有 import 脚本，需要从 git 历史恢复）
```

### Schema 变更

`workflows/validate_frontmatter.py` 是 schema 的看门人。新增字段流程：

1. 修改 `data/schemas/*.schema.json` 加入新字段
2. 修改 `templates/*.md` 加入新字段示例
3. 运行 `python workflows/validate_frontmatter.py --path templates --verbose`
4. 修改 `lifeos_server.py` 的 SQLite `CREATE TABLE` 和 Pydantic 模型
5. 修改前端表单
6. 部署

## 自动汇总

手动触发：
```powershell
# 预览（不写文件）
python workflows\summarize_fragments.py --dry-run

# 写入 profile/current-state.md + reports/ai-weekly/
python workflows\summarize_fragments.py
```

如果想看预警引擎对特定 fixture 的行为：
```powershell
python workflows\summarize_fragments.py --dry-run `
  --daily-dir tests\fixtures\summarize\logs\daily `
  --finance-path tests\fixtures\summarize\finance-dashboard.warning.md `
  --business-path templates\annual-business-goal.md
```

## 日志位置

| 来源 | 位置 |
|------|------|
| 本地服务 stdout/stderr | 启动终端 |
| 云端服务 | `journalctl -u lifeos.service` |
| Git sync 历史 | `.sync_logs/` |
| Playwright 测试 | `output/playwright-run/` |
| Vite 可视审计 | `output/visual-audit/` |
| Python 字节码 | `__pycache__/`（可随时删） |

## 故障排查

### 网页打卡保存失败

1. 浏览器 DevTools → Network → 看 `POST /api/days/{date}` 的响应
2. 如果是 401 → cookie 过期，重新登录
3. 如果是 422 → 看响应 body 找出错的字段名（Pydantic 报错）
4. 如果是 500 → 看服务器日志

### 飞书机器人不响应

1. 服务端 `journalctl -u lifeos.service -f` 看 `/api/feishu/events` 命中
2. 检查飞书开放平台「事件与回调」URL 是否正确
3. 检查 `FEISHU_APP_ID` / `FEISHU_APP_SECRET` / `FEISHU_VERIFICATION_TOKEN` 三个环境变量是否设置且无空白字符

### 本地和云端不同步

1. 检查 `LifeOSCloudPullSync` 是否在运行（`Get-ScheduledTask`）
2. 手动执行一次 `scripts/cloud_to_local_sync.ps1` 看报错
3. 检查 DPAPI 凭据是否仍然解密成功（`scripts/lifeos_secrets.ps1 -Action show`）
4. 检查云端是否真的有当天数据（`ssh root@jeffxu.cc ls /opt/lifeos-app/02_每日记录/ | tail -3`）

### Git push 失败

1. `git status` 看是否有冲突
2. `git pull --rebase origin main` 拉最新
3. 解决冲突后 `git push origin main`
4. 如果是 `package-lock.json` 冲突 → `git checkout web/package-lock.json` 然后 `npm ci`

## 定期审计（建议每月）

- 检查 `git log --since='1 month ago' --stat` 有无意外提交大文件
- 检查 `data/lifeos.db` 大小（超过 100MB 需要排查）
- 检查 `output/` 是否堆积过多测试产物（可定期清空）
- 检查 `.sync_logs/` 是否有反复出现的同步错误
- 检查云端磁盘使用 `df -h /opt`
