# 安全与隐私

## 仓库可见性

> **当前 GitHub 仓库是 Public**：[jeffxuu/personal-ai-growth-profile](https://github.com/jeffxuu/personal-ai-growth-profile)

这意味着**任何人都能克隆、阅读、grep 仓库内容**。所有安全策略以"Public 兜底"为前提设计。

## 已通过 `.gitignore` 排除的敏感文件

```
.env
.env.*
.axiom-secrets/
私钥文件
私钥文件.pub
*.pem
*.key
**/原始体检报告/
**/原始简历/
*.pdf
data/axiom_core.db
*.tgz
*.zip
```

提交前自检：

```powershell
git status --short --branch
# 应该看不到任何上述模式
```

## 仓库内的"摘要"文件

以下文件**已在 Public 仓库内**，使用者需自行评估是否可接受：

- `00_*/个人信用报告摘要.md` — 来自人行征信报告的脱敏摘要
- `01_Health/体检报告摘要.md` — 来自体检 PDF 的关键指标
- `04_Skills/简历信息摘要.md` — 简历主要经历
- `profile/master-system-prompt.md` — 长期目标与现状

**判断标准**：如果一个真人能从这份摘要里推断出"你具体住哪、电话多少、银行卡号"，则需要进一步脱敏。当前的实现假设：
- 不写真实身份证号
- 不写完整电话号码（最多写后 4 位）
- 不写真实银行账号
- 不写明文密码

**如果使用者不接受摘要也公开**：把这些文件移到 `.axiom-secrets/`（已 gitignore）目录下，并修改 `axiom_server.py` 中 `DOC_SPECS` 的 `relative_path` 指向新位置。

## 本地敏感凭据

按敏感程度从高到低：

| 类型 | 存放方式 | 加密手段 |
|------|---------|---------|
| 云端服务器 SSH 私钥 | `~/.ssh/axiom_core_ed25519` 或 DPAPI 加密配置 | Windows DPAPI |
| 飞书 App Secret | 服务器环境变量 | 不进仓库 |
| 云端登录密码 | 服务器环境变量 `AXIOM_WEB_PASSWORD` | bcrypt（运行时） |
| 会话密钥 | 服务器环境变量 `AXIOM_SESSION_SECRET` | ≥ 32 字符 |
| ALTCHA HMAC 密钥 | 同上或独立 `ALTCHA_HMAC_KEY` | 独立时更安全 |
| 个人云端登录账号 | 本地 DPAPI | `scripts/axiom_secrets.ps1` |

设置本地凭据：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\axiom_secrets.ps1 -Action set
```

读取（仅显示非敏感字段）：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\axiom_secrets.ps1 -Action show
```

## 服务端鉴权机制

1. **登录**：用户名密码 + ALTCHA 工作量证明（PoW）。
2. **会话**：bcrypt 比对密码后下发 `axiom_session` cookie，TTL 8 小时。
3. **失败锁定**：
   - IP 维度：15 分钟内 8 次失败 → 该 IP 锁定
   - 账号维度：5 次连续错误 → 账号 10 分钟锁定
   - IP 速率：每 IP 每分钟 5 次登录请求
4. **公开路径白名单**：见 `is_public_path()`，只有以下公开：
   - `/login`、`/api/login`、`/api/health`、`/api/auth/config`、`/api/auth/me`、`/api/config`
   - `/api/feishu/events`（用飞书 verification token 自验签名）
   - `/api/altcha`、`/api/altcha/debug`、`/altcha.min.js`
   - `/favicon*`

## 飞书回调验证

`/api/feishu/events` 是公开的，但所有请求都要：
1. 通过 `verification_token` 一致性检查
2. 通过 `Encrypt-Key` 解密（如果启用加密）
3. URL 验证回调单独处理

未通过的请求**直接返回 200 + 静默丢弃**（防止泄露内部错误信息给攻击者）。

## 与第三方 LLM API 的关系

**Axiom Core 自身不调用任何 LLM API**。LLM 决策由用户在外部工具（Claude Code、ChatGPT、Cursor 等）里完成，由 LLM 读取 `profile/` 和 `docs/` 文件。

含义：
- 个人摘要文件被 LLM 读取后会**作为 prompt 内容发送到 OpenAI/Anthropic 服务器**。
- 这是用户自己的选择，不是 Axiom Core 自动行为。
- 如果不想让某段内容进入 LLM 上下文，**就不要打开/拉取该文件给 LLM 读**。

## 数据传输

- 本地 → 云端：SSH（`Cipher`、`KeyExchange` 由 OpenSSH 默认）
- 云端 → 浏览器：HTTPS（Let's Encrypt 证书，Nginx 配置见 `server-setup/axiom-nginx.conf`）
- 飞书 → 云端：HTTPS（飞书侧强制）

## 攻击面与已知风险

| 风险 | 现状 | 缓解 |
|------|------|------|
| Public 仓库泄露身份 | 已脱敏 | 持续审查新增内容 |
| 密码暴力破解 | 有锁定 | 强密码 + ALTCHA |
| SSH 私钥泄露 | DPAPI 加密 | 不复制到其他设备 |
| 飞书 secret 泄露 | 服务器环境变量 | 不写日志、不复制到代码 |
| GitHub Token 泄露 | 仓库不含 token | 用 SSH 而非 HTTPS push |
| 本地 SQLite 直接读取 | 仅本机可访问 | 文件权限默认即可 |
| 备份 .tgz/.zip 误传 | 已 gitignore | 提交前 `git status` 自检 |

## 安全事件响应

如发现密钥泄露：

1. **立即旋转**：换 SSH key、刷新飞书 secret、重置云端密码、重置会话密钥。
2. **撤销**：在第三方平台（GitHub、飞书）撤销旧凭据。
3. **审计**：检查 `2026-XX-XX` 前后 7 天的服务器日志和 git push 记录。
4. **改进**：把根因写进本文档的"已知风险"表。
