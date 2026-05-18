# 02 — Cashflow · 财务与资本

> 严控启动资金与现金流，设置 Burn Rate（资金消耗率）警戒线。两笔钱完全独立——个人现金流 vs 业务种子资金，互不挪用。

## CDO 视角

钱在 Axiom Core 里**不是数字游戏，是跑道长度**。`runway_months` 决定模式（survival / conservative / normal），模式决定哪些提议被否决。任何"我有个机会要不要试试"的对话都从这里开始。

## 追踪的核心指标

### 个人现金流（personal_cash）

| 指标 | 频率 | 红线 |
|------|------|------|
| `cash_on_hand_cny` | 周 | — |
| `monthly_burn`（3 月均支出） | 月 | — |
| `runway_months` | 月 | < 3 → survival；< 6 → conservative |
| `minimum_repayment_cny` | 月 | 连续 2 月 > monthly_income → 强制提示破产/重组评估 |
| `debt_total_estimated_cny` | 季 | — |
| `cashflow_status`（green/yellow/red） | 月 | red → 进入 conservative |

### 业务种子（business_cash）

| 指标 | 频率 | 红线 |
|------|------|------|
| `account_separated` | 不变 | **必须 true**；false → 立即告警 |
| `budget_total_cny`（默认 100,000） | 年 | — |
| `budget_spent_cny` | 月 | > `hard_stop_loss_cny`（默认 30,000）→ 硬熔断 |
| `monthly_burn_forecast_cny` | 月 | — |
| `runway_months` | 月 | < 6 且未达验证里程碑 → 冻结业务支出 |
| `validation_deadline` | 年 | 越过且未达验收 → 触发终止评估 |
| `allowed_transfer_to_personal` | 不变 | **必须 false**；任何转入个人提议 → 硬否决 |

## 录入规范

1. **同步源是 `templates/finance-dashboard.md` 的 frontmatter**，本目录只放复盘文本和异常说明。
2. **从银行 App 或对账单录数字**，不要凭记忆。
3. **业务钱独立账户**：必须有真实的、与个人账户不同的银行账户/子账户，不能仅仅"心理上分开"。

## 与决策引擎的关系

[../docs/decision-engine.md](../docs/decision-engine.md) §2 与本目录最强耦合：
- 决定当前模式
- 决定 ROI 阈值
- 决定哪些提议被自动否决
- 决定业务是否进入"冻结"或"终止评估"

## 不录什么

- ❌ 投资理念、宏观经济分析 → 去 `06_Cognition/`
- ❌ 具体项目的预期收益 → 去 `05_Projects/`
- ❌ 客户付款承诺（未到账） → 去 `07_Relationships/`，到账时再来这里
