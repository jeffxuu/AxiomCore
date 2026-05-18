# Axiom Core Roadmap

最近一次更新：2026-05-17。

## 近期（4 周内）

- [x] LifeOS → Axiom Core 品牌与文档重构（本次提交）
- [x] `/api/config` 后端配置下发端点
- [x] `validate_frontmatter.py` exclude 默认目录
- [ ] 前端 36 处硬编码 "LifeOS" 改为读 `/api/config`
- [ ] 旧文档移动到 `archive/legacy-docs/`
- [ ] `profile/constraints.md` 增补 Burn Rate + ROI 公理
- [ ] `templates/*.md` 加入 `decision_status` 字段

## 季度（90 天）

- [ ] 决策引擎从"展示状态"升级到"verdict 输出"
  - 引擎读取 `current-state.md` + `constraints.md` 后输出 approve/reject/conditional
  - 至少先在网页"今日决策"卡片里展示一次
- [ ] AI Agent 接入：把 `master-system-prompt.md` 接入实际 LLM 工具，验证 CDO 行为是否如规约
- [ ] 录入合规：飞书机器人对超出 schema 的字段返回明确错误，不再静默丢弃
- [ ] 监控：`/api/health` 接入云端任意一个免费 uptime 监控（每分钟探活）

## 年度（12 个月）

- [ ] 数据可视化页：体重、睡眠、现金流走势图（recharts 或 visx）
- [ ] 周报自动化：飞书机器人每周一推送上周 AI 周报到飞书
- [ ] 第二台设备同步验证：在另一台 Windows 上测全套流程
- [ ] 数据库迁移工具：替代当前 `CREATE TABLE IF NOT EXISTS` 模式
- [ ] `lifeos_server.py` 拆分：按 router/service/repository 分包

## 已搁置 / 不做

- ❌ 多用户支持。Axiom Core 是单人系统。
- ❌ 移动端原生 App。网页 + 飞书已覆盖移动场景。
- ❌ 接入收费 LLM API。Axiom Core 自己不调用 LLM；用户在外部工具里完成。
- ❌ 第 9 域（关系网络）的实施。详见 [life-domain-model.md](life-domain-model.md#第-9-域关系网络预留不实现)。

## 未决问题（需要使用者决策）

| 问题 | 选项 | 默认（如不决策） |
|------|------|-----------------|
| 摘要文件是否继续放 Public 仓库？ | A: 留在仓库 / B: 移到 `.lifeos-secrets/` | A |
| 决策引擎触发方式？ | A: 网页主动查询 / B: 飞书每日推送 / C: 两者都做 | A |
| AI 周报频率？ | A: 每周自动 / B: 仅手动触发 | B（当前实现） |

每次升级 roadmap 时，需要先看一遍未决问题，作出决策的写到上面相应季度计划里。
