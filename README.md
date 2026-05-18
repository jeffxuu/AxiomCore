# Axiom Core

**个人决策智能核心 · 2026 重启版**

> 不是日历，不是打卡 App，不是个人 wiki。
> 这是一个 **约束驱动的决策引擎** —— 用一组明文公理对当前阶段的所有提议给出 `approve` / `reject` / `conditional` 的硬性判定，并在每次违反约束时显式拒绝。

---

## 状态

| 阶段 | 状态 |
|------|------|
| Phase 0 — 焦土拷贝、剥离个人数据、禁用旧自动化任务 | ✅ |
| Phase 1 — 9 大领域骨架 + CDO READMEs + Genesis commit | ✅ |
| Phase 2 — 抹除 LifeOS DNA、跨栈重命名、删除 22 个死代码组件 | ✅ |
| Phase 3 — DevOps 重构：destructive deploy 脚本 + systemd unit + Nginx | ✅ |
| Phase 4 — 对外品牌门面 | ✅（你正在看的就是它） |
| Phase 5 — 推送到新 GitHub 仓库 | 进行中 |

**Greenfield rebuild**：本仓库从 [`jeffxuu/personal-ai-growth-profile`](https://github.com/jeffxuu/personal-ai-growth-profile)（已弃用）完全脱钩，零 LifeOS 兼容名，重写后端入口、SQLite 表、systemd 服务、Nginx upstream、CSS 类名、TypeScript 类型。详见 [docs/roadmap.md](docs/roadmap.md)。

---

## 这是什么

一个 **单用户、本地优先、可在云端镜像** 的个人决策系统：

```
[飞书 / 网页 / Markdown 录入]
            ↓
    SQLite (axiom_core.db) + Markdown 双写
            ↓
   workflows/summarize_fragments.py  自动汇总
            ↓
    profile/current-state.md  当前状态快照
            ↓
[ Axiom Core 首席决策官 (CDO) — 按 profile/constraints.md 公理推演 ]
            ↓
      verdict + rationale + ≤ 3 个可执行动作
```

**与"AI 个人助手"的差别**：CDO 不安慰、不闲聊、不假装记得过去对话。它只回答一个问题——按当前公理，这个提议能不能放行。

详见 [docs/product-vision.md](docs/product-vision.md) 和 [docs/ai-agent.md](docs/ai-agent.md)。

---

## 9 大人生域

| # | 域 | 角色 |
|---|----|------|
| 1 | [01_Health/](01_Health/) | 物理底座，所有决策的乘数因子 |
| 2 | [02_Cashflow/](02_Cashflow/) | Burn Rate 与 runway，决定运行 mode（survival / conservative / normal）|
| 3 | [03_Career/](03_Career/) | 求职 + 商业探索的变现路径 |
| 4 | [04_Skills/](04_Skills/) | 复利杠杆，ROI 评估的 `skill_compounding` 数据源 |
| 5 | [05_Projects/](05_Projects/) | 独立商业沙盘，每项目独立子目录，强制 ROI + validation_deadline |
| 6 | [06_Cognition/](06_Cognition/) | 未验证灵感的栖息地 |
| 7 | [07_Relationships/](07_Relationships/) | 商业人脉、客户、合作伙伴 |
| 8 | [08_Decisions/](08_Decisions/) | CDO verdict 的审计轨迹 |
| 9 | [09_Principles/](09_Principles/) | 公理修订与废除档案，宪法层 |

每个目录有 CDO 视角的 `README.md`，强制写明 **追踪指标 / 录入规范 / 红线触发 / 不录什么**。详见 [docs/life-domain-model.md](docs/life-domain-model.md)。

---

## 核心架构

| 层 | 技术 |
|---|------|
| 后端入口 | `axiom_server.py`（单文件 FastAPI + Pydantic v2 + Uvicorn）|
| 运行态存储 | SQLite (`data/axiom_core.db`, gitignored) |
| 档案态存储 | Markdown + YAML frontmatter（进 Git）|
| Schema 校验 | JSON Schema (`data/schemas/`) + `workflows/validate_frontmatter.py` |
| 前端 | React 18 + TypeScript + Vite + Tailwind |
| 部署 | systemd (`axiom-core.service`) + Nginx (`axiom_backend` upstream) + 自托管 ALTCHA |
| 录入入口 | 飞书机器人 / 网页表单 / 手编 Markdown |
| 自动化 | Windows Scheduled Task × 2（`AxiomCoreGitSync`、`AxiomCorePullSync`）|

详见 [docs/architecture.md](docs/architecture.md)。

---

## 决策引擎是真的

不是装饰品。`profile/constraints.md` 有 7 节公理（模式触发 / Burn Rate 红线 / ROI 三维评估 / 健康冷峻指标 / 目标克制 / 数据真实性 / 紧急豁免），每条都引用到具体字段和阈值。

举例：

```yaml
proposal:
  name: "买一个 ¥1980 的英语训练营"
  expected_value:
    money_per_month: 0        # 不直接带来现金流
    skill_compounding: 2      # 中期有用
    risk_reduction: 0         # 不降低 survival 风险
  cost:
    money_upfront: 1980
    money_monthly: 0
    time_per_week_hours: 5
    cognitive_load: 2
```

在 `personal_cash.runway_months < 6`（conservative 模式）下，引擎按 §3.2 评估：
> `money_upfront > 1000` 需明文论证；`risk_reduction == 0` 且 `money_monthly == 0` 不触发自动否决，但需在 `08_Decisions/` 留下 verdict 日志。

结论：`conditional` — 需要先把"放弃这 1980 元会损失什么"写到 06_Cognition/ 里，再回来 verdict。

详见 [docs/decision-engine.md](docs/decision-engine.md)。

---

## 快速启动

```bash
# 1. Python 依赖
python -m pip install -r requirements.txt

# 2. 前端依赖 + dev server
cd web && npm ci && npm run dev    # 一个终端

# 3. 后端（另一个终端）
python axiom_server.py

# 4. 浏览器
open http://127.0.0.1:5173
```

校验所有 frontmatter：

```bash
python workflows/validate_frontmatter.py --path templates --verbose
```

一键云端部署（首次会自动摧毁旧 LifeOS 安装）：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy_axiom_cloud.ps1
```

详见 [docs/deployment.md](docs/deployment.md)。

---

## 文档索引

| 文档 | 用途 |
|------|------|
| [docs/product-vision.md](docs/product-vision.md) | 定位、不做什么、当前阶段 |
| [docs/life-domain-model.md](docs/life-domain-model.md) | 9 大域 × 物理目录映射 |
| [docs/decision-engine.md](docs/decision-engine.md) | Burn Rate / ROI / 否决规则 |
| [docs/ai-agent.md](docs/ai-agent.md) | CDO 人设、边界、失败模式 |
| [docs/architecture.md](docs/architecture.md) | 前后端 + 本地/云端拓扑 |
| [docs/data-flow.md](docs/data-flow.md) | 多端同步路径 |
| [docs/data-model.md](docs/data-model.md) | SQLite + frontmatter + JSON Schema 三层对齐 |
| [docs/security.md](docs/security.md) | Public 仓库下的脱敏规则 |
| [docs/deployment.md](docs/deployment.md) | 一键部署流程 |
| [docs/operations.md](docs/operations.md) | 日常运维 + Nginx 命令 |
| [docs/roadmap.md](docs/roadmap.md) | 近期 / 季度 / 年度路线 |
| [server-setup/DEPLOYMENT.md](server-setup/DEPLOYMENT.md) | 服务器侧底层细节 |
| [scripts/README.md](scripts/README.md) | 本地自动化脚本说明 |

---

## 是不是开源项目

**不是。** 这是一个公开可读的个人系统，目的是：

1. 自我审计（强迫所有约束写明文）
2. 远程恢复能力（任何一台 Windows + Python + Node 都能拉起）
3. 给读到这里的潜在合作伙伴看：我用什么样的纪律性处理自己的现金流、健康、商业探索

**不接受 issue/PR**。Fork 自用没问题。

---

## 安全说明

仓库是 **Public**，但 `.gitignore` 已排除：

- `*.pem`、`*.key`、`私钥文件`、`.env*`、`.axiom-secrets/`
- `data/*.db*`（运行态 SQLite）
- `*.pdf`（原始体检 / 简历）
- `logs/`、`output/`、`node_modules/`

仓库内只保留 **代码 + 公开文档 + 9 大域的 CDO READMEs**。任何含真实账号、电话、密钥、原始诊疗 / 财务凭据的内容都**不进 Git**。详见 [docs/security.md](docs/security.md)。

---

## 关键不变量（greenfield 之后不再变更）

1. **9 大物理目录名** `01_Health/` ~ `09_Principles/`
2. **systemd 服务名** `axiom-core.service`
3. **数据库文件名** `data/axiom_core.db`
4. **后端入口** `axiom_server.py`
5. **Markdown 区块标记** `<!-- AXIOM:BEGIN -->` / `<!-- AXIOM:END -->`
6. **环境变量前缀** `AXIOM_*`
7. **决策引擎按 [profile/constraints.md](profile/constraints.md) 公理推演**

下次再改这些 = 重做一遍 Phase 2 焦土。慎重。

---

## License

无开源 license。代码与文档版权归 [@jeffxuu](https://github.com/jeffxuu)。阅读、参考思路均可；不要克隆到你自己的 production 环境运行。
