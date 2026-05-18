# 07 — Relationships · 关系与人脉

> 核心商业人脉、客户、合作伙伴网络。Axiom Core 9 域中的第 7 域。

## CDO 视角

关系网络的启用门槛（greenfield 重启时已视为满足）：
- ✅ 求职靠 referral 占比超过 50%（或可预见会超过）
- ✅ 业务进入需要稳定合作伙伴 / 合伙人的阶段
- ✅ 单纯凭"事"的优化已无法再撬动现金流

Axiom Core 重启时一并启用，因为**独立商业探索**天然依赖关系网络。

CDO 在这里做的事：
1. 追踪关键人物状态（last contacted, role, value）
2. 触发"60 天未联系"提醒
3. 评估每段关系的 ROI（用 §3 三维评估的简化版：cash / risk / network compounding）
4. 拒绝**单方面的"想认识谁"**——必须有具体可交付的合作场景

## 追踪的核心实体

每个关键人物作为一个子文件：

```
07_Relationships/
  alice-supplychain-mgr.md    ← 单个人物
  bob-business-partner.md
  ...
```

每个文件必须有 frontmatter：

```yaml
---
type: relationship
person_id: alice-supplychain-mgr
role: 供应链经理
context: 前同事 / 客户 / 合伙人 / referral / 行业前辈
last_contacted: 2026-04-15
contact_interval_days: 30   # 期望重新联系的间隔
value:
  cash_path: 0|1|2|3        # 是否直接带来收入
  risk_reduction: 0|1|2|3   # 是否在求职/业务上能帮我"兜底"
  network_compounding: 0|1|2|3  # 是否能引荐到下一层人脉
relationship_status: active | dormant | archived
tags: [career, business, mentor, ...]
---
```

## 录入规范

1. **真实姓名 / 公司 → 不进 Git**。仓库是 Public，本目录文件**只用化名/角色**，真实身份对照表存 `.axiom-secrets/` 或本地加密笔记。
2. **每次互动后更新 `last_contacted` + 留 1-3 行笔记**。不更新等于关系消亡。
3. **不写八卦**——CDO 不关心他和谁吃饭，只关心他能否帮你撬动决策。

## 与决策引擎的关系

[../docs/decision-engine.md](../docs/decision-engine.md) 暂未涵盖第 7 域；待 Axiom Core 1.1 在 §8 补充：
- 60 天未联系的预警
- 求职 referral 路径的优先级提升
- 业务 lead 的转化率统计

## 红线

| 触发 | CDO 动作 |
|------|---------|
| 真实姓名 / 真实公司名出现在 Markdown | 立即告警，强制改化名 |
| 同一关系 3 个月无任何 `last_contacted` 更新 | 标记 dormant，不再消耗复盘注意力 |
| "想认识 X"但无具体合作场景 | 拒绝建档；先去 `06_Cognition/` 验证想法 |

## 不录什么

- ❌ 公开行业人物的研究笔记 → 去 `06_Cognition/`
- ❌ 客户付款记录 → 去 `02_Cashflow/`
- ❌ 项目执行中的沟通详情 → 去对应 `05_Projects/<id>/`
