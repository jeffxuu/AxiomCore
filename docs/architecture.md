# 系统架构

Axiom Core 是一个**单体 Python 后端 + Vite/React 单页前端 + 飞书机器人 + 本地与云端双部署**的混合架构。

## 拓扑

```
┌────────────────────────┐       ┌──────────────────────────┐
│  本机 (Windows)         │       │  云端 (jeffxu.cc)         │
│                        │       │                          │
│  python lifeos_server  │       │  systemd: lifeos.service │
│    ↑                   │       │    ↑                     │
│  Vite dev / build      │ ≈≈≈≈≈≈│  Nginx :443              │
│    ↑                   │  SSH  │    ↑                     │
│  Web UI :5173 / :8765  │ rsync │  Web UI :443             │
│  SQLite (data/lifeos.db) │     │  SQLite (data/lifeos.db) │
└────────────────────────┘       └──────────────────────────┘
       ↑                                  ↑
       │ scripts/cloud_to_local_sync.ps1  │ POST /api/feishu/events
       │ 每 5 分钟                         │
       └──────────────────────────────────┘
                                          ↑
                            ┌──────────────────────┐
                            │  飞书 (lark.com)     │
                            │  应用机器人          │
                            └──────────────────────┘
```

## 后端 (`lifeos_server.py`)

- **框架**：FastAPI + Pydantic v2 + Uvicorn
- **入口文件**：`lifeos_server.py`（单文件 ~2000 行，未拆分包）
- **本地端口**：8765
- **云端端口**：8765（内部），由 Nginx 代理到 443
- **持久化**：SQLite `data/lifeos.db`（不进 Git） + 当天 Markdown 镜像 `02_每日记录/YYYY-MM-DD.md`（进 Git）
- **配置常量**：`BRAND_NAME` / `INTERNAL_NAME` / `PRODUCT_TAGLINE` 在文件顶部声明，通过 `/api/config` 下发给前端

### 关键路由分层

| 路由 | 用途 | 是否公开 |
|------|------|---------|
| `/api/config` | 品牌与产品配置（前端启动时读取） | 公开 |
| `/api/health` | 健康检查 | 公开 |
| `/api/auth/config` | 鉴权配置 | 公开 |
| `/api/auth/me` | 当前登录状态 | 公开 |
| `/api/login` / `/api/logout` | 登录登出 | 公开 |
| `/api/altcha` | ALTCHA PoW 验证码挑战 | 公开 |
| `/api/feishu/events` | 飞书机器人回调 | 公开（用 verification token 自验） |
| `/api/bootstrap` | 当天数据 + 任务 + 类别 | 需登录 |
| `/api/docs` / `/api/docs/{id}` | 文档列表与详情 | 需登录 |
| `/api/current-state` | 自动汇总状态 | 需登录 |
| `/api/days/{date}` 等 | 录入与查询 | 需登录 |

## 前端 (`web/`)

- **框架**：React 18 + TypeScript + Vite
- **构建产物**：`web/dist/`（不进 Git）
- **路由**：单页路由，由 React Router 在浏览器内分发
- **状态**：以服务端拉取为主，少量本地 UI 状态用 React state
- **品牌渲染**：从 `/api/config` 拉取 `brandName`，所有顶栏、登录页、More 页文案通过 Context 注入

开发：`npm run dev` 启动 5173，API 代理到 8765。生产：`npm run build` 产出静态文件，由 FastAPI 直接 serve。

## 三种部署形态

### 1. 本地开发

```
python lifeos_server.py
cd web && npm run dev
```

访问 http://127.0.0.1:5173。Vite 把 `/api/*` 代理给 Python 服务。

### 2. 本地"一体化"

```
python lifeos_server.py   # 服务自动读 web/dist
```

访问 http://127.0.0.1:8765/app。FastAPI 直接 serve `web/dist/index.html`，没有 Vite。

### 3. 云端

由 `scripts/deploy_lifeos_cloud.ps1` 触发，通过 SSH 在云端执行 `server-setup/deploy-lifeos-web.sh`：
1. `git pull --ff-only origin main`
2. `npm ci && npm run build`
3. `systemctl restart lifeos.service`
4. Nginx 已在跑，规则见 `server-setup/lifeos-nginx.conf`

云端域名：`https://jeffxu.cc`。SSL 由 Nginx + Let's Encrypt 处理。

## 数据写入流程

详见 [data-flow.md](data-flow.md)。简化版：

```
[飞书消息] / [网页录入]
    ↓
POST /api/feishu/events 或 /api/days/{date}
    ↓
upsert SQLite daily_entries 表
    ↓
重写 02_每日记录/YYYY-MM-DD.md 内 LIFEOS:BEGIN ~ LIFEOS:END 区块
    ↓
本地：等待 PersonalAIProfileGitSync 5 分钟扫描，git add+commit+push
云端：jeffxu.cc 上的 LifeOSCloudGitSync 做同样的事
```

## 关键不变量

1. **SQLite 是运行态，Markdown 是档案态**。读取以 SQLite 为准；Markdown 是给人类和 Git 看的快照。
2. **Markdown 的 LIFEOS:BEGIN/END 区块由服务程序独占**。任何手工编辑这两个标记之间的内容都会在下次写入时被覆盖。区块外的笔记自由发挥。
3. **本地与云端最终一致**。本地 5 分钟拉取云端数据后写回本地；同时本地 git sync 把变更推到 GitHub。冲突由 git 处理，不是应用层处理。
4. **飞书回调是单向的**。Axiom Core 不主动推消息给飞书（暂未实现），只接收消息。

## 已知技术债

- `lifeos_server.py` 单文件接近 2000 行，未来需要按 router/service/repository 拆分
- 没有正式的数据库迁移工具，schema 变更靠 `CREATE TABLE IF NOT EXISTS`
- 飞书 token 缓存是内存 dict，重启服务会触发一次 access_token 刷新
- 前端品牌字符串迁移到 `/api/config` 还在进行中，部分文件可能仍有硬编码 "LifeOS"
