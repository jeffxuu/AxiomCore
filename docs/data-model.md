# 数据模型

> 取代旧文档 [legacy-local-db-web](../01_系统说明/本地数据库与网页打卡方案.md) 中的数据模型部分。

Axiom Core 的数据存在 **三个层**，它们之间通过严格的字段映射保持同步：

| 层 | 形态 | 用途 | 进 Git？ |
|---|------|------|---------|
| SQLite | `data/axiom_core.db` | 运行态、查询、API 返回 | ❌ |
| Markdown frontmatter + 区块 | `logs/daily/*.md`、`templates/*.md`、`profile/*.md` | 长期可读快照、版本回溯 | ✅ |
| JSON Schema | `data/schemas/*.schema.json` | 校验关键字段 | ✅ |

## SQLite 表结构

> 源代码权威定义在 `axiom_server.py` 的 `init_db()` 中。下面是当前的快照。

### `daily_entries`

每天一行的健康/生活记录。

| 字段 | 类型 | 说明 |
|------|------|------|
| `entry_date` | TEXT PK | YYYY-MM-DD |
| `sleep_hours` | REAL | 睡眠小时 |
| `weight_kg` | REAL | 体重 |
| `mood` | INTEGER | 心情 1-10 |
| `energy` | INTEGER | 精力 1-10 |
| `expense` | REAL | 当日支出 |
| `income` | REAL | 当日收入 |
| `job_applications` | INTEGER | 投递数 |
| `interviews` | INTEGER | 面试数 |
| `english_minutes` | INTEGER | 英语学习分钟 |
| `exercise_minutes` | INTEGER | 运动分钟 |
| `breakfast` / `lunch` / `dinner` / `snacks` / `diet_summary` | TEXT | 饮食文本 |
| `notes` | TEXT | 自由笔记 |
| `updated_at` | TEXT | ISO 时间戳 |

### `daily_tasks`

每天的任务清单（基于 `TASK_TEMPLATES` 渲染出来）。

| 字段 | 说明 |
|------|------|
| `entry_date` | YYYY-MM-DD |
| `task_id` | 任务标识，如 `english_momo_review` |
| `category_id` | career / english / fitness / health / finance / learning / mindset |
| `title` | 任务标题 |
| `target_value` | 目标值 |
| `actual_value` | 实际完成 |
| `unit` | 单位 |
| `done` | 0/1 |
| `sort_order` | 排序 |

## Markdown frontmatter 模板

### 每日记录 `logs/daily/YYYY-MM-DD.md`

```yaml
---
type: daily_health_log
date: 2026-05-17
sleep_hours: 7.2
weight_kg: 80.1
mood: 7
energy: 6
expense: 35
# ...
---
```

Schema 文件：`data/schemas/daily-health.schema.json`。

### 财务看板 `templates/finance-dashboard.md`

```yaml
---
type: finance_dashboard
personal_cash:
  current_balance: 12000
  monthly_burn: 4500
  runway_months: 2.67
business_cash:
  initial_capital: 100000
  spent_to_date: 18000
  monthly_burn: 3000
  runway_months: 27.3
  validation_deadline: 2026-09-30
decision_status: pending  # 新增：当前财务决策状态
---
```

Schema：`data/schemas/finance-dashboard.schema.json`。

### 年度业务目标 `templates/annual-business-goal.md`

```yaml
---
type: annual_business_goal
year: 2026
business_name: "广州独立业务"
validation_deadline: 2026-09-30
capital_status: planned   # planned | committed | spent | recovered
cashflow_status: red      # green | yellow | red
decision_status: pending  # 新增：当前阶段是否被引擎放行
milestones:
  - description: "完成第一批客户访谈"
    due: 2026-06-30
    done: false
---
```

Schema：`data/schemas/annual-business-goal.schema.json`。

## frontmatter ↔ SQLite 的同步规则

1. 每次 API 写入 SQLite 后，**重写** Markdown 的 `<!-- AXIOM:BEGIN -->` ~ `<!-- AXIOM:END -->` 区块。
2. 每次飞书或网页录入只更新发生变化的字段，未提供的字段从数据库当前值继承。
3. Markdown 区块外的"今日笔记"由用户自由编辑，不会被覆盖。

## JSON Schema 的作用

`workflows/validate_frontmatter.py` 在两个时机校验：
- 手动 CI：`python workflows/validate_frontmatter.py --path templates --verbose`
- 模板修改时（推荐）

只校验 `type:` 字段在 `TYPE_TO_SCHEMA` 字典里的文件。`docs/`、`archive/`、`node_modules/` 等目录被默认 exclude（见 `DEFAULT_EXCLUDE_DIRS`）。

## 决策状态字段 `decision_status`

新增到 `finance-dashboard.md` 和 `annual-business-goal.md` 的 frontmatter：

| 值 | 含义 |
|----|------|
| `pending` | 等待引擎评估 |
| `approved` | 已被引擎放行 |
| `conditional` | 需满足前置条件 |
| `rejected` | 被引擎否决 |
| `frozen` | 已冻结（如业务跑道告警） |

决策引擎读取此字段判断当前提议状态。schema 已同步更新枚举值。

## 不在数据模型里的东西

- 用户密码 / API 密钥 / SSH 私钥 → 见 [security.md](security.md)，存在 `.axiom-secrets/` 或环境变量
- 飞书 access_token → 内存缓存 `FEISHU_TOKEN_CACHE`，不持久化
- 临时会话 → SQLite `sessions` 表，过期自动清理
