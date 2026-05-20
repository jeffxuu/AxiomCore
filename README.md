# Axiom Core 3.0

**主权探索者级商业沙盘 · 认知审计核心 · 企业级技术白皮书**

---

## 1. 🪐 项目愿景与核心定义 (Vision & Core Philosophy)

**Axiom Core 3.0** 是为「独立主权探索者」量身定制的高性能商业沙盘系统（Business Sandbox）与认知审计核心（Cognitive Audit Kernel）。它并非任何形式的日历、待办、Wiki 或情绪伴侣类应用，而是一台严格基于「明文公理 → 状态推演 → 硬性裁决」的决策机器：将操作者的所有资本流、项目进展、决策草案与认知碎片，统一汇入一个本地优先、可云端镜像的可审计闭环。

### 1.1 设计哲学三原则

| # | 原则 | 工程化落点 |
|---|------|-----------|
| 1 | **公理优先于偏好（Axiom over Preference）** | 所有判定可回溯至 `profile/constraints.md`，无隐式默认值 |
| 2 | **现金流即物理（Cash-Flow as Physics）** | Burn Rate 与 Runway 由 `capital_baseline` + `capital_tx` 双轨核算，无人为修正 |
| 3 | **决策留痕即记忆（Audit Trail as Memory）** | 每条 `decisions` 行从 `open → committed → reviewed` 必须显式状态流转 |

### 1.2 美学语言

系统贯彻**彭博终端（Bloomberg-Terminal Style）** 的极致克制感与**麦肯锡战略视图（McKinsey Strategic UI）** 的高密度信息流哲学，统一在自适应深浅色双主题（Light / Dark）之下：

- **配色冷峻**：Light 主题使用 `#F8FAFC` 雾色底 + `#0B1220` 字体；Dark 主题反转为 `#0B1220` 深空底 + `#F8FAFC` 高对比字体。
- **几何克制**：所有图表禁用阴影渐变与卡通图标，仅以单像素描边 + 单色填充 + 网格底纹呈现。
- **信息密度优先**：单屏内最多承载 6 个独立决策维度，禁止「装饰性留白」与「营销式动效」。
- **零情绪文案**：UI 文案仅承担定义与读数功能，禁止使用感叹号、口语化激励或拟人化措辞。

---

## 2. 📂 仓库物理拓扑结构 (Repository Topology)

```
AxiomCore/
├── 01_Health/                    # 健康域：物理底座，所有决策的乘数因子（睡眠 / 体能 / 慢病阈值）
├── 02_Cashflow/                  # 现金流域：Burn Rate / Runway / Mode（survival / conservative / normal）
├── 03_Career/                    # 职业域：求职轨道与商业探索的变现路径
├── 04_Skills/                    # 技能域：复利杠杆，ROI 中的 skill_compounding 数据源
├── 05_Projects/                  # 项目域：活跃商业沙盘，强制 ROI + validation_deadline
├── 06_Cognition/                 # 认知域：未验证灵感的栖息地（pre-decision buffer）
├── 07_Relationships/             # 关系域：商业人脉、客户、合作伙伴
├── 08_Decisions/                 # 决策域：CDO verdict 的不可篡改审计轨迹
├── 09_Principles/                # 公理域：宪法层公理修订与废除档案
│
├── axiom_server.py               # FastAPI + AsyncOpenAI 异步中枢（单文件 94 KB，~2400 LOC）
├── requirements.txt              # Python 运行态依赖锁定
│
├── data/
│   ├── axiom_core.db             # SQLite 运行态主库（gitignored）
│   └── schemas/                  # JSON Schema 三层校验定义
│
├── docs/                         # 架构文档库（product-vision / decision-engine / data-flow ...）
├── profile/                      # 操作者主权画像（current-state / constraints）
├── templates/                    # 域内 Markdown 录入模板（YAML frontmatter 标准化）
├── workflows/                    # Python 自动化脚本（frontmatter 校验、片段汇总）
│
├── web/                          # 极量前端（Vite 8 + React 19 + Tailwind 4 + TypeScript 6）
│   ├── index.html
│   ├── package.json
│   ├── playwright.config.ts      # 视觉回归测试编排器
│   ├── tsconfig*.json            # 严格类型策略：noEmit + strict + isolatedModules
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx               # 路由编排根
│       ├── api.ts                # 与后端 REST 边界（fetch + 类型化响应）
│       ├── types.ts              # 跨端共享领域类型
│       ├── styles.css            # 全局设计令牌与基线
│       ├── components/
│       │   ├── analytics/        # ── 六大麦肯锡战略图表底座 ──
│       │   │   ├── RiskRoiMatrix.tsx           # 风险—回报矩阵（二维气泡）
│       │   │   ├── RunwayVelocityChart.tsx     # 跑道收敛图（60 日存活预测）
│       │   │   ├── CapitalAllocationTree.tsx   # MECE 资本调配树
│       │   │   ├── DecisionFunnel.tsx          # 认知转化漏斗
│       │   │   ├── RiskExposureRadar.tsx       # 风险集中度雷达
│       │   │   ├── DomainContributionWaterfall.tsx # 9 大域精力瀑布图
│       │   │   └── InsightCard.tsx             # 图表统一卡壳（含红色 alert 阀门）
│       │   ├── axiom/
│       │   │   ├── OmniCommandBar.tsx          # 统一核心指挥部（Omni Command Console）
│       │   │   ├── MarkdownView.tsx            # 不可信 Markdown 安全渲染
│       │   │   └── primitives.tsx              # PageHeader / SectionTitle / Divider 基元
│       │   ├── layout/                         # 主框架（侧边栏 + 顶栏 + 主区）
│       │   └── ui/                             # Radix + shadcn 基底组件
│       ├── pages/
│       │   ├── DashboardPage.tsx               # 现金流首页（Runway 仪表与近 30 日波动）
│       │   ├── LedgerPage.tsx                  # 资本流水账本（capital_tx CRUD）
│       │   ├── ProjectsPage.tsx                # 项目沙盘（CRUD + risk_level + ROI）
│       │   ├── DecisionsPage.tsx               # 决策档案（含状态机流转）
│       │   ├── InsightsPage.tsx                # 战略视界瞭望台（六图集成）
│       │   ├── OraclePage.tsx                  # 4SAPI Oracle 自动报告引擎
│       │   ├── VaultPage.tsx                   # Markdown 档案保险库
│       │   ├── SettingsPage.tsx                # 系统设置 + 密钥探针
│       │   └── LoginPage.tsx                   # ALTCHA + Token 守门
│       └── lib/
│           ├── modelGrouping.ts                # 4SAPI 动态厂商指纹引擎（detectVendor）
│           ├── i18nConfig.ts                   # 中英双语 i18n 注册中心
│           └── utils.ts                        # cn() + 通用纯函数
│
├── scripts/
│   ├── deploy_axiom_cloud.ps1    # 零破坏云端部署流水线（-SkipDestroy / -WipeDb）
│   ├── auto_git_sync.ps1         # 本地 → 云端单向同步守护
│   ├── cloud_to_local_sync.ps1   # 云端 → 本地反向同步
│   ├── axiom_secrets.ps1         # Windows DPAPI 加密的密钥仓
│   └── README.md
│
├── server-setup/                 # 服务器侧资产（systemd unit、Nginx vhost、env 模板）
├── tests/                        # pytest + Playwright 双轨测试
│
├── .gitignore                    # 数据库 / 日志 / 私钥 / PDF / node_modules 全屏蔽
├── .clinerules / .cursorrules    # 跨编辑器一致性约束（无 LifeOS 兼容残留）
└── README.md                     # 本文件
```

---

## 3. 💾 数据架构与双轨混合存储流 (Data Layer & Hybrid Ingestion)

Axiom Core 采用**结构化（SQLite）+ 非结构化（Markdown + YAML Frontmatter）** 双轨持久层。前者承担高频读写与精确审计，后者承担长期叙事与 Git 可审。

### 3.1 结构化持久层：SQLite 四大核心柱石

数据库文件 `data/axiom_core.db` 由 `axiom_server.init_db()` 幂等初始化。所有业务表均挂载 `domain_tag` 字段，与 9 大域强制对齐。

#### 柱石 1 — `capital_baseline` · 资产初始对齐基线

```sql
CREATE TABLE IF NOT EXISTS capital_baseline (
    id                INTEGER PRIMARY KEY CHECK (id = 1),
    starting_position REAL    NOT NULL,
    baseline_date     TEXT    NOT NULL,
    note              TEXT    NOT NULL DEFAULT '',
    updated_at        TEXT    NOT NULL
);
```

- 单行表（id 强制为 1），是 Runway 推演的「物理原点」。
- 首次启动写入 `starting_position = -50000.0`，记录操作者初始负债基线。

#### 柱石 2 — `capital_tx` · 高频真金白银流水账本

```sql
CREATE TABLE IF NOT EXISTS capital_tx (
    id           TEXT PRIMARY KEY,
    kind         TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
    amount       REAL NOT NULL,
    occurred_at  TEXT NOT NULL,
    note         TEXT NOT NULL DEFAULT '',
    category     TEXT NOT NULL DEFAULT '',
    project_id   TEXT,
    domain_tag   TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_capital_tx_date    ON capital_tx(occurred_at);
CREATE INDEX IF NOT EXISTS idx_capital_tx_project ON capital_tx(project_id);
CREATE INDEX IF NOT EXISTS idx_capital_tx_domain_tag ON capital_tx(domain_tag);
```

- 每一笔现金流的最小记账单位，强制带 `domain_tag` 审计标签。
- `project_id` 非空时即与项目沙盘形成「资本承诺 → 真实支出」可追踪绑定。

#### 柱石 3 — `projects` · 活跃投资沙盘

```sql
CREATE TABLE IF NOT EXISTS projects (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'active',
    thesis            TEXT NOT NULL DEFAULT '',
    roi_projection    REAL NOT NULL DEFAULT 0,
    risk_level        TEXT NOT NULL DEFAULT 'medium',
    kill_criteria     TEXT NOT NULL DEFAULT '',
    capital_committed REAL NOT NULL DEFAULT 0,
    capital_spent     REAL NOT NULL DEFAULT 0,
    domain_tag        TEXT NOT NULL DEFAULT '',
    started_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_projects_domain_tag ON projects(domain_tag);
```

- `roi_projection` 为乘数（× 倍数），`capital_committed` 与 `capital_spent` 共同支撑超支检测。
- `risk_level ∈ {low, medium, high, extreme}`，触发风险集中度警报器的核心因子。
- `kill_criteria` 字段必须填写「自杀阈值」，无明文阈值的项目在录入时即被拒绝。

#### 柱石 4 — `decisions` · 认知审计链条

```sql
CREATE TABLE IF NOT EXISTS decisions (
    id                TEXT PRIMARY KEY,
    context           TEXT NOT NULL,
    options           TEXT NOT NULL DEFAULT '[]',
    choice            TEXT NOT NULL DEFAULT '',
    rationale         TEXT NOT NULL DEFAULT '',
    expected_outcome  TEXT NOT NULL DEFAULT '',
    status            TEXT NOT NULL DEFAULT 'open',
    reviewed_outcome  TEXT NOT NULL DEFAULT '',
    decided_at        TEXT,
    reviewed_at       TEXT,
    domain_tag        TEXT NOT NULL DEFAULT '',
    created_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_decisions_domain_tag ON decisions(domain_tag);
```

- 状态机为三态：`open → committed → reviewed`，状态跃迁不可回退。
- `reviewed_outcome` 记录决策的实际后验结果，是「认知转化漏斗」中胜率统计的真值源。

#### 辅助柱石

```sql
CREATE TABLE IF NOT EXISTS system_settings (
    config_key   TEXT PRIMARY KEY,
    config_value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS oracle_reports (
    id         TEXT PRIMARY KEY,
    kind       TEXT NOT NULL DEFAULT 'daily',
    content    TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_oracle_reports_created_at ON oracle_reports(created_at DESC);
```

- `system_settings`：键值对配置仓（含 4SAPI 端点、Oracle 模型、自动化开关）。
- `oracle_reports`：4SAPI Oracle 自动生成的战略报告归档（kind ∈ {daily, weekly, manual}）。

### 3.2 非结构化持久层：Markdown 追加路由 (Vault Append Pipeline)

`POST /api/command/parse` 是 Axiom Core 的「自然语言入口」，承担将操作者的大白话思考自动结构化的职责。

**协议链路**：

1. **入口约束**：单条命令长度 ≤ 2000 字符，否则 HTTP 400 `单条命令请控制在 2000 字以内。`
2. **4SAPI JSON Strict 解析**：`nlp_call_4sapi(text)` 强制启用 `response_format = json_schema`，返回严格信封：

   ```json
   {
     "target_table": "capital_tx | projects | decisions | vault",
     "domain_tag":   "01_Health | ... | 09_Principles",
     "payload":      { /* 对应表的字段集 */ },
     "vault_markdown": "（追加进域 README 的 Markdown 片段）"
   }
   ```

3. **分发器**：`nlp_dispatch(parsed)` 根据 `target_table` 将 payload 落库；同时若 `vault_markdown` 非空，则以**矢量锚点**追加至对应域的 `README.md` 末尾：

   ```markdown
   <!-- AXIOM:BEGIN id=<uuid> at=2026-05-21T13:42:01Z -->
   ……此处为 4SAPI 结构化后的 Markdown 段落……
   <!-- AXIOM:END -->
   ```

4. **幂等性**：锚点 `<!-- AXIOM:BEGIN id=... -->` 携带 UUID，使重放与差分回滚成为 O(1) 操作；任何不带锚点的人工编辑均会被自动汇总流程（`workflows/summarize_fragments.py`）忽略。

### 3.3 三层一致性校验

| 层 | 物理形态 | 校验器 |
|---|---------|--------|
| 运行态 | SQLite 行 | Pydantic v2 模型在 `axiom_server.py` 入口处强制断言 |
| 档案态 | Markdown + YAML frontmatter | `workflows/validate_frontmatter.py --path templates --verbose` |
| 契约态 | JSON Schema | `data/schemas/*.json`，覆盖 capital / project / decision 三族 |

任一层偏移即触发引擎拒绝；不允许出现「数据库有、Markdown 没」的漂移。

---

## 4. 🛸 系统双驱核心组件白盒剖析 (System Twin-Engines)

Axiom Core 由两台并行引擎承担前台体验：**统一核心指挥部** 负责单点入口，**战略视界瞭望台** 负责全局态势感知。

### 4.1 统一核心指挥部 (Omni Command Console)

源文件：[web/src/components/axiom/OmniCommandBar.tsx](web/src/components/axiom/OmniCommandBar.tsx)

#### 4.1.1 交互美学

- 单行 `input` + 极简 `Send` 按钮：操作者无需思考「这条信息归到哪一页」，键入即归位。
- **呼吸阴影**：在 `idle` 态使用 `box-shadow: 0 0 0 0 rgba(...)`，`focus` 态以 200 ms ease-out 过渡至 `0 0 0 3px` 高对比环。
- **极细进度条**：解析中由 `ax-omni-stream` 类承载 1 像素高的水平条，以 `transform: scaleX()` 从 0 推至 1，无任何颜色跳变。
- **双层提示**：解析失败时分别给出「4SAPI 网关原始错误」与「人类可读重试建议」两层 Toast。

#### 4.1.2 4SAPI 全球厂商动态指纹提取引擎

源文件：[web/src/lib/modelGrouping.ts](web/src/lib/modelGrouping.ts)

4SAPI 聚合网关单 Key 可返回 15+ 厂商的全模型清单（OpenAI、Anthropic、Google、DeepSeek、阿里千问、腾讯混元、百度文心、Meta Llama、Moonshot Kimi、Mistral、01.AI Yi、智谱 GLM、xAI Grok、Cohere、Perplexity 等）。前端**不硬编码厂商表**，而是通过 `detectVendor(model: string)` 双阶段算法实时分桶：

**A. 关键词精度拦截（Keyword-Precision Interception）**

```
全小写化 → 逐条命中：
  claude|anthropic → anthropic
  gemini|google    → google
  deepseek         → deepseek
  qwen|qianwen     → alibaba
  llama            → meta
  kimi|moonshot    → moonshot
  mistral|mixtral|codestral → mistral
  yi-|01-ai|01ai   → yi
  ernie|baidu|wenxin → baidu
  hunyuan|tencent  → tencent
  glm|zhipu|chatglm → zhipu
  grok|xai         → xai
  command-r|cohere → cohere
  sonar|perplexity → perplexity
  gpt-|o1-|o3-|o4-|chatgpt → openai
```

**B. 切片回退（Slice Fallback）**

对 4SAPI 代理 ID 形如 `gpt-<vendor>-<model>` 的嵌套外壳：剥离前缀 `gpt-` 后取第一段作为厂商键；否则取首段。未命中任何关键词的归入 `other`。

**C. 工程性守卫**

- **排他性 lowercase 拦截**：所有比对均以 `m = raw.toLowerCase()` 进行，杜绝大小写不一致引发的级联下拉错位。
- **状态死锁守门**：[OmniCommandBar.tsx:60-74](web/src/components/axiom/OmniCommandBar.tsx#L60-L74) 在 hydrate 流程中三段优先级回退（`storedProvider → inferredProvider → providersLocal[0].key`），消灭「LocalStorage 中遗留厂商已不在新模型池」造成的受控组件死锁。
- **两层级联渲染**：左 `select` 输出 `dynamicProviders`（按 `VENDOR_PRIORITY` 排序 + 未知厂商字典序追加），右 `select` 联动 `bucketMap.get(provider)`，确保单源真值。

### 4.2 战略视界瞭望台 (McKinsey Analytics)

源文件：[web/src/pages/InsightsPage.tsx](web/src/pages/InsightsPage.tsx)

#### 4.2.1 混合图层架构 (Hybrid Layer Architecture)

所有 6 大图表统一采用**SVG + HTML 双图层叠加渲染**：

| 图层 | 承担职责 | 技术选型 |
|------|---------|---------|
| 底层 | 几何线、气泡、坐标网格、瀑布条 | Responsive Inline SVG（`viewBox="0 0 600 400"` 等比缩放） |
| 覆层 | 坐标轴文字、Tooltip、动态标签、阈值刻线 | HTML `position: absolute` 绝对定位（`% / em` 单位） |

**根因消解**：早期纯 SVG 方案在 Windows 高 DPI 缩放（125 % / 150 %）下，因 `<text>` 元素与位图字体的次像素对齐不一致，会出现刻度文字与轴线错位 1–3 px 的视觉脱锚。改造为「Inline SVG 渲染几何 + HTML 覆层渲染文字」后，文字层完全交由浏览器原生字体渲染管线接管，与 SVG 几何层在同一 React 容器内对齐到 CSS 像素，彻底消灭 DPI 缩放不同步 Bug。

#### 4.2.2 六大战略决策图谱

##### 图 ① — 项目配置矩阵 · `RiskRoiMatrix`

横轴 = `risk_level` 序数（low=1, medium=2, high=3, extreme=4）；纵轴 = `roi_projection` 倍数；气泡半径正比于 `capital_committed`。

> 决策含义：右下象限（高风险 + 低 ROI）即「认知盲点」，触发自动审计标记。

##### 图 ② — 跑道收敛图 · `RunwayVelocityChart`

源文件 [web/src/components/analytics/RunwayVelocityChart.tsx](web/src/components/analytics/RunwayVelocityChart.tsx) 中关键常量：

```
HISTORY_DAYS  = 90        // 回看窗口
FORECAST_DAYS = 60        // 前瞻窗口
FLOOR_VALUE   = -100_000  // 跑道地板（破产线）
VIEW_W = 600, VIEW_H = 400
```

**净头寸推演公式**：

```
NetPosition(t) = starting_position
               + Σ income(τ)   for τ ≤ t
               − Σ expense(τ)  for τ ≤ t

BurnRate30d = ( Σ expense(t-30..t) − Σ income(t-30..t) ) / 30

Runway_days = ( NetPosition(now) − FLOOR_VALUE ) / BurnRate30d
              当 BurnRate30d > 0；否则 Runway = ∞
```

预测段以 30 日均速 `BurnRate30d` 线性外推 60 日，并在 `NetPosition(t) < FLOOR_VALUE` 处投影一条「地板穿透日」红色刻线。

##### 图 ③ — MECE 资本调配树 · `CapitalAllocationTree`

按 9 大 `domain_tag` 对 `projects.capital_committed` 进行**互斥且完全穷尽（Mutually Exclusive, Collectively Exhaustive）** 切片：

```
Allocation(domain_i) = Σ capital_committed(p) , p.domain_tag = domain_i

Σ_{i=1..9} Allocation(domain_i) = Σ capital_committed  (恒等)
```

若任一项目出现 `capital_spent > capital_committed × (1 + 0.20)`，调配树对应叶节点立即标红，并在卡片头部抛出超支警报。

##### 图 ④ — 认知转化漏斗 · `DecisionFunnel`

按 `decisions.status` 三阶状态机统计：

```
Open       = COUNT(status = 'open')
Committed  = COUNT(status = 'committed')
Reviewed   = COUNT(status = 'reviewed')

CommitRate = Committed / Open          // 决策落地率
WinRate    = COUNT(reviewed_outcome ∈ {win, partial_win}) / Reviewed
```

漏斗从 Open 逐级收敛至 Reviewed，并独立标注 `WinRate` 真值——这是认知系统的「胜率体温计」，与营销式仪表盘的虚假转化率完全不同。

##### 图 ⑤ — 资产风险集中度警报器 · `RiskExposureRadar`

```
TotalCommit  = Σ capital_committed(p)   , p.status ≠ 'killed'
HighRiskPool = Σ capital_committed(p)   , p.risk_level ∈ {high, extreme}

ExposureRatio = HighRiskPool / TotalCommit

ALERT 触发条件：ExposureRatio > 0.40
```

[InsightsPage.tsx:15](web/src/pages/InsightsPage.tsx#L15) 中常量 `DANGER_THRESHOLD = 0.4` 直接驱动 `InsightCard` 的红色阀门发光环——当超过 40 % 资本压注在高危区间时，卡片头部红框告警，迫使操作者立即去饱和。

##### 图 ⑥ — 9 大领域精力瀑布图 · `DomainContributionWaterfall`

按 9 大域汇总该域在窗口内的「净精力贡献」：

```
Contribution(domain_i) = Σ income(tx, domain_i)
                       − Σ expense(tx, domain_i)
                       + α × COUNT(decisions ∈ domain_i)
                       + β × COUNT(projects.status='active' ∈ domain_i)

α = 0（仅记录，不计入财务贡献，留作后续校准位）
β = 0（仅记录，不计入财务贡献，留作后续校准位）
```

瀑布从 `01_Health` 起算，逐域累加 / 削减直至 `09_Principles`，期末水位即为「该窗口内的综合域产出」。负贡献域以下沉红块呈现，正贡献以抬升绿块呈现。

---

## 5. ⚡ 终端代币压榨网络 (Local Token Compressor)

Axiom Core 的本地开发环境与 VS Code / Cursor 编辑器深度集成 [`rtk`](https://github.com/) (Rust Token Killer) 全局拦截钩子。

### 5.1 工作原理

- **静默挂载**：`rtk` 二进制安装于 `C:\Users\<user>\.cargo\bin\rtk.exe`，由 Claude Code 钩子系统在每次 Bash / PowerShell 调用前透明前置。
- **语义压缩**：对 `git status`, `git diff`, `rg`, `cat`, `tail` 等高频读取命令，`rtk` 在进程间以语义级 diff 替代原始文本输出（如 `git diff` 的连续未改动上下文被压缩为 `@@ unchanged: N lines @@` 摘要）。
- **零侵入**：操作者继续敲 `git status`，钩子自动改写为 `rtk git status`；终端 UX 完全保留。

### 5.2 实测节省

| 命令 | 原始 Token | 经 rtk 压缩 | 节省比 |
|------|-----------|------------|--------|
| `git diff HEAD~5` (大型重构) | ≈ 18,000 | ≈ 4,200 | 76 % |
| `git status -uall` (全树扫描) | ≈ 3,400 | ≈ 540 | 84 % |
| `rg "pattern" .` (全仓搜索) | ≈ 9,800 | ≈ 1,900 | 80 % |

综合工作流测算：终端 I/O 类 Token 暴省 **50 % – 85 %**，长会话中维持 Context Window 健康水位的关键护盾。

### 5.3 元命令

```bash
rtk --version          # 校验二进制版本
rtk gain               # 输出累计节省的 Token 总量与节省率
rtk gain --history     # 输出按命令分组的节省明细
rtk discover           # 扫描历史会话发现遗漏的优化点
rtk proxy <cmd>        # 调试用：跳过压缩直接透传
```

---

## 6. 🛠️ 运行配置与 DevOps 云端热更新 (Deployment Flow)

### 6.1 本地开发环境

**先决条件**：Python 3.11+、Node.js 20+、Windows PowerShell 5.1+（macOS / Linux 同等 POSIX 环境亦可，部署脚本除外）。

```bash
# 步骤 1 — Python 后端依赖
python -m pip install -r requirements.txt

# 步骤 2 — 前端依赖与开发服务器（终端 A）
cd web
npm ci
npm run dev                       # 默认 127.0.0.1:5173，Vite 8 + HMR

# 步骤 3 — 启动 FastAPI 中枢（终端 B）
python axiom_server.py            # 监听 127.0.0.1:8787

# 步骤 4 — 浏览器访问
# Windows:  start http://127.0.0.1:5173
# macOS:    open  http://127.0.0.1:5173

# 可选 — Frontmatter 三层校验
python workflows/validate_frontmatter.py --path templates --verbose

# 可选 — 视觉回归
cd web && npm run visual:audit    # Playwright 1.60+
```

### 6.2 生产环境无损热部署

**目标拓扑**：

```
       [Internet]
            │ HTTPS 443
            ▼
   ┌─────────────────────┐
   │  Nginx              │  axiom-nginx.conf
   │  upstream: axiom_   │  → 反向代理 + ALTCHA 静态托管
   │           backend   │
   └─────────┬───────────┘
             │ 127.0.0.1:8787
             ▼
   ┌─────────────────────┐
   │ systemd unit:       │  /etc/systemd/system/axiom-core.service
   │ axiom-core.service  │  → 守护 uvicorn + axiom_server.py
   └─────────┬───────────┘
             │
             ▼
   ┌─────────────────────┐
   │ /opt/axiom-core/    │  数据卷（SQLite + Markdown 资产）
   │  ├─ data/           │
   │  ├─ logs/daily/     │
   │  └─ web/dist/       │
   └─────────────────────┘
```

#### 6.2.1 标准热部署指令（保留运行态数据）

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy_axiom_cloud.ps1 -SkipDestroy
```

`-SkipDestroy` 跳过旧 LifeOS 销毁步骤（仅首次安装需要），不触及 `-WipeDb` 红线，从而：

- 保留 `/opt/axiom-core/data/axiom_core.db`、`-wal`、`-shm` 三件套；
- 仅清空根目录除 `data/` 之外的所有文件（`find . -mindepth 1 -maxdepth 1 ! -name data -exec rm -rf {} +`）；
- 解包新 tarball → `npm ci && npm run build` → 安装 systemd unit → 安装 Nginx vhost；
- `systemctl daemon-reload && systemctl restart axiom-core.service`；
- `nginx -t && systemctl reload nginx`；
- 通过 `GET https://<host>/api/health` 健康探针确认 `service == "Axiom Core"`。

#### 6.2.2 流水线步骤明细

| 步 | 阶段 | 关键动作 |
|---|------|---------|
| 1 | 解密 SSH 配置 | 通过 DPAPI 解密 `AXIOM_SSH_HOST`/`USER`/`KEY_PATH`/`REMOTE_APP_DIR` |
| 2 | 销毁旧 LifeOS（可跳过） | `systemctl stop/disable lifeos.service` + `rm /opt/lifeos-app/` |
| 3 | 本地打包 | 优先 `git archive HEAD`（仅追踪文件）；非 Git 仓库回退至 `tar` + 排除清单 |
| 4 | 上传 | `scp` 至 `/tmp/axiom_core_deploy.tgz` |
| 5 | 远端引导 | 保留 `data/` → 解包 → pip → npm build → 安装 unit → 装 vhost |
| 6 | 服务重启 | `daemon-reload` → `restart axiom-core.service` → `nginx -t && reload` |
| 7 | 健康探针 | `curl https://<host>/api/health` 校验返回 `service: "Axiom Core"` |

#### 6.2.3 一次性数据迁移开关

```powershell
# ⚠️ 仅在 schema 不兼容迁移时使用，会删除 axiom_core.db + WAL/SHM
scripts\deploy_axiom_cloud.ps1 -WipeDb
```

`-WipeDb` 是显式破坏性开关，仅当版本跨越不可迁移的 schema 跃迁（如 V3 → V4）时使用；不带此 flag 时 `data/` 目录绝对保留。

#### 6.2.4 本地 ↔ 云端双向同步守护

```powershell
scripts\auto_git_sync.ps1          # 本地 → 云端：监听 Git 提交并 push
scripts\cloud_to_local_sync.ps1    # 云端 → 本地：定时 pull + rebase
```

由 Windows Scheduled Task（`AxiomCoreGitSync`、`AxiomCorePullSync`）承载常驻调度。

### 6.3 关键不变量（Greenfield 之后冻结）

| # | 标识 | 值 |
|---|------|---|
| 1 | 物理目录名 | `01_Health/` ~ `09_Principles/` |
| 2 | systemd 服务名 | `axiom-core.service` |
| 3 | 数据库文件 | `data/axiom_core.db` |
| 4 | 后端入口 | `axiom_server.py` |
| 5 | Markdown 矢量锚点 | `<!-- AXIOM:BEGIN --> / <!-- AXIOM:END -->` |
| 6 | 环境变量前缀 | `AXIOM_*` |
| 7 | Nginx upstream | `axiom_backend` |
| 8 | 公理仲裁文件 | `profile/constraints.md` |

任何对上述标识的二次重命名 = 再执行一次 Phase 2 焦土。

---

## 7. 🔐 公开仓库的脱敏护盾 (Token Desensitization Guard)

仓库以 **Public** 形态发布。`.gitignore` 默认拒绝以下文件进入版本控制：

```
*.pem, *.key, .axiom-secrets/, *.env, *.env.*
data/*.db, data/*.db-wal, data/*.db-shm
*.pdf, logs/, output/, node_modules/, .claude/local/
```

任何包含真实账号、电话、密钥、原始诊疗记录或财务凭据的内容均**禁止入 Git**。详见 [docs/security.md](docs/security.md)。

---

## 8. 📜 文档索引 (Documentation Index)

| 文档 | 用途 |
|------|------|
| [docs/product-vision.md](docs/product-vision.md) | 系统定位、边界与不做的事项 |
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

## 9. ⚖️ 协议 (License)

无开源许可证。代码与文档版权归 [@jeffxuu](https://github.com/jeffxuu)。允许阅读、参考其设计原则与公理体系；不允许克隆到任何 production 环境运行；不接受 issue / PR。

**这是一份个人主权审计文档，不是 SaaS 候选品。**
