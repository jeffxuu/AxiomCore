# 控制大盘图表口径与交互说明

> Dashboard Measures & Interaction Guide
> 本文是主页控制大盘的指标口径依据。图表用于呈现已经录入的事实与显式假设，不替代决策引擎的审批结论。

## 阅读规则

| 原则 | 说明 |
|---|---|
| 事实数据 | 资金流水与基线来自系统记录；录入后即可影响图表。 |
| 假设数据 | 项目的预期回报和风险等级由主人录入，是待复盘假设，不是已实现业绩。 |
| 可追溯 | 图表只使用可追溯字段；点击或键盘聚焦数据点可查看当前所读数值。 |
| 决策边界 | 图表提供分析视图；资金底线、否决规则与审批逻辑仍以《决策引擎》为准。 |

## 1. 资金跑道预测 / Capital Runway Forecast

**目的**：回答“按照近期资金变化速度，距资金底线还有多少时间”。

| 维度 | 中文口径 | English Definition | 数据来源 |
|---|---|---|---|
| X 轴 | 时间：历史实际日期延伸至预测触底日期 | Time: actual dates extended to estimated floor date | `baseline_date`、`capital_tx.occurred_at` |
| Y 轴 | 净资本金额，单位 CNY | Net capital position in CNY | `baseline.starting_position + 累计流入 - 累计流出` |
| 红色虚线 | 资金底线，当前默认 `-100,000 CNY` | Configured capital floor | `AXIOM_CAPITAL_FLOOR` |
| 实线 | 已发生的历史净资本轨迹 | Recorded historical net capital | 真实流水 |
| 虚线 | 预测轨迹 | Forecast trajectory | 近 30 日资金变化的日均速度外推 |

**预测计算**：

```text
daily_burn = (最新净资本 - 观察窗口起始净资本) / 窗口天数
days_to_floor = (当前净资本 - 资金底线) / abs(daily_burn)  # 仅当 daily_burn < 0
```

**互动**：点击或使用键盘聚焦曲线点，详情卡显示该日期的实际值或预测值；“实际 / 预测”标记用于防止把推演当作已发生事实。

## 2. 风险 × 回报定位矩阵 / Risk x Return Positioning Matrix

**目的**：对活跃项目做组合配置审视，优先暴露“高风险、低预期回报”的项目。

| 维度 | 中文口径 | English Definition | 数据来源 |
|---|---|---|---|
| X 轴 | 风险敞口：`low`、`medium`、`high`、`extreme` 四档，由低到高 | Risk exposure, categorical from low to extreme | `projects.risk_level` |
| Y 轴 | 预期回报倍数，显示范围 `0x` 至 `10x` | Expected return multiple, plotted from 0x to 10x | `projects.roi_projection` |
| 气泡面积 | 已承诺资金，金额越大气泡越大 | Committed capital, area-scaled | `projects.capital_committed` |
| 颜色 | 按风险与预期回报所在象限给出配置姿态 | Allocation posture derived from quadrant | 风险档位 + 预期回报 |

**象限解释**：

| 象限 | 触发条件 | 管理含义 |
|---|---|---|
| 优先配置 | 较低风险且预期回报 `>= 5x` | 优先验证与扩大高质量假设 |
| 战略押注 | 较高风险且预期回报 `>= 5x` | 仅在止损标准明确时持有 |
| 稳健收益 | 较低风险且预期回报 `< 5x` | 可作为稳定项，但不应挤占关键资本 |
| 退出复核 | 较高风险且预期回报 `< 5x` | 优先复核是否暂停或退出 |

**互动**：点击或键盘聚焦任意气泡，详情卡显示项目名称、已承诺资金与预期回报。回报倍数是主人输入的假设，应在结果形成后通过决策复盘更新。

## 3. 现金流脉搏 / Cash-flow Pulse

**目的**：观察近 30 天流入与流出的节奏、异常大额交易和短期净流方向。

| 维度 | 中文口径 | English Definition | 数据来源 |
|---|---|---|---|
| X 轴 | 最近 30 天自然日期 | Last 30 calendar dates | `timeline.date` |
| Y 轴 | 单日资金金额，单位 CNY | Daily amount in CNY | `timeline.in`、`timeline.out` |
| 零轴以上 | 当日流入 | Daily inflow | 收入记录 |
| 零轴以下 | 当日流出 | Daily outflow | 支出记录 |
| 净流 | 流入减流出 | Inflow minus outflow | 单日聚合 |

**互动**：选择任意日期柱体，可读取当日流入、流出与净流。这里展示发生过的资金事件，不把未来预算绘入事实曲线。

## 4. 录入如何改变图表 / How Owner Input Changes the Charts

知识底座中的“主人录入台”接受自然语言，并根据内容写入以下目的地：

| 录入内容 | 写入目的地 | 会影响的视图 |
|---|---|---|
| 收入、付款、退款、订阅支出 | `capital_tx` | 资金跑道预测、现金流脉搏、资本指标 |
| 新项目、暂停或复盘项目 | `projects` | 风险 × 回报矩阵、资本配置 |
| 方案选择与复盘结果 | `decisions` | 决策漏斗、决策台账 |
| 原则、观察、复盘心得 | 对应领域 Markdown | 知识底座文档 |

录入前应包含可核实信息，例如金额、日期、项目名称、选择理由或复盘结果。记录写入后，主页图表会在下一次刷新时依据最新数据重算。
