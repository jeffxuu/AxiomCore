# Axiom Core · 个人决策智能核心

> **2026 重启版（greenfield）**。整套系统所有标识符（systemd、env、CSS、类型、API、数据库表、文件名）统一使用 `axiom-core` / `AXIOM_*`，**不保留任何 LifeOS 兼容名**。前身仓库 `jeffxuu/personal-ai-growth-profile` 已归档不再维护。

## 这是什么

Axiom Core 是一个**约束驱动的个人决策引擎**：

- **输入**：每日记录、健康数据、现金流、求职动作、学习投入、项目验证数据。
- **处理**：用一组明文公理（[profile/constraints.md](profile/constraints.md)）推演当前阶段是否偏离主目标、是否触发风险红线。
- **输出**：approve / reject / conditional 三类 verdict + 数字化 rationale + ≤ 3 条立即可执行动作。

不是日历、不是打卡 App、不是个人 wiki。详见 [docs/product-vision.md](docs/product-vision.md)。

## 核心闭环

```
飞书 / 网页 / Markdown  录入
    ↓
SQLite (axiom_core.db) + Markdown 双写
    ↓
workflows/summarize_fragments.py 自动汇总 → profile/current-state.md
    ↓
Axiom Core CDO 按 profile/constraints.md 公理推演 verdict
```

## 9 大人生域

每个域是物理目录 + CDO 视角的 README + 与决策引擎的契约。

| # | 域 | 用途 |
|---|----|------|
| 1 | [01_Health/](01_Health/README.md) | 物理底座，一切决策的乘数因子 |
| 2 | [02_Cashflow/](02_Cashflow/README.md) | Burn Rate 与 runway，决定 mode |
| 3 | [03_Career/](03_Career/README.md) | 求职 + 商业探索 |
| 4 | [04_Skills/](04_Skills/README.md) | 复利杠杆，ROI 数据源 |
| 5 | [05_Projects/](05_Projects/README.md) | 商业沙盘，每项目独立子目录 |
| 6 | [06_Cognition/](06_Cognition/README.md) | 未验证灵感的栖息地 |
| 7 | [07_Relationships/](07_Relationships/README.md) | 商业人脉、客户、合作伙伴 |
| 8 | [08_Decisions/](08_Decisions/README.md) | CDO verdict 的审计轨迹 |
| 9 | [09_Principles/](09_Principles/README.md) | 公理修订与废除档案，宪法层 |

详见 [docs/life-domain-model.md](docs/life-domain-model.md)。

## 系统文档

| 文档 | 用途 |
|------|------|
| [docs/product-vision.md](docs/product-vision.md) | 定位、不做什么、当前阶段 |
| [docs/life-domain-model.md](docs/life-domain-model.md) | 9 大域 × 物理目录 |
| [docs/decision-engine.md](docs/decision-engine.md) | Burn Rate / ROI / 否决规则 |
| [docs/ai-agent.md](docs/ai-agent.md) | CDO 人设、边界、失败模式 |
| [docs/architecture.md](docs/architecture.md) | 前后端、本地/云端拓扑 |
| [docs/data-flow.md](docs/data-flow.md) | 多端同步路径 |
| [docs/data-model.md](docs/data-model.md) | SQLite + frontmatter + schema 对齐 |
| [docs/security.md](docs/security.md) | Public 仓库下的脱敏规则 |
| [docs/deployment.md](docs/deployment.md) | 部署流程 |
| [docs/operations.md](docs/operations.md) | 日常运维 |
| [docs/roadmap.md](docs/roadmap.md) | 路线图与未决问题 |

## 物理目录

```text
01_Health/ ~ 09_Principles/   9 大域，每个目录有 CDO 视角的 README
docs/                         系统文档
profile/                      Master System Prompt + constraints + current-state
templates/                    daily-health / finance-dashboard / annual-business-goal
workflows/                    frontmatter 校验 + 自动汇总
data/schemas/                 JSON Schema 文件
server-setup/                 Nginx / systemd / shell 部署细节
web/                          React + TypeScript 前端
axiom_server.py               FastAPI 后端（单文件入口）
logs/daily/                   每日 Markdown 镜像（运行态，不进 Git）
data/axiom_core.db            SQLite 运行态（不进 Git）
```

## 启动

### 本地开发

```powershell
python axiom_server.py            # 终端 1：起后端
cd web; npm ci; npm run dev       # 终端 2：起 Vite dev
```

入口：http://127.0.0.1:5173（Vite 代理 `/api/*` 到 8765）。

### 本地一体化

```powershell
python axiom_server.py
```

入口：http://127.0.0.1:8765/app（FastAPI 直接 serve `web/dist/`，需要先 `npm run build`）。

### 云端部署

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy_axiom_cloud.ps1
```

入口：https://jeffxu.cc。详见 [docs/deployment.md](docs/deployment.md)。

> 注：`scripts/` 目录在 greenfield 重建时被全部丢弃。`deploy_axiom_cloud.ps1` 和相关运维脚本将在 Phase 3 重新撰写。

## 数据校验与自动汇总

```powershell
python -m pip install -r requirements.txt            # 首次
python workflows\validate_frontmatter.py --path templates --verbose
python workflows\summarize_fragments.py --dry-run    # 预览
python workflows\summarize_fragments.py              # 写 profile/current-state.md
```

## 云端登录保护

云端 `/app` 需要登录，未登录跳转 `/login`。

服务器环境变量（不写入仓库）：

```env
AXIOM_CLOUD_MODE=1
AXIOM_WEB_USER=
AXIOM_WEB_PASSWORD=
AXIOM_SESSION_SECRET=           # 至少 32 位
AXIOM_PUBLIC_HOSTNAME=jeffxu.cc
# 可选
# ALTCHA_HMAC_KEY=独立的随机密钥
```

公开路径白名单：`/login`、`/api/login`、`/api/health`、`/api/config`、`/api/auth/config`、`/api/auth/me`、`/api/feishu/events`、`/api/altcha`。其余 API 需要登录 Cookie。

详见 [docs/security.md](docs/security.md)。

## 飞书机器人录入

服务端预留 `POST /api/feishu/events`。云端部署后在飞书开放平台「事件与回调」配置：

```
https://你的域名/api/feishu/events
```

云端环境变量：

```env
FEISHU_APP_ID=
FEISHU_APP_SECRET=
FEISHU_VERIFICATION_TOKEN=
```

支持字段：

```
睡眠 7.5 体重 80 心情 6 精力 7 支出 35 收入 100 投递 3 面试 1 英语 30 运动 40
```

未识别内容追加到当天笔记。详见 [docs/data-flow.md](docs/data-flow.md)。

## 版本管理与安全提醒

- Git 保存每一次变动。
- GitHub 仓库（待 Phase 5 推送）：**新建仓库**，前身 `jeffxuu/personal-ai-growth-profile` 已废弃。
- ⚠️ 仓库是 Public：`.gitignore` 已排除 `*.pem`、`*.key`、`.env*`、`.axiom-secrets/`、`*.pdf`、`data/*.db` 等敏感文件；仓库内**只保留代码 + 公开文档 + CDO READMEs**。任何含真实账号、电话、密钥的内容**不进 Git**。
- 提交前自检：`git status --short` 确认没有以上模式的新增文件。

## 关键不变量（不再变更）

1. **9 大物理目录名永不修改**（`01_Health/` ~ `09_Principles/`）
2. **systemd 服务名 `axiom-core.service` 永不修改**
3. **SQLite 是运行态，Markdown 是档案态**。读取以 SQLite 为准
4. **`<!-- AXIOM:BEGIN -->` / `<!-- AXIOM:END -->` 区块由服务程序独占**，手工编辑会被下次写入覆盖
5. **决策引擎按 [profile/constraints.md](profile/constraints.md) 公理推演**，不依赖默会规则
