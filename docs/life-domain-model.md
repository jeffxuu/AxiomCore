# 人生域模型

Axiom Core 把人生分为 **9 大域**，每个域对应一个物理目录、一组可量化指标和一个明文 README 写明边界。

## 9 大域 × 物理目录

| # | 域 | 物理目录 | 主指标 | 频率 |
|---|----|---------|-------|------|
| 1 | Health（健康与精力） | `01_Health/` | 睡眠、体重、精力、心情、运动 | 日 |
| 2 | Cashflow（财务与资本） | `02_Cashflow/` | personal/business runway、burn rate | 月 |
| 3 | Career（事业与商业探索） | `03_Career/` | 求职投递/面试、目标薪资、商业 lead | 日 + 季 |
| 4 | Skills（技能与认知） | `04_Skills/` | 英语分钟、主线技能、产出物 | 日 + 月 |
| 5 | Projects（项目沙盘） | `05_Projects/<id>/` | 项目 ROI、burn、validation_deadline | 月 |
| 6 | Cognition（思维与灵感） | `06_Cognition/` | 信息差、假设、验证成本 | 不定期 |
| 7 | Relationships（关系与人脉） | `07_Relationships/` | 人物 last_contacted、cash/risk/network | 周 |
| 8 | Decisions（决策日志） | `08_Decisions/` | verdict 历史、outcome 复盘 | 每重大决策 |
| 9 | Principles（公理与复盘） | `09_Principles/` | constraints.md 修订与废除档案 | 季度 |

每个域目录下的 `README.md` 是该域的**宪法**——录什么、不录什么、红线、与决策引擎的关系。

## 域之间的关系（不是层级，是约束链）

```
Health → 一切决策的物理底座（精力为零，所有 ROI 归零）
   ↓
Cashflow → 决定 mode (survival / conservative / normal)
   ↓
Career → 当前主线：恢复稳定现金流
   ↓
Skills → 中期复利杠杆（英语 / 全栈 / AI Agent）
   ↓
Projects → 独立商业探索（资金严格隔离）
   ↓
Relationships → 撬动 Projects 的网络资源
   ↓
Cognition → 验证灵感后才能升级为 Project
   ↓
Decisions → CDO 的审计轨迹
   ↓
Principles → 暴露公理漏洞，回到 Cashflow / Health 红线修订
```

## 录入规范（跨域共性）

每个域 README 都强制约束：

1. **数据先于解读**：先记原始数字/事实，再写主观感受
2. **不补录**：当天没记就空着，回填会破坏时间序列分析
3. **域边界严格**：买健身房会员不录在 Health（那是 Cashflow），收到面试通知不录在 Career 备忘（那是真实动作发生在 Career）
4. **AXIOM 区块独占**：每个标准模板里的 `<!-- AXIOM:BEGIN --> ... <!-- AXIOM:END -->` 由服务程序写入；手动改区块内容会在下次 upsert 时被覆盖

## 与决策引擎的关系

决策引擎（[decision-engine.md](decision-engine.md)）**不直接**读 9 大域目录，而是读：

1. `profile/current-state.md` — 自动汇总的当前状态快照
2. `profile/constraints.md` — 公理库
3. `templates/finance-dashboard.md` 等结构化模板的 YAML frontmatter
4. `logs/daily/*.md` 最近 7-14 天

9 大域目录是**人类可读的存档层**。引擎只从汇总层读取量化指标，目录可以保留长篇复盘和富文本。

## 单条数据如何流转到 9 大域

以"今天体重 80kg，跑步 30 分钟，花了 35 元"为例：

```
飞书消息 "体重 80 运动 30 支出 35"
  ↓
POST /api/feishu/events
  ↓
SQLite daily_entries upsert (weight_kg=80, exercise_minutes=30, expense=35)
  ↓
重写 logs/daily/2026-05-18.md 的 AXIOM:BEGIN/END 区块
  ↓
人类视角：
  - 体重数字属于 01_Health 域 → workflows/summarize 计算 7 天均值后写 current-state.md
  - 跑步数字属于 01_Health 域 → 同上
  - 支出数字属于 02_Cashflow 域 → 计入 monthly_burn 重算
  ↓
决策引擎读取上述聚合后判断：
  - sleep_quality / weight_kg 是否触发 §4 健康红线
  - personal_cash.runway_months 是否触发 §1.1 survival
```

一条原始数据可以**贡献到多个域**，但不会被复制——它只在 `logs/daily/` 留一份原始记录，由聚合层投影到各域。

## 域不存在"主从"或"父子"

引擎不靠目录嵌套来决定优先级——优先级链写在 `profile/constraints.md` §1.1~§1.3。所以 9 大域是平的，目录前缀 01-09 只是排序，**不是层级**。

## 何时新增第 10 域

新增门槛极高：

1. 必须有一个明文场景驱动（不是"感觉有用"）
2. 必须能给出 ≥ 3 个可量化指标
3. 必须能写出红线触发规则
4. 必须证明现有 9 域无法承载——比如"投资"不需要新建 10 域，因为它属于 `02_Cashflow/` 或 `05_Projects/`

三条任一不满足，**保持 9 域**。
