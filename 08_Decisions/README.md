# 08 — Decisions · 决策日志

> 重大决策的推演日志与复盘。**CDO 的工作产物全部沉淀在这里**——approve / reject / conditional 的每一次输出。

## CDO 视角

Decisions 是 Axiom Core 的**审计轨迹（audit trail）**。没有这个目录，CDO 的判断就是空谈：
- 决策当时引用了哪些数据？
- 当时模式是 survival/conservative/normal？
- 后续证据是否支持了当初的 verdict？

CDO 在这里做的事：
1. 每个重大决策**必须**留下一份决策日志（verdict + rationale + required_actions）
2. 每月强制复盘——上月哪些 verdict 被现实证伪
3. 持续校准约束公理——证伪率太高的约束需要回 `09_Principles/` 修正

## 录入规范

每次决策一个独立文件：

```
08_Decisions/
  2026-05-18-resign-current-job.md
  2026-05-22-new-business-lead-evaluation.md
  ...
```

文件命名：`YYYY-MM-DD-<kebab-summary>.md`

每个决策文件必填 frontmatter：

```yaml
---
type: decision
decision_id: 2026-05-18-resign-current-job
decided_at: 2026-05-18
mode_at_time: survival | conservative | normal
verdict: approve | reject | conditional
proposal:
  name: "辞职专心做广州独立业务"
inputs:
  - profile/constraints.md §1.1
  - templates/finance-dashboard.md (cash_runway: 2.3)
  - templates/annual-business-goal.md (validation_status: pending)
rationale: |
  Personal cash runway 2.3 months < 3 → 触发 §1.1 survival。
  Survival 模式下"用副业替代求职"被 §5 硬否决。
required_actions:
  - 继续每周 ≥ 30 次求职投递
  - 业务推进保持周末 4 小时上限
  - 6 个月后若 runway 恢复到 6+ 再重新评估
follow_up_review_at: 2026-08-18
outcome: pending | confirmed | overturned | TBD
---
```

## 红线

| 触发 | CDO 动作 |
|------|---------|
| 重大决策（涉钱 > 5000 / 涉时 > 1 月）无日志 | 强制补录，否则后续提议被冻结 |
| `outcome: overturned` 累积 ≥ 3 次同类决策 | 触发回 `09_Principles/` 修正公理 |
| `follow_up_review_at` 过期未复盘 | 月报强制提醒，未复盘前不放行同类新决策 |

## 与决策引擎的关系

Decisions 是 CDO **行为的镜子**：
- `09_Principles/` 提供公理 → CDO 推导 verdict → 记录到 `08_Decisions/`
- `08_Decisions/` 复盘暴露公理缺陷 → 修正 `09_Principles/`
- 闭环。

## 不录什么

- ❌ 微决策（今天吃什么 / 今天先做哪个任务） → 不进系统
- ❌ 项目执行细节 → 去 `05_Projects/<id>/decision-log.md`
- ❌ 公理本身的修订 → 去 `09_Principles/`
- ❌ 复盘情绪 → 去 `06_Cognition/`
