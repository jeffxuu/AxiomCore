# 09 — Principles · 公理与复盘

> 沉淀下来的个人公理与系统约束红线。**这是 Axiom Core 之所以叫 Axiom Core 的原因**。

## CDO 视角

Principles 是 Axiom Core 的**宪法层**。所有 CDO 的 verdict 最终都引用这里的条款。如果没有这一层，决策就是即兴发挥；有了这一层，决策就是约束求解。

CDO 在这里做的事：
1. **不主动写公理**——公理只能从 `08_Decisions/` 的复盘中"涌现"出来
2. 维护公理的**版本与撤销原因**——每条公理必须有"什么情况下应被废除"
3. 拒绝**含糊措辞**——"保持健康" 不是公理，"`sleep_quality == poor` 连续 3 天 → 进入 survival" 才是

## 公理来源

1. **`profile/constraints.md`** —— 主公理库，由 `docs/decision-engine.md` 引用
2. **本目录** —— 公理的**修订过程**与**复盘原因**

`profile/constraints.md` 是**当前有效公理**，本目录是**公理的演化档案**：

```
09_Principles/
  README.md                     ← 本文件
  v1.0-axiom-core-launch.md     ← 重启时的公理集快照
  amendments/
    2026-06-15-add-relationship-burnout-rule.md  ← 单次修订
    2026-07-22-relax-survival-trigger.md
  decommissioned/
    2026-08-30-removed-low-cost-english-rule.md  ← 已废除的公理
```

## 录入规范

### 修订 (amendment)

每次修订一个文件，frontmatter：

```yaml
---
type: principle_amendment
amended_at: 2026-06-15
affects: constraints.md §4.1
change: add | modify | remove
trigger_evidence:
  - 08_Decisions/2026-06-10-... (overturned ×3)
  - 08_Decisions/2026-06-12-... (overturned)
new_rule: |
  连续 14 天工作 ≥ 60h → 强制下周 ≥ 2 整天彻底休息（不打卡、不投递、不开会）
why: |
  过去 6 个月 3 次"决策疲劳导致重大判断失误"。
  健康公理 §4 当前只看睡眠时长不看总工时，存在漏洞。
follow_up: 修订 templates/daily-health.md，新增 weekly_work_hours 字段
---
```

### 废除 (decommissioned)

```yaml
---
type: principle_decommissioned
decommissioned_at: 2026-08-30
original_rule: "survival 模式下任何需要付费的英语课程/App/教材都被否决"
why_removed: |
  实际证据（08_Decisions/...）表明零成本路径在 3 个月后转化率为零。
  低成本（< 200 元/月）付费课程在 ROI §3.1 conservative 阈值内可放行。
replaced_by: 修订 §3.2 conservative 段，明文允许 money_monthly ≤ 200 的英语类支出
---
```

## 红线

| 触发 | CDO 动作 |
|------|---------|
| 修订无 `trigger_evidence`（具体决策证据链接） | 拒绝合入，要求补充 |
| 同一公理 12 个月内修订 ≥ 3 次 | 强制评估公理本身是否成立 |
| 废除公理无 `replaced_by` 字段 | 拒绝合入，避免留下"什么都没规定"的空白 |
| 修订使 `profile/constraints.md` 与本目录不一致 | 引擎拒绝放行任何新决策，直到对齐 |

## 与决策引擎的关系

```
09_Principles/ ─→ profile/constraints.md ─→ docs/decision-engine.md ─→ CDO ─→ 08_Decisions/
                                                                            │
                          复盘暴露漏洞    ←──────────────────────────────────┘
                              │
                              └──→ 回到 09_Principles/ 修订
```

闭环。

## 不录什么

- ❌ 个人价值观 / 人生信条 → 这里只放**可执行的判定规则**
- ❌ 励志金句 → 去 `06_Cognition/`
- ❌ 项目专用规则 → 去 `05_Projects/<id>/`，只有跨项目的规则才进 09
- ❌ 单次决策 → 去 `08_Decisions/`，被复盘**多次**后才升级到这里
