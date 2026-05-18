# Axiom Core Constraints

> 这是 Axiom Core 决策引擎的**硬性公理**。任何建议、Approval、Conditional 都必须能引用其中的具体条款。引擎不能"凭感觉"放行。

> 内部代号：LifeOS Constraints。

## 设计原则

1. **明文 > 默会**。所有约束都写在这里，引擎不依赖"应该都知道"的常识。
2. **可量化 > 形容词**。"健康"不是约束；`sleep_quality == poor` 连续 3 天才是约束。
3. **硬否决 > 软建议**。本文档列出的红线**不被任何对话同意覆盖**。
4. **触发 > 持续**。约束以"触发条件 → 引擎动作"形式表达，便于后续把它转成可执行的规则。

---

## 公理 §1. 模式与触发

引擎在三种模式间自动切换。模式越严，越多提议被否决。

### §1.1 survival 模式

**任一触发 → 进入 survival**：

- `personal_cash.runway_months < 3`（个人跑道少于 3 个月）
- `sleep_quality == poor` 连续 ≥ 3 天
- `weight_kg` 周降 > 2kg
- 出现胸痛、晕厥、异常出血、持续头痛 ≥ 3 天等任何医学红灯

**survival 行为**：
- 否决一切非求职、非健康投入
- 否决任何需要花钱的事
- 只允许：求职动作、最低成本健康恢复、最低还款支付

### §1.2 conservative 模式

**任一触发 → 进入 conservative（且 survival 未触发）**：

- `personal_cash.runway_months < 6`
- `business_cash.runway_months < 6`
- `cashflow_status == "red"` 或 `capital_status in ("spent", "cancelled")`

**conservative 行为**：
- 否决非必要消费、新订阅、新长期项目
- 允许零成本学习（英语、供应链、AI 工具）
- 允许已有订阅续费（如 GitHub、域名）

### §1.3 normal 模式

**两项都达标**：

- `personal_cash.runway_months >= 6`
- `business_cash.runway_months >= 6`
- 健康指标全绿

**normal 行为**：
- 允许探索性投入
- 仍按 §3 ROI 评估提议

---

## 公理 §2. Burn Rate 红线

两笔现金流**完全独立**核算。不允许互相补贴，不允许互相挪用。

### §2.1 个人现金流（personal_cash）

读取自 `templates/finance-dashboard.md` 的 frontmatter `personal_cash` 节点。

```yaml
personal_cash:
  cash_on_hand_cny: <number>
  monthly_burn: <number>  # 最近 3 个月平均支出，由 summarize_fragments.py 计算
  runway_months: cash_on_hand_cny / monthly_burn
  minimum_repayment_cny: <number>
  cashflow_status: green | yellow | red
```

**红线**：

| 触发 | 引擎动作 |
|------|---------|
| `runway_months < 3` | 进入 survival（见 §1.1） |
| `runway_months < 6` | 进入 conservative（见 §1.2） |
| `minimum_repayment_cny > monthly_income` 连续 2 个月 | 硬否决所有非求职投入；强制提示破产/重组评估 |
| 用业务资金支付个人开销 | 硬否决，无例外 |

### §2.2 业务种子资金（business_cash）

读取自 `templates/finance-dashboard.md` 的 `business_cash` 节点 + `templates/annual-business-goal.md`。

```yaml
business_cash:
  account_separated: true       # 必须 true；false 直接告警
  budget_total_cny: 100000
  budget_spent_cny: <number>
  monthly_burn_forecast_cny: <number>
  runway_months: (budget_total - budget_spent) / monthly_burn_forecast
  allowed_transfer_to_personal: false  # 必须 false
```

**红线**：

| 触发 | 引擎动作 |
|------|---------|
| `account_separated != true` | 硬告警，要求立即隔离账户 |
| `allowed_transfer_to_personal != false` | 硬告警，提议本身违反公理 |
| `runway_months < 6` 且未达验证里程碑 | 冻结业务支出，转入"假设验证"阶段 |
| 当前日期 > `validation_deadline` 且未达成验收指标 | 触发业务终止评估，不允许继续追加预算 |
| `budget_spent_cny > hard_stop_loss_cny`（默认 30000） | 硬熔断，停止一切支出 |

---

## 公理 §3. ROI 评估

任何新项目、新订阅、新学习投入都必须通过 ROI 评估。ROI 是**三维向量**，不是单一收益率。

### §3.1 提议数据结构

```yaml
proposal:
  name: "<提议名称>"
  expected_value:
    money_per_month: <number>      # 预期月度现金流贡献
    skill_compounding: 0|1|2|3     # 0=不复利, 3=三年后仍有用
    risk_reduction: 0|1|2|3        # 0=不降风险, 3=直接降低 survival 风险
  cost:
    money_upfront: <number>        # 一次性投入
    money_monthly: <number>        # 长期月度成本
    time_per_week_hours: <number>
    cognitive_load: 0|1|2|3        # 0=易做, 3=持续占用注意力
  decision_status: pending | approved | rejected | conditional | frozen
```

### §3.2 各模式下的放行阈值

**survival 模式**：
- 只放行 `risk_reduction >= 2` 的提议
- 任何 `money_monthly > 0` 的提议都被否决（哪怕 ROI 为正）
- 时间投入 `time_per_week_hours > 5` 默认否决（必须先用于求职）

**conservative 模式**：
- 放行 `risk_reduction >= 2` 或 `skill_compounding >= 2`
- `money_upfront > 1000` 需明文论证
- `money_monthly > 100` 需明文论证

**normal 模式**：
- 放行 `expected_value.money_per_month >= cost.money_monthly * 2`，或者
- 放行 `risk_reduction >= 1` 且 `cost.money_monthly == 0`

### §3.3 自动否决条件（所有模式）

无论模式如何，以下情况一律否决：

- `cognitive_load == 3` 且 `risk_reduction == 0`（注意力黑洞，不降低风险）
- `money_per_month == 0` 且 `skill_compounding == 0`（既不赚钱又不复利）
- 触发任一 §1 / §2 / §4 红线

---

## 公理 §4. 健康与作息红线

引擎对健康问题**比对钱更严**。健康崩盘会让所有其他规划失效。

### §4.1 作息红线

| 触发 | 引擎动作 |
|------|---------|
| `sleep_quality == poor` 连续 3 天 | 强制要求停止高强度脑力学习和高强度健身，只允许散步、拉伸、晒太阳 |
| 入睡时间 > 02:00 连续 3 天 | 同上 + 强制要求重置生物钟动作 |
| 日均 `sleep_hours < 5` 连续 5 天 | 进入 survival（§1.1）+ 提示求助专业医生 |

### §4.2 体征红线

| 触发 | 引擎动作 |
|------|---------|
| `weight_kg` 周降 > 2kg | 硬告警，可能涉及病理状态，建议就医 |
| 出现胸痛、晕厥、异常出血、持续头痛 ≥ 3 天 | 跳过 verdict 流程，直接推送医疗资源 |
| 抑郁/自伤念头 | 跳过 verdict 流程，推送危机援助 |

### §4.3 运动约束

- `sleep_quality == poor` 时禁止高强度力量训练
- 体脂率/体重未稳定前禁止减脂训练
- 求职高峰期（每周 < 30 次投递）禁止占用 > 3 小时/周 的健身

---

## 公理 §5. 目标克制原则

引擎拒绝"多目标并发"。

### §5.1 单兵突破

- survival 模式：同时进行的"新项目"≤ 1 个（求职动作不算新项目）
- conservative 模式：同时进行的"新项目"≤ 2 个
- normal 模式：≤ 3 个

### §5.2 目标替换规则

- 不允许用"学习" / "调研" / "复盘"替代真实投递动作
- 不允许用"做副业"替代当前求职
- 不允许同时学习多门技能（英语 + 供应链 + AI 任选其一为主线）

---

## 公理 §6. 数据真实性

引擎只信任**进入系统的结构化数据**。

| 来源 | 信任度 |
|------|-------|
| `templates/*.md` 的 frontmatter | 高 |
| `02_每日记录/*.md` 的 LIFEOS:BEGIN/END 区块 | 高 |
| `profile/current-state.md` 的自动汇总 | 中（基于上面两者计算） |
| 使用者对话中的口头陈述 | 低（除非同步写入上面任一文件） |

冲突时引擎应：
1. 显式指出冲突
2. 引用文件路径和具体字段
3. 要求使用者先把信息写入相应文件，再重新评估

---

## 公理 §7. 紧急豁免

以下情况引擎跳过本文档所有公理：

- 真实医学紧急情况
- 自我伤害风险
- 法律 / 安全紧急情况

引擎不在这些场景下输出 verdict，而是直接推送权威资源（120 急救、心理援助、报警等）。

---

## 文档版本

| 版本 | 日期 | 变更 |
|------|------|------|
| 0.1 | < 2026-05 | LifeOS 时期，仅含业务跑道单一约束 |
| 1.0 | 2026-05-18 | Axiom Core 重构：模式（§1）+ Burn Rate（§2）+ ROI（§3）+ 健康（§4）+ 克制（§5）+ 真实性（§6）+ 豁免（§7） |
