# Axiom Core · 个人决策智能核心

> 内部代号：LifeOS。systemd、Nginx upstream、环境变量、SQLite 文件、Python 入口、CSS 类名、TypeScript 类型等内部标识仍使用 `lifeos`，**不修改**——这避免了部署脚本、定时任务、监控配置全部重写的风险。Axiom Core 是品牌名（用户可见层），LifeOS 是代号（机器可读层）。

## 这是什么

Axiom Core 是一个**约束驱动的个人决策引擎**：
- 输入：每日记录、健康数据、现金流、求职进度、学习投入、项目验证数据。
- 处理：用一组明文公理推演当前阶段是否偏离主目标、是否触发风险预警。
- 输出：当前状态摘要、风险预警、明天的最重要一件事、本周需要否决的诱惑。

不是日历、不是打卡 App、不是个人 wiki。详见 [docs/product-vision.md](docs/product-vision.md)。

## 核心闭环

```
飞书 / 网页 / Markdown  录入
    ↓
SQLite + Markdown 双写
    ↓
workflows/summarize_fragments.py 自动汇总 → profile/current-state.md
    ↓
Axiom Core CDO（首席决策官）按 profile/constraints.md 公理输出 verdict
```

## 9 大文档入口

| 文档 | 用途 |
|------|------|
| [docs/product-vision.md](docs/product-vision.md) | 定位、不做什么、当前阶段 |
| [docs/life-domain-model.md](docs/life-domain-model.md) | 8 大人生域 × 物理目录映射 |
| [docs/decision-engine.md](docs/decision-engine.md) | Burn Rate / ROI / 否决规则 |
| [docs/ai-agent.md](docs/ai-agent.md) | CDO 人设、边界、失败模式 |
| [docs/architecture.md](docs/architecture.md) | 前后端、本地/云端拓扑 |
| [docs/data-flow.md](docs/data-flow.md) | 多端同步路径 |
| [docs/data-model.md](docs/data-model.md) | SQLite + frontmatter + schema 对齐 |
| [docs/security.md](docs/security.md) | Public 仓库下的脱敏规则 |
| [docs/deployment.md](docs/deployment.md) / [docs/operations.md](docs/operations.md) | 部署与日常运维 |
| [docs/roadmap.md](docs/roadmap.md) | 路线图与未决问题 |

## 物理目录

```text
00_个人总档案/        长期总档案
01_系统说明/          归档中：旧 LifeOS 时期文档
02_每日记录/          每日 Markdown 镜像
03_身体健康/          体检摘要
04_学习与技能/        简历摘要
05_赚钱与项目/        业务验证记录
06_认知与灵感/        想法与复盘
07_AI总结输出/        AI 周报、月报
docs/                 Axiom Core 文档（本次重构新建）
profile/              当前状态、Master System Prompt、约束公理
templates/            标准模板 + JSON Schema 验证
workflows/            frontmatter 校验、自动汇总
data/schemas/         JSON Schema 文件
scripts/              本地自动同步、部署、凭据管理
server-setup/         Nginx / systemd / shell 部署细节
web/                  React + TypeScript 前端
lifeos_server.py      FastAPI 后端（单文件）
```

**注意**：8 个 `00_*` ~ `07_*` 目录名**永不重命名**——已被定时任务、SSH 路径、SQLite 路径写死。详见 [docs/life-domain-model.md](docs/life-domain-model.md)。

## 启动

### 本地一体化（推荐日常）

```powershell
# 双击桌面快捷方式
打开LifeOS.cmd
# 或
启动本地看板.cmd
```

入口：http://127.0.0.1:8765/app。

### 本地开发

```powershell
python lifeos_server.py
cd web; npm ci; npm run dev
```

入口：http://127.0.0.1:5173（Vite 把 `/api/*` 代理到 8765）。

### 云端部署

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy_lifeos_cloud.ps1
```

入口：https://jeffxu.cc。详见 [docs/deployment.md](docs/deployment.md)。

## 数据校验与自动汇总

首次安装依赖：
```powershell
python -m pip install -r requirements.txt
```

校验模板：
```powershell
python workflows\validate_frontmatter.py --path templates --verbose
```

预览自动汇总（不写文件）：
```powershell
python workflows\summarize_fragments.py --dry-run
```

写入 `profile/current-state.md` 与本周 AI 周报：
```powershell
python workflows\summarize_fragments.py
```

## 飞书机器人录入

服务端预留 `POST /api/feishu/events`。云端部署后在飞书开放平台「事件与回调」配置：
```
https://你的域名/api/feishu/events
```

云端环境变量：
```
FEISHU_APP_ID=
FEISHU_APP_SECRET=
FEISHU_VERIFICATION_TOKEN=
```

支持字段：
```
睡眠 7.5 体重 80 心情 6 精力 7 支出 35 收入 100 投递 3 面试 1 英语 30 运动 40
```

未识别内容追加到当天笔记。详见 [docs/data-flow.md](docs/data-flow.md)。

## 云端登录保护

云端 `/app` 需要登录，未登录跳转 `/login`。

服务器环境变量（不写入仓库）：
```
LIFEOS_CLOUD_MODE=1
LIFEOS_WEB_USER=
LIFEOS_WEB_PASSWORD=
LIFEOS_SESSION_SECRET=           # 至少 32 位
LIFEOS_PUBLIC_HOSTNAME=jeffxu.cc
# 可选
# ALTCHA_HMAC_KEY=独立的随机密钥
```

公开路径白名单：`/login`、`/api/login`、`/api/health`、`/api/config`、`/api/auth/config`、`/api/auth/me`、`/api/feishu/events`、`/api/altcha`。其余 API 需要登录 Cookie。

本地凭据由 DPAPI 加密：
```powershell
powershell -ExecutionPolicy Bypass -File scripts\lifeos_secrets.ps1 -Action set
```

详见 [docs/security.md](docs/security.md)。

## 云端、本地与 GitHub 同步

```
飞书 → 云端 /api/feishu/events
       ↓
    云端 SQLite + 02_每日记录/YYYY-MM-DD.md
       ↓
    云端 cron 自动 git push
       ↓
    本地 PersonalAIProfileGitSync (5 分钟) git pull
       ↓
    本地 LifeOSCloudPullSync (5 分钟) SSH 拉数据
       ↓
    本地 SQLite + 02_每日记录/
```

详见 [docs/data-flow.md](docs/data-flow.md)。

## 版本管理与安全提醒

- Git 保存每一次变动。
- GitHub **公开仓库**用于云端备份：[jeffxuu/personal-ai-growth-profile](https://github.com/jeffxuu/personal-ai-growth-profile)
  - ⚠️ 仓库是 Public：`.gitignore` 已排除 `私钥文件`、`*.pem`、`*.key`、`.env*`、`.lifeos-secrets/`、`原始体检报告/`、`原始简历/`、`*.pdf` 等原始敏感文件；仓库内**只保留经过脱敏的摘要**（信用、体检、简历摘要）。
  - 提交前自检：`git status` 确认没有以上模式的新增文件；新增任何含真实账号、电话、住址、密钥的内容前，先评估是否应该走私有/加密存储而非 Git。
- 需要回溯时，可以用 `git log` 查看历史版本或恢复旧版本文件。

## 自动同步

`scripts/auto_git_sync.ps1` 每 5 分钟检测一次本地变动，自动提交并推送 `origin/main`。无变动则不提交。注意：**main 上未保存的实验 5 分钟内会被自动提交**，谨慎写敏感数据。

Windows 任务名：
- `PersonalAIProfileGitSync` — 本地 → GitHub
- `LifeOSCloudPullSync` — 云端 → 本地

## 关键不变量

1. **物理目录名永不修改**（00_~07_ 中文目录）。详见 [docs/life-domain-model.md](docs/life-domain-model.md)。
2. **systemd 服务名 `lifeos.service` 永不修改**。详见 [docs/deployment.md](docs/deployment.md)。
3. **SQLite 是运行态，Markdown 是档案态**。读取以 SQLite 为准。
4. **`<!-- LIFEOS:BEGIN -->` / `<!-- LIFEOS:END -->` 区块由服务程序独占**，手工编辑会被下次写入覆盖。区块外的笔记自由发挥。
5. **决策引擎按 `profile/constraints.md` 公理推演**，不依赖默会规则。详见 [docs/decision-engine.md](docs/decision-engine.md)。
