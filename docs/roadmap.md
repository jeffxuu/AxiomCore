# Axiom Core Roadmap

最近一次更新：2026-05-18（greenfield rebuild day）。

## 已完成（greenfield rebuild）

- [x] 焦土重建：废弃 `jeffxuu/personal-ai-growth-profile`，全新 `AxiomCore/` 目录、新数据库 `axiom_core.db`、新 9 大域
- [x] 全栈 LifeOS DNA 抹除：`axiom_server.py`、`AXIOM_*` env、`AxiomEntry/Task/Day`、`axiom_session` cookie、`<!-- AXIOM:BEGIN -->` 区块
- [x] 9 大领域 CDO READMEs（`01_Health/` ~ `09_Principles/`）
- [x] `profile/constraints.md` §1~§7 公理体系（Burn Rate + ROI + 健康红线）
- [x] `profile/master-system-prompt.md` 重写为 CDO 系统提示
- [x] `/api/config` 后端配置下发端点
- [x] `BrandProvider` Context + `useBrand()` hook，前端品牌字符串统一从 `/api/config` 取
- [x] `validate_frontmatter.py` + `summarize_fragments.py` 全清洗
- [x] 22 个死代码组件删除（`components/AppShell.tsx` 等）
- [x] `components/lifeos/` → `components/axiom/`，`LifeOSHero` → `AxiomHero`

## 近期（4 周内）

- [ ] Phase 3：写 `scripts/deploy_axiom_cloud.ps1` + `axiom-core.service` systemd unit + Nginx 命令对照
- [ ] Phase 4：GitHub Profile (`jeffxuu/jeffxuu`) README 更新声明 Axiom Core 上线
- [ ] Phase 5：创建新 GitHub 仓库并 push
- [ ] 云端服务器迁移：停 `lifeos.service`、清空 `/opt/lifeos-app/`、部署到 `/opt/axiom-core/`
- [ ] DPAPI 凭据迁移：旧 `LIFEOS_SSH_HOST/USER/KEY_PATH` 重新存为 `AXIOM_SSH_*`

## 季度（90 天）

- [ ] 决策引擎从"展示状态"升级到"verdict 输出"
  - 引擎读取 `current-state.md` + `constraints.md` 后输出 approve/reject/conditional
  - 至少先在网页"今日决策"卡片里展示一次
- [ ] AI Agent 接入：把 `master-system-prompt.md` 接入实际 LLM 工具，验证 CDO 行为是否如规约
- [ ] 录入合规：飞书机器人对超出 schema 的字段返回明确错误，不再静默丢弃
- [ ] 监控：`/api/health` 接入云端任意一个免费 uptime 监控（每分钟探活）
- [ ] `08_Decisions/` 工作流：每次重大决策自动生成 .md 模板，强制填 verdict + rationale

## 年度（12 个月）

- [ ] 数据可视化页：体重、睡眠、现金流、business runway 走势图
- [ ] 周报自动化：飞书机器人每周一推送上周 CDO 周报
- [ ] 第二台设备同步验证：在另一台 Windows 上测全套流程
- [ ] 数据库迁移工具：替代 `CREATE TABLE IF NOT EXISTS` 模式
- [ ] `axiom_server.py` 拆分：按 router/service/repository 分包
- [ ] `09_Principles/` 公理修订工作流：每月强制复盘 `08_Decisions/` 中 `outcome: overturned` 的 verdict

## 已搁置 / 不做

- ❌ 多用户支持。Axiom Core 是单人系统。
- ❌ 移动端原生 App。网页 + 飞书已覆盖移动场景。
- ❌ 接入收费 LLM API。Axiom Core 自己不调用 LLM；CDO 在外部 LLM 工具里运行，本系统只提供 `profile/` 和 `docs/` 作为 context。
- ❌ 第 10 域。详见 [life-domain-model.md](life-domain-model.md#何时新增第-10-域)。

## 未决问题（需要使用者决策）

| 问题 | 选项 | 默认 |
|------|------|------|
| 旧 `jeffxuu/personal-ai-growth-profile` 仓库处理？ | A: 设为 archived / B: 直接 delete / C: 改 private 留作个人档案 | A |
| 云端域名 `jeffxu.cc` 是否沿用？ | A: 沿用，只改后端代码 / B: 换新域名 | A |
| AI 周报频率？ | A: 每周自动推送飞书 / B: 仅手动触发 | B（当前实现） |
| 决策引擎触发方式？ | A: 网页主动查询 / B: 飞书每日推送 / C: 两者都做 | A |
