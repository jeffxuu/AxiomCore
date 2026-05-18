# 数据流

> 取代旧文档 [legacy-input-sync](../01_系统说明/录入与同步方案.md)。

四种数据源 + 双重持久化 + 三端同步。

## 录入入口（4 个，只接受其一）

| 入口 | 推荐度 | 触发路径 |
|------|--------|----------|
| 飞书机器人 | ⭐⭐⭐ 移动场景首选 | 在飞书 App 里给机器人发文本 |
| 网页打卡看板 | ⭐⭐⭐ 桌面场景首选 | http://127.0.0.1:8765/app 或 https://jeffxu.cc/app |
| 手动 Markdown | ⭐ 仅紧急修补 | 直接编辑 `logs/daily/YYYY-MM-DD.md` 区块外内容 |
| 飞书富文本指令 | ⭐⭐ 周报生成 | 给机器人发"生成周报" |

**禁止：** 直接 SQL 写 SQLite。`data/axiom_core.db` 应被视为应用程序私有。

## 飞书机器人路径

```
[手机 / 桌面] 飞书 App
    ↓ 用户发文本
飞书事件订阅 (lark.com)
    ↓ POST jeffxu.cc/api/feishu/events
axiom_server.py 的 feishu_events handler
    ↓ verify token + signature
    ↓ 解析正文 (FEISHU_FIELD_PATTERNS)
    ↓ 抽取出 sleep_hours/weight_kg/mood/...
upsert SQLite daily_entries 当天行
    ↓
重写 logs/daily/YYYY-MM-DD.md 的 AXIOM:BEGIN/END 区块
    ↓
AxiomCoreGitSync (云端 cron) git add+commit+push origin main
    ↓
PersonalAIProfileGitSync (本地 task) git pull
    ↓
本地 logs/daily/ 同步更新
```

字段抽取由 `FEISHU_FIELD_PATTERNS` 字典驱动（在 [axiom_server.py](../axiom_server.py) 顶部）。支持的字段：
- 数字：sleep_hours / weight_kg / mood / energy / expense / income / job_applications / interviews / english_minutes / exercise_minutes
- 文本：breakfast / lunch / dinner / snacks / diet_summary

未识别的内容**保留**，追加到当天的"今日笔记"字段。

## 网页打卡路径

```
浏览器 5173/8765
    ↓ POST /api/days/{date}
axiom_server.py 的 save_day handler
    ↓ Pydantic 校验 (AxiomEntry + AxiomTask)
upsert SQLite (daily_entries, daily_tasks)
    ↓
重写 logs/daily/YYYY-MM-DD.md AXIOM:BEGIN/END
```

与飞书路径**写入同一张表 + 同一个 Markdown 区块**。两者互不冲突。

## 云端 → 本地同步

```
本地 Windows 计划任务 AxiomCorePullSync
    ↓ 每 5 分钟
scripts/cloud_to_local_sync.ps1
    ↓ SSH 拉取云端 logs/daily/*.md
    ↓ 解析 AXIOM:BEGIN/END 区块字段
    ↓ 写入本地 SQLite + 重写本地 Markdown
```

凭据来自 `scripts/axiom_secrets.ps1` DPAPI 加密存储，**不在仓库内**。

## 本地 → GitHub 同步

```
本地 Windows 计划任务 PersonalAIProfileGitSync
    ↓ 每 5 分钟
scripts/auto_git_sync.ps1
    ↓ git status 检测变化
    ↓ 有变化 → git add + commit (自动消息) + push origin main
    ↓ 无变化 → 退出
```

这是无人值守的 git。**不要在 main 上做未保存的实验**——5 分钟后会被自动提交。

## 云端 → GitHub 同步

云端独立的同步任务，逻辑与本地相同但运行在 jeffxu.cc 上。这保证云端飞书录入的数据通过 GitHub 传回本地。

## 冲突处理

由于本地与云端**双向写**同一份 logs/daily，理论存在冲突。实际策略：

1. **同一天的字段冲突**：以时间靠后的 upsert 为准（SQLite 写入顺序）。
2. **不同分支 git 冲突**：人工 `git pull --rebase` + 手动解决。这种情况罕见，因为两端写入的都是 AXIOM 区块内同样的字段集。
3. **区块外的笔记冲突**：git 自动合并，冲突时人工处理。

## 自动汇总与决策输入

```
workflows/summarize_fragments.py
    ↓ 扫描最近 14 天 logs/daily/
    ↓ 扫描 templates/finance-dashboard.md frontmatter
    ↓ 扫描 templates/annual-business-goal.md frontmatter
    ↓ 计算 Burn Rate / runway_months / streak / 异常预警
    ↓ 写入 profile/current-state.md 的 AXIOM:BEGIN/END 区块
    ↓ 追加本周 AI 周报到 reports/ai-weekly/YYYY-Www.md
```

`profile/current-state.md` 是决策引擎的**唯一可信状态源**。任何 AI 在给建议前都应该读这个文件。

## 不允许的捷径

- ❌ **绕过 API 直接改 SQLite**：会破坏 Markdown 镜像，下次 API 调用时被覆盖。
- ❌ **绕过 Markdown 区块直接编辑 AXIOM:BEGIN/END 之间的内容**：下次 upsert 时被覆盖。
- ❌ **手动 git push 覆盖自动同步**：会和 5 分钟定时任务相撞。
- ✅ **要修数据**：通过网页 UI 或飞书机器人录入"覆盖值"，让正常路径生效。
