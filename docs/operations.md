# 日常运维

## 本地服务管理

### 启动

```powershell
python axiom_server.py
```

入口：http://127.0.0.1:8765/app（或开发模式 5173）。

> 注：旧的 `打开LifeOS.cmd` / `启动本地看板.cmd` 桌面快捷方式在 greenfield 重建时已废弃。需要双击启动的话自行新建 .cmd 即可。

### 停止

```powershell
# Ctrl+C in 终端
# 或
Get-Process python | Where-Object { $_.Path -like "*AxiomCore*" } | Stop-Process
```

## 云端服务管理

```bash
# 状态
systemctl status axiom-core.service

# 重启
systemctl restart axiom-core.service

# 日志
journalctl -u axiom-core.service -f

# 仅看错误
journalctl -u axiom-core.service -p err -n 50
```

## 一次性 Bootstrap（首次部署）

```powershell
# 1. 配置凭据（DPAPI 加密存到 %USERPROFILE%\.axiom-core\secrets.dat）
powershell -ExecutionPolicy Bypass -File scripts\axiom_secrets.ps1 -Action new-ssh-key
powershell -ExecutionPolicy Bypass -File scripts\axiom_secrets.ps1 -Action set
# 输入 AXIOM_SSH_HOST / AXIOM_SSH_USER / AXIOM_REMOTE_APP_DIR 等

# 2. 把新生成的公钥加入服务器 ~/.ssh/authorized_keys（手动）

# 3. 干预式部署（默认会摧毁旧 lifeos.service + /opt/lifeos-app/）
powershell -ExecutionPolicy Bypass -File scripts\deploy_axiom_cloud.ps1 -DryRun  # 先预览
powershell -ExecutionPolicy Bypass -File scripts\deploy_axiom_cloud.ps1          # 真跑

# 4. SSH 上去把 /etc/axiom-core/env 里的 placeholders 改成真值
ssh root@<host>
vi /etc/axiom-core/env
systemctl restart axiom-core

# 5. 注册 Windows 计划任务（管理员 PowerShell）
$repo = "C:\Users\ouc\Desktop\AxiomCore"
schtasks /Create /TN AxiomCoreGitSync /SC MINUTE /MO 5 /F `
  /TR "powershell -NoProfile -ExecutionPolicy Bypass -File $repo\scripts\auto_git_sync.ps1"
schtasks /Create /TN AxiomCorePullSync /SC MINUTE /MO 5 /F `
  /TR "powershell -NoProfile -ExecutionPolicy Bypass -File $repo\scripts\cloud_to_local_sync.ps1"
```

## Windows 计划任务

| 任务名 | 频率 | 用途 |
|--------|------|------|
| `AxiomCoreGitSync` | 5 分钟 | 检测本地变更，自动 git add+commit+push |
| `AxiomCorePullSync` | 5 分钟 | 拉取云端最新数据到本地 |

查看：
```powershell
Get-ScheduledTask -TaskName AxiomCoreGitSync, AxiomCorePullSync | Format-Table TaskName, State, LastRunTime
```

禁用（临时维护）：
```powershell
Disable-ScheduledTask -TaskName AxiomCoreGitSync
Disable-ScheduledTask -TaskName AxiomCorePullSync
```

重新启用：
```powershell
Enable-ScheduledTask -TaskName AxiomCoreGitSync
Enable-ScheduledTask -TaskName AxiomCorePullSync
```

每次执行的日志写到 `.sync_logs/auto_git_sync.log` / `.sync_logs/cloud_to_local_sync.log`，目录已 gitignored。

## 数据维护

### 备份

本地数据库每天打包：
```powershell
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
Copy-Item data/axiom_core.db "data/axiom_core.db.$stamp.bak"
```

git 历史本身就是备份（除了 `data/axiom_core.db`，它不进 Git）。

### 重建 SQLite

如果数据库损坏：
```powershell
# 1. 备份当前文件
Copy-Item data/axiom_core.db data/axiom_core.db.corrupted

# 2. 删除
Remove-Item data/axiom_core.db

# 3. 重启服务，会自动 init_db()
python axiom_server.py

# 4. 从 logs/daily/*.md 重新导入
# （目前还没有 import 脚本，需要从 git 历史恢复）
```

### Schema 变更

`workflows/validate_frontmatter.py` 是 schema 的看门人。新增字段流程：

1. 修改 `data/schemas/*.schema.json` 加入新字段
2. 修改 `templates/*.md` 加入新字段示例
3. 运行 `python workflows/validate_frontmatter.py --path templates --verbose`
4. 修改 `axiom_server.py` 的 SQLite `CREATE TABLE` 和 Pydantic 模型
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
| 云端服务 | `journalctl -u axiom-core.service` |
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

1. 服务端 `journalctl -u axiom-core.service -f` 看 `/api/feishu/events` 命中
2. 检查飞书开放平台「事件与回调」URL 是否正确
3. 检查 `FEISHU_APP_ID` / `FEISHU_APP_SECRET` / `FEISHU_VERIFICATION_TOKEN` 三个环境变量是否设置且无空白字符

### 本地和云端不同步

1. 检查 `AxiomCorePullSync` 是否在运行（`Get-ScheduledTask`）
2. 手动执行一次 `scripts/cloud_to_local_sync.ps1` 看报错
3. 检查 DPAPI 凭据是否仍然解密成功（`scripts/axiom_secrets.ps1 -Action show`）
4. 检查云端是否真的有当天数据（`ssh root@jeffxu.cc ls /opt/axiom-core/logs/daily/ | tail -3`）

### Git push 失败

1. `git status` 看是否有冲突
2. `git pull --rebase origin main` 拉最新
3. 解决冲突后 `git push origin main`
4. 如果是 `package-lock.json` 冲突 → `git checkout web/package-lock.json` 然后 `npm ci`

## Nginx upstream 改名（从 lifeos_backend 迁移）

如果你的 nginx 配置之前用的是 LifeOS 时期的 `upstream lifeos_backend { ... }`，
切到 Axiom Core 需要同步改 upstream 名字。`server-setup/axiom-nginx.conf` 已
经用 `axiom_backend`，所以执行 `deploy_axiom_cloud.ps1` 时会自动覆盖 nginx 配
置。手动核对：

```bash
ssh root@<host>
grep -n upstream /etc/nginx/sites-available/axiom-nginx.conf
# 期望看到：upstream axiom_backend { server 127.0.0.1:8765; }

# 确认旧 conf 已经清掉
ls /etc/nginx/sites-enabled/ | grep -i lifeos    # 应该是空
ls /etc/nginx/sites-available/ | grep -i lifeos  # 应该是空

nginx -t
systemctl reload nginx
```

如果不小心 `lifeos-nginx.conf` 还在 `sites-enabled/`，会导致 nginx 启动时
"upstream lifeos_backend used but not defined" 报错。`deploy_axiom_cloud.ps1`
的 destructive cleanup 阶段会自动 `rm -f` 这两个文件，正常情况下不会残留。

## 定期审计（建议每月）

- 检查 `git log --since='1 month ago' --stat` 有无意外提交大文件
- 检查 `data/axiom_core.db` 大小（超过 100MB 需要排查）
- 检查 `output/` 是否堆积过多测试产物（可定期清空）
- 检查 `.sync_logs/` 是否有反复出现的同步错误
- 检查云端磁盘使用 `df -h /opt`
- 检查 `/etc/axiom-core/env` 权限 `ls -la /etc/axiom-core/env`（应该是 root:root 0640）

## 已知技术债

### Deploy 脚本: PowerShell here-string 注入 UTF-8 BOM

`scripts/deploy_axiom_cloud.ps1` 通过 SSH stdin 投递 here-string 远程脚本时，PowerShell 的 string-to-stdin 路径会在首字节注入一个 U+FEFF BOM。部署日志里偶发出现：

```
/bin/bash: line 1: ﻿set: command not found
```

无害：bash 把 BOM-prefixed token 当成未知命令报错，但下一行的 `set -e` 接管，后续命令照常 fail-fast。本次部署到 commit `f3fbadd` 时复现过一次，服务最终正常上线，9 路就位信号全绿。

修复方向（任一即可，优先级低）：

- 在 `Invoke-Ssh` 的每个 here-string `@"..."@` 第一行加一句 `true;`，让 BOM 落到 no-op 上
- 改用显式无 BOM UTF-8 字节流投喂 ssh stdin：

  ```powershell
  $utf8NoBom = [Text.UTF8Encoding]::new($false)
  $bytes     = $utf8NoBom.GetBytes($RemoteCommand)
  $psi = [Diagnostics.ProcessStartInfo]::new('ssh')
  $SshOpts + @($SshTarget, $RemoteShell) | ForEach-Object { $psi.ArgumentList.Add($_) }
  $psi.RedirectStandardInput = $true
  $psi.UseShellExecute        = $false
  $p = [Diagnostics.Process]::Start($psi)
  $p.StandardInput.BaseStream.Write($bytes, 0, $bytes.Length)
  $p.StandardInput.Close()
  $p.WaitForExit()
  ```

不阻塞日常部署，下次顺手做架构清理时一并处理即可。
