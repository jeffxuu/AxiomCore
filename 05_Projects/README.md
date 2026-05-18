# 05 — Projects · 项目沙盘

> 独立商业项目的沙盘。每个项目进入前必须通过 ROI + 试错成本评估。**资金严格隔离**——不挪用业务种子来救个人现金流。

## CDO 视角

Projects 是 Axiom Core 里**风险最高的目录**。这里的每一个文件都是一次"用真金白银和时间下注"的提议。CDO 在这里做的事：
1. 拒绝**多线开战**（survival ≤ 1，conservative ≤ 2，normal ≤ 3）
2. 对每个新项目执行 ROI 三维评估（`docs/decision-engine.md` §3.1）
3. 设置硬性熔断：业务种子 `hard_stop_loss_cny`（默认 30,000）超出即终止
4. 强制 `validation_deadline`：到期未达验收 → 终止，不允许"再给我一个月"

## 追踪的核心指标

每个项目作为一个子目录，下含：

```
05_Projects/
  2026-guangzhou-business/
    README.md              ← 项目定义、客户、付费理由
    decision-log.md        ← 关键决策与复盘
    finance.md             ← 资金消耗与回收
  <project-id>/
    ...
```

每个项目必须有：

| 字段 | 用途 |
|------|------|
| `project_id` | kebab-case 唯一标识 |
| `start_date` / `validation_deadline` | 验证窗口 |
| `monthly_burn_limit_cny` | 月度消耗上限 |
| `hard_stop_loss_cny` | 累计止损线 |
| `decision_status`（pending/approved/conditional/rejected/frozen） | CDO verdict |
| `success_metrics`（revenue/customers/margin） | 验收指标 |

`templates/annual-business-goal.md` 是当前主项目（广州独立业务）的标准模板。

## 录入规范

1. **每个项目开档时必须填完 `decision_status: pending` + 三维 ROI 评估**——不评估的项目不进沙盘。
2. **资金按业务账户独立核算**——本目录的 `finance.md` 是子集，主账本仍是 `02_Cashflow/`。
3. **每月强制写一次"我打算继续/暂停/终止"**——避免温水煮青蛙。
4. **`decision_status` 由 CDO 写入**——不是项目所有者一拍脑袋决定。

## 与决策引擎的关系

[../docs/decision-engine.md](../docs/decision-engine.md) §2 与 §3 同时作用：
- §2：业务种子 Burn Rate / Runway 触发冻结或终止
- §3：ROI 三维（money / skill / risk）决定能否启动
- §5：多线开战上限

## 不录什么

- ❌ "我有个想法" → 去 `06_Cognition/`，验证后再进沙盘
- ❌ 通用商业书摘 → 去 `06_Cognition/`
- ❌ 客户 contact / 合作合同 → 去 `07_Relationships/`，本目录只记业务流
- ❌ 项目用到的技术学习笔记 → 去 `04_Skills/`
