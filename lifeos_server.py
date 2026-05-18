from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import sqlite3
import subprocess
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Annotated, Any
from urllib import error, request
from urllib.parse import parse_qs, quote

try:
    import httpx as _httpx
    _HTTPX_AVAILABLE = True
except ImportError:
    _HTTPX_AVAILABLE = False

import frontmatter
import uvicorn
from fastapi import Body, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field

# Official ALTCHA v2 library — generates challenges in the format the v3 widget natively expects
# (parameters object with algorithm/nonce/salt/keyPrefix/cost/expiresAt + HMAC signature).
import altcha as _altcha


# Brand identity. BRAND_NAME is what the user sees; INTERNAL_NAME is the legacy
# code-level name kept for systemd, env vars, CSS classes, type names, monitoring
# greps, and any infra that already targets "LifeOS". Do not rename the internal
# one without also touching deploy scripts and Nginx config.
BRAND_NAME = "Axiom Core"
INTERNAL_NAME = "LifeOS"
PRODUCT_TAGLINE = "个人决策智能核心"

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
DB_PATH = DATA_DIR / "lifeos.db"
DAILY_DIR = ROOT / "02_每日记录"
LOGS_DAILY_DIR = ROOT / "logs" / "daily"
CURRENT_STATE_PATH = ROOT / "profile" / "current-state.md"
MASTER_SYSTEM_PROMPT_PATH = ROOT / "profile" / "master-system-prompt.md"
SUMMARY_SCRIPT_PATH = ROOT / "workflows" / "summarize_fragments.py"
LEGACY_APP_FILE = ROOT / "web" / "app.html"
FRONTEND_DIST = ROOT / "web" / "dist"
FRONTEND_INDEX = FRONTEND_DIST / "index.html"
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
DOC_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")
BLOCK_START = "<!-- LIFEOS:BEGIN -->"
BLOCK_END = "<!-- LIFEOS:END -->"
SCHEMA_DAILY_BLOCK_START = "<!-- LIFEOS_SCHEMA_DAILY:BEGIN -->"
SCHEMA_DAILY_BLOCK_END = "<!-- LIFEOS_SCHEMA_DAILY:END -->"
CRITICAL_WARNING_RE = re.compile(r"\[CRITICAL WARNING:[^\]]+\]")
FEISHU_API_BASE = "https://open.feishu.cn/open-apis"
SUMMARY_COMMANDS = {"生成周报", "更新周报", "生成风控汇总", "生成AI周报", "更新AI周报"}
FEISHU_FIELD_PATTERNS = {
    "sleep_hours": r"(?:睡眠|睡了|睡觉)\s*([0-9]+(?:\.[0-9]+)?)\s*(?:小时|h)?",
    "weight_kg": r"(?:体重)\s*([0-9]+(?:\.[0-9]+)?)\s*(?:kg|公斤)?",
    "mood": r"(?:心情|情绪)\s*([0-9]+)",
    "energy": r"(?:精力|状态)\s*([0-9]+)",
    "expense": r"(?:支出|花费|消费|花了)\s*([0-9]+(?:\.[0-9]+)?)\s*(?:元)?",
    "income": r"(?:收入|进账)\s*([0-9]+(?:\.[0-9]+)?)\s*(?:元)?",
    "job_applications": r"(?:投递|投了|简历)\s*([0-9]+)\s*(?:个|份)?|([0-9]+)\s*(?:个|份)?\s*简历",
    "interviews": r"(?:面试|沟通)\s*([0-9]+)\s*(?:次)?",
    "english_minutes": r"(?:英语|背词|听力)\s*([0-9]+)\s*(?:分钟|min)?",
    "exercise_minutes": r"(?:运动|训练|健身|跑步)\s*([0-9]+)\s*(?:分钟|min)?",
}
TEXT_FIELD_PATTERNS = {
    "breakfast": r"(?:早餐|早饭|早上吃(?:了)?)[:：]?\s*([^，,。；;\n]+)",
    "lunch": r"(?:午餐|午饭|中饭|中午吃(?:了)?)[:：]?\s*([^，,。；;\n]+)",
    "dinner": r"(?:晚餐|晚饭|晚上吃(?:了)?|晚上)[:：]?\s*([^，,。；;\n]+)",
    "snacks": r"(?:加餐|零食|夜宵)[:：]?\s*([^，,。；;\n]+)",
    "diet_summary": r"(?:饮食总结|吃得|总体吃得|总体饮食|今天吃粗|今天吃得)[:：]?\s*([^。；;\n]+)",
}
FEISHU_TOKEN_CACHE: dict[str, Any] = {"token": "", "expires_at": None}
SESSION_COOKIE = "lifeos_session"
DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 8
MIN_SESSION_SECRET_LENGTH = 32

# IP-level lockout (existing): 8 failures in 15 min → blocked
LOGIN_FAILURE_WINDOW_SECONDS = 15 * 60
LOGIN_FAILURE_LIMIT = 8
LOGIN_FAILURES: dict[str, list[datetime]] = {}

# IP-level per-minute rate limit: 5 login requests per IP per minute
IP_RATE_WINDOW_SECONDS = 60
IP_RATE_LIMIT = 5
IP_RATE_TIMES: dict[str, list[datetime]] = {}

# Per-account lockout: 5 consecutive bad-password failures → 10-min lockout
ACCOUNT_LOCKOUT_LIMIT = 5
ACCOUNT_LOCKOUT_SECONDS = 600
ACCOUNT_CONSECUTIVE_FAILURES: dict[str, int] = {}
ACCOUNT_LOCKOUT_UNTIL: dict[str, datetime] = {}

# ALTCHA v2 proof-of-work tuning
# Deterministic counter mode: server picks counter in [0, ALTCHA_COUNTER_MAX),
# client must find that exact counter. Average attempts ~= max/2.
# Each attempt is one SHA-256 with cost=1 (single iteration) → fast on any device.
ALTCHA_COUNTER_MAX = 50_000        # ~25k avg attempts; well under 1s on phones
ALTCHA_CHALLENGE_TTL_SECONDS = 300  # 5 min
ALTCHA_ALGORITHM = "SHA-256"        # iterated SHA, cost=1 → single SHA-256
ALTCHA_COST = 1

_login_log = logging.getLogger("lifeos.login")
_last_altcha_failure: dict[str, Any] = {"reason": None, "at": None, "ip": None}


CATEGORIES = [
    ("career", "职业发展", "#2457d6", 10),
    ("english", "英语学习", "#087f8c", 20),
    ("fitness", "健身训练", "#147d64", 30),
    ("health", "身体健康", "#b42318", 40),
    ("finance", "经济状况", "#aa5b00", 50),
    ("learning", "能力升级", "#6941c6", 60),
    ("mindset", "认知复盘", "#475467", 70),
]


DOC_SPECS = [
    {
        "id": "profile",
        "title": "个人 AI 发展总档案",
        "section": "总档案",
        "summary": "长期背景、经历、能力、健康、财务与阶段目标。",
        "relative_path": Path("00_个人总档案") / "00_个人AI发展档案.md",
        "sensitive": True,
    },
    {
        "id": "plan-90",
        "title": "当前处境分析与 90 天行动计划",
        "section": "90 天计划",
        "summary": "围绕求职、债务现金流、英语、运动和每日安排的行动方案。",
        "relative_path": Path("07_AI总结输出") / "2026-05-11_当前处境分析与90天行动计划.md",
        "sensitive": True,
    },
    {
        "id": "credit-summary",
        "title": "个人信用报告摘要",
        "section": "文件与补充",
        "summary": "只展示征信摘要，不暴露原始报告文件。",
        "relative_path": Path("00_个人总档案") / "个人信用报告摘要.md",
        "sensitive": True,
    },
    {
        "id": "health-summary",
        "title": "体检报告摘要",
        "section": "文件与补充",
        "summary": "健康关键指标、风险点和后续跟踪建议。",
        "relative_path": Path("03_身体健康") / "体检报告摘要.md",
        "sensitive": True,
    },
    {
        "id": "resume-summary",
        "title": "简历信息摘要",
        "section": "文件与补充",
        "summary": "职业经历、项目成绩、岗位匹配与简历素材。",
        "relative_path": Path("04_学习与技能") / "简历信息摘要.md",
        "sensitive": True,
    },
    # New Axiom Core documentation set. These supersede the legacy 01_系统说明
    # documents below; legacy entries are kept (with `legacy-` prefix) until they
    # are moved into archive/legacy-docs/ in a later cleanup pass.
    {
        "id": "product-vision",
        "title": "产品愿景",
        "section": "Axiom Core 产品",
        "summary": "定位、要解决的问题、当前阶段与核心闭环。",
        "relative_path": Path("docs") / "product-vision.md",
        "sensitive": False,
    },
    {
        "id": "life-domain-model",
        "title": "人生域模型",
        "section": "Axiom Core 产品",
        "summary": "8 大人生域与物理目录的映射关系，以及第 9 域的预留。",
        "relative_path": Path("docs") / "life-domain-model.md",
        "sensitive": False,
    },
    {
        "id": "decision-engine",
        "title": "决策引擎",
        "section": "Axiom Core 产品",
        "summary": "Axiom Core 的决策优先级、Burn Rate 与 ROI 约束、否决规则。",
        "relative_path": Path("docs") / "decision-engine.md",
        "sensitive": False,
    },
    {
        "id": "ai-agent",
        "title": "AI Agent 行为规约",
        "section": "Axiom Core 产品",
        "summary": "Axiom Core 首席决策官的人设、可观察输入、不可越界的边界。",
        "relative_path": Path("docs") / "ai-agent.md",
        "sensitive": False,
    },
    {
        "id": "roadmap",
        "title": "Axiom Core Roadmap",
        "section": "Axiom Core 产品",
        "summary": "近期、季度和年度的演进路线、已弃用项与未决问题。",
        "relative_path": Path("docs") / "roadmap.md",
        "sensitive": False,
    },
    {
        "id": "architecture",
        "title": "系统架构",
        "section": "Axiom Core 系统",
        "summary": "前后端分层、本地/云端拓扑、数据流向。",
        "relative_path": Path("docs") / "architecture.md",
        "sensitive": False,
    },
    {
        "id": "data-flow",
        "title": "数据流",
        "section": "Axiom Core 系统",
        "summary": "飞书 → 云端 → 本地 → GitHub 的多端同步流转。",
        "relative_path": Path("docs") / "data-flow.md",
        "sensitive": False,
    },
    {
        "id": "data-model",
        "title": "数据模型",
        "section": "Axiom Core 系统",
        "summary": "SQLite 表、Markdown frontmatter、JSON Schema 三者的对齐关系。",
        "relative_path": Path("docs") / "data-model.md",
        "sensitive": False,
    },
    {
        "id": "security",
        "title": "安全与隐私",
        "section": "运维与安全",
        "summary": "Public 仓库下的脱敏规则、敏感文件清单与本地凭据存储。",
        "relative_path": Path("docs") / "security.md",
        "sensitive": False,
    },
    {
        "id": "deployment",
        "title": "部署说明",
        "section": "运维与安全",
        "summary": "面向产品视角的部署流程；底层细节见 server-setup/DEPLOYMENT.md。",
        "relative_path": Path("docs") / "deployment.md",
        "sensitive": False,
    },
    {
        "id": "operations",
        "title": "日常运维",
        "section": "运维与安全",
        "summary": "本地服务、定时任务、日志位置与常见故障排查。",
        "relative_path": Path("docs") / "operations.md",
        "sensitive": False,
    },
    # Legacy documents archived under archive/legacy-docs/. Ids are prefixed
    # with `legacy-` so the new canonical ids above can claim the unprefixed
    # slots (e.g. id="roadmap" now points to docs/roadmap.md).
    {
        "id": "legacy-roadmap",
        "title": "[旧档] 系统路线图",
        "section": "归档",
        "summary": "LifeOS 时期的长期目标、记录流程、复盘方式与安全原则（已被 docs/roadmap.md 取代）。",
        "relative_path": Path("archive") / "legacy-docs" / "系统路线图.md",
        "sensitive": False,
    },
    {
        "id": "legacy-input-sync",
        "title": "[旧档] 录入与同步方案",
        "section": "归档",
        "summary": "手机、飞书、云端、本地与 GitHub 的同步设计（已被 docs/data-flow.md 取代）。",
        "relative_path": Path("archive") / "legacy-docs" / "录入与同步方案.md",
        "sensitive": False,
    },
    {
        "id": "legacy-local-db-web",
        "title": "[旧档] 本地数据库与网页打卡方案",
        "section": "归档",
        "summary": "FastAPI、SQLite、网页打卡和 Markdown 镜像的实现说明（已被 docs/architecture.md 与 docs/data-model.md 取代）。",
        "relative_path": Path("archive") / "legacy-docs" / "本地数据库与网页打卡方案.md",
        "sensitive": False,
    },
]


TASK_TEMPLATES = [
    ("career_jobs", "career", "投递或筛选目标岗位", 30, "个", 10),
    ("career_case", "career", "复盘1个面试案例或问答", 1, "组", 20),
    ("career_research", "career", "研究供应链/仓储/履约岗位要求", 30, "分钟", 30),
    ("english_momo_review", "english", "墨墨背单词复习与新词", 30, "词", 10),
    ("english_nce_listen", "english", "新概念英语精听跟读", 35, "分钟", 20),
    ("english_grammar", "english", "语法句型整理", 20, "分钟", 30),
    ("english_work", "english", "工作经历英文表达输出", 25, "分钟", 40),
    ("english_words", "english", "旧词回顾或错词复盘", 15, "分钟", 50),
    ("fitness_warmup", "fitness", "热身与关节激活", 8, "分钟", 10),
    ("fitness_strength", "fitness", "力量训练主项", 30, "分钟", 20),
    ("fitness_cardio", "fitness", "快走/慢跑/低强度有氧", 20, "分钟", 30),
    ("fitness_stretch", "fitness", "拉伸恢复", 10, "分钟", 40),
    ("fitness_record", "fitness", "训练感受与身体反馈记录", 1, "次", 50),
    ("health_sleep", "health", "记录睡眠、体重或身体异常", 1, "次", 10),
    ("health_water", "health", "饮水与饮食控制", 1, "次", 20),
    ("finance_expense", "finance", "记录今日支出", 1, "次", 10),
    ("finance_debt", "finance", "检查还款日/现金流风险", 1, "次", 20),
    ("learning_supply", "learning", "供应链/数据看板学习", 45, "分钟", 10),
    ("learning_output", "learning", "沉淀1条可复用方法或简历素材", 1, "条", 20),
    ("mindset_review", "mindset", "今日复盘与明日最重要一件事", 1, "次", 10),
]


class LifeOSEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")

    sleep_hours: float | str | None = 0
    weight_kg: float | str | None = 0
    mood: int | str | None = 0
    energy: int | str | None = 0
    expense: float | str | None = 0
    income: float | str | None = 0
    job_applications: int | str | None = 0
    interviews: int | str | None = 0
    english_minutes: int | str | None = 0
    exercise_minutes: int | str | None = 0
    breakfast: str | None = ""
    lunch: str | None = ""
    dinner: str | None = ""
    snacks: str | None = ""
    diet_summary: str | None = ""
    notes: str | None = ""


class LifeOSTask(BaseModel):
    model_config = ConfigDict(extra="ignore")

    task_id: str
    category_id: str
    title: str
    target_value: float | str | None = 1
    actual_value: float | str | None = 0
    unit: str | None = "次"
    done: bool | int = False
    sort_order: int | str | None = 0


class SaveDayPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    date: str | None = Field(default=None)
    entry: LifeOSEntry = Field(default_factory=LifeOSEntry)
    tasks: list[LifeOSTask] = Field(default_factory=list)


class FeishuEventPayload(BaseModel):
    model_config = ConfigDict(extra="allow")

    challenge: str | None = None
    token: str | None = None
    type: str | None = None
    schema_: str | None = Field(default=None, alias="schema")
    header: dict[str, Any] | None = None
    event: dict[str, Any] | None = None


def now_iso() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def today_text() -> str:
    return date.today().isoformat()


def parse_date(value: str | None) -> str:
    if value and DATE_RE.match(value):
        return value
    return today_text()


def to_float(value: Any, default: float = 0.0) -> float:
    if value in (None, ""):
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def to_int(value: Any, default: int = 0) -> int:
    if value in (None, ""):
        return default
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def first_match_value(match: re.Match[str]) -> str:
    for value in match.groups():
        if value not in (None, ""):
            return str(value)
    return match.group(0)


def connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def init_db() -> None:
    with connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS categories (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                color TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS task_templates (
                id TEXT PRIMARY KEY,
                category_id TEXT NOT NULL,
                title TEXT NOT NULL,
                target_value REAL NOT NULL DEFAULT 1,
                unit TEXT NOT NULL DEFAULT "次",
                sort_order INTEGER NOT NULL DEFAULT 0,
                active INTEGER NOT NULL DEFAULT 1,
                FOREIGN KEY (category_id) REFERENCES categories(id)
            );

            CREATE TABLE IF NOT EXISTS daily_entries (
                date TEXT PRIMARY KEY,
                sleep_hours REAL NOT NULL DEFAULT 0,
                weight_kg REAL NOT NULL DEFAULT 0,
                mood INTEGER NOT NULL DEFAULT 0,
                energy INTEGER NOT NULL DEFAULT 0,
                expense REAL NOT NULL DEFAULT 0,
                income REAL NOT NULL DEFAULT 0,
                job_applications INTEGER NOT NULL DEFAULT 0,
                interviews INTEGER NOT NULL DEFAULT 0,
                english_minutes INTEGER NOT NULL DEFAULT 0,
                exercise_minutes INTEGER NOT NULL DEFAULT 0,
                breakfast TEXT NOT NULL DEFAULT "",
                lunch TEXT NOT NULL DEFAULT "",
                dinner TEXT NOT NULL DEFAULT "",
                snacks TEXT NOT NULL DEFAULT "",
                diet_summary TEXT NOT NULL DEFAULT "",
                notes TEXT NOT NULL DEFAULT "",
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS daily_tasks (
                date TEXT NOT NULL,
                task_id TEXT NOT NULL,
                category_id TEXT NOT NULL,
                title TEXT NOT NULL,
                target_value REAL NOT NULL DEFAULT 1,
                actual_value REAL NOT NULL DEFAULT 0,
                unit TEXT NOT NULL DEFAULT "次",
                done INTEGER NOT NULL DEFAULT 0,
                sort_order INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (date, task_id),
                FOREIGN KEY (category_id) REFERENCES categories(id)
            );
            """
        )
        ensure_daily_entry_columns(conn)
        for category in CATEGORIES:
            conn.execute(
                """
                INSERT INTO categories (id, name, color, sort_order)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    color = excluded.color,
                    sort_order = excluded.sort_order
                """,
                category,
            )
        conn.execute("UPDATE task_templates SET active = 0")
        for task in TASK_TEMPLATES:
            conn.execute(
                """
                INSERT INTO task_templates
                    (id, category_id, title, target_value, unit, sort_order, active)
                VALUES (?, ?, ?, ?, ?, ?, 1)
                ON CONFLICT(id) DO UPDATE SET
                    category_id = excluded.category_id,
                    title = excluded.title,
                    target_value = excluded.target_value,
                    unit = excluded.unit,
                    sort_order = excluded.sort_order,
                    active = 1
                """,
                task,
            )


def ensure_daily_entry_columns(conn: sqlite3.Connection) -> None:
    existing = {row["name"] for row in conn.execute("PRAGMA table_info(daily_entries)").fetchall()}
    text_columns = {
        "breakfast": "",
        "lunch": "",
        "dinner": "",
        "snacks": "",
        "diet_summary": "",
    }
    for column, default in text_columns.items():
        if column not in existing:
            conn.execute(f'ALTER TABLE daily_entries ADD COLUMN {column} TEXT NOT NULL DEFAULT "{default}"')


def ensure_day(conn: sqlite3.Connection, day: str) -> None:
    updated_at = now_iso()
    conn.execute(
        """
        INSERT OR IGNORE INTO daily_entries (date, updated_at)
        VALUES (?, ?)
        """,
        (day, updated_at),
    )
    templates = conn.execute(
        """
        SELECT id, category_id, title, target_value, unit, sort_order
        FROM task_templates
        WHERE active = 1
        ORDER BY sort_order, id
        """
    ).fetchall()
    for task in templates:
        conn.execute(
            """
            INSERT INTO daily_tasks
                (date, task_id, category_id, title, target_value, unit, sort_order, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(date, task_id) DO UPDATE SET
                category_id = excluded.category_id,
                title = excluded.title,
                target_value = excluded.target_value,
                unit = excluded.unit,
                sort_order = excluded.sort_order,
                updated_at = excluded.updated_at
            """,
            (
                day,
                task["id"],
                task["category_id"],
                task["title"],
                task["target_value"],
                task["unit"],
                task["sort_order"],
                updated_at,
            ),
        )


def fetch_categories(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT id, name, color, sort_order FROM categories ORDER BY sort_order"
    ).fetchall()
    return [dict(row) for row in rows]


def fetch_day(conn: sqlite3.Connection, day: str) -> dict[str, Any]:
    ensure_day(conn, day)
    entry = conn.execute("SELECT * FROM daily_entries WHERE date = ?", (day,)).fetchone()
    tasks = conn.execute(
        """
        SELECT t.task_id, t.category_id, t.title, t.target_value, t.actual_value,
               t.unit, t.done, t.sort_order
        FROM daily_tasks t
        LEFT JOIN task_templates tt ON tt.id = t.task_id
        WHERE t.date = ?
          AND (tt.active = 1 OR t.task_id LIKE 'custom_%')
        ORDER BY t.sort_order, t.task_id
        """,
        (day,),
    ).fetchall()
    return {
        "date": day,
        "entry": dict(entry),
        "tasks": [dict(row) for row in tasks],
    }


def completion_rate(done: int, total: int) -> float:
    if total <= 0:
        return 0.0
    return round(done / total, 4)


def fetch_dashboard(conn: sqlite3.Connection, day: str) -> dict[str, Any]:
    selected = datetime.strptime(day, "%Y-%m-%d").date()
    start_30 = (selected - timedelta(days=29)).isoformat()
    start_14 = (selected - timedelta(days=13)).isoformat()
    start_7 = (selected - timedelta(days=6)).isoformat()

    task_rows = conn.execute(
        """
        SELECT t.date, COUNT(*) AS total, SUM(t.done) AS done
        FROM daily_tasks t
        LEFT JOIN task_templates tt ON tt.id = t.task_id
        WHERE t.date BETWEEN ? AND ?
          AND (tt.active = 1 OR t.task_id LIKE 'custom_%')
        GROUP BY t.date
        """,
        (start_30, day),
    ).fetchall()
    rates = {
        row["date"]: {
            "total": int(row["total"] or 0),
            "done": int(row["done"] or 0),
            "rate": completion_rate(int(row["done"] or 0), int(row["total"] or 0)),
        }
        for row in task_rows
    }

    recent_days = []
    for index in range(14):
        current = selected - timedelta(days=13 - index)
        key = current.isoformat()
        stat = rates.get(key, {"total": 0, "done": 0, "rate": 0.0})
        recent_days.append({"date": key, **stat})

    streak = 0
    for index in range(365):
        key = (selected - timedelta(days=index)).isoformat()
        stat = rates.get(key)
        if not stat:
            break
        if stat["total"] > 0 and stat["rate"] >= 0.8:
            streak += 1
        else:
            break

    today = rates.get(day, {"total": 0, "done": 0, "rate": 0.0})
    thirty_total = sum(row["total"] for row in rates.values())
    thirty_done = sum(row["done"] for row in rates.values())

    entry_rows = conn.execute(
        """
        SELECT date, sleep_hours, weight_kg, mood, energy, expense, income,
               job_applications, interviews, english_minutes, exercise_minutes,
               breakfast, lunch, dinner, snacks, diet_summary
        FROM daily_entries
        WHERE date BETWEEN ? AND ?
        """,
        (start_30, day),
    ).fetchall()
    entries = {row["date"]: dict(row) for row in entry_rows}
    timeline = []
    for index in range(30):
        current = selected - timedelta(days=29 - index)
        key = current.isoformat()
        stat = rates.get(key, {"total": 0, "done": 0, "rate": 0.0})
        entry = entries.get(key, {})
        timeline.append(
            {
                "date": key,
                "rate": stat["rate"],
                "done": stat["done"],
                "total": stat["total"],
                "englishMinutes": int(entry.get("english_minutes") or 0),
                "exerciseMinutes": int(entry.get("exercise_minutes") or 0),
                "jobApplications": int(entry.get("job_applications") or 0),
                "interviews": int(entry.get("interviews") or 0),
                "expense": round(float(entry.get("expense") or 0), 2),
                "income": round(float(entry.get("income") or 0), 2),
                "sleepHours": round(float(entry.get("sleep_hours") or 0), 1),
                "mood": int(entry.get("mood") or 0),
                "energy": int(entry.get("energy") or 0),
                "hasDiet": 1
                if any(
                    str(entry.get(field) or "").strip()
                    for field in ("breakfast", "lunch", "dinner", "snacks", "diet_summary")
                )
                else 0,
            }
        )

    category_rows = conn.execute(
        """
        SELECT c.id, c.name, c.color,
               COUNT(t.task_id) AS total,
               COALESCE(SUM(t.done), 0) AS done
        FROM categories c
        LEFT JOIN daily_tasks t
          ON t.category_id = c.id
         AND t.date BETWEEN ? AND ?
         AND (
             EXISTS (
                 SELECT 1
                 FROM task_templates tt
                 WHERE tt.id = t.task_id
                   AND tt.active = 1
             )
             OR t.task_id LIKE 'custom_%'
         )
        GROUP BY c.id, c.name, c.color, c.sort_order
        ORDER BY c.sort_order
        """,
        (start_30, day),
    ).fetchall()
    categories = []
    for row in category_rows:
        total = int(row["total"] or 0)
        done = int(row["done"] or 0)
        categories.append(
            {
                "id": row["id"],
                "name": row["name"],
                "color": row["color"],
                "total": total,
                "done": done,
                "rate": completion_rate(done, total),
            }
        )

    metrics = conn.execute(
        """
        SELECT
            COALESCE(SUM(CASE WHEN date BETWEEN ? AND ? THEN english_minutes ELSE 0 END), 0) AS english_7d,
            COALESCE(SUM(CASE WHEN date BETWEEN ? AND ? THEN exercise_minutes ELSE 0 END), 0) AS exercise_7d,
            COALESCE(SUM(CASE WHEN date BETWEEN ? AND ? THEN job_applications ELSE 0 END), 0) AS jobs_7d,
            COALESCE(SUM(CASE WHEN date BETWEEN ? AND ? THEN interviews ELSE 0 END), 0) AS interviews_7d,
            COALESCE(SUM(CASE WHEN date BETWEEN ? AND ? THEN expense ELSE 0 END), 0) AS expense_30d,
            COALESCE(SUM(CASE WHEN date BETWEEN ? AND ? THEN income ELSE 0 END), 0) AS income_30d,
            AVG(CASE WHEN date BETWEEN ? AND ? AND sleep_hours > 0 THEN sleep_hours END) AS avg_sleep_7d,
            AVG(CASE WHEN date BETWEEN ? AND ? AND mood > 0 THEN mood END) AS avg_mood_7d,
            AVG(CASE WHEN date BETWEEN ? AND ? AND energy > 0 THEN energy END) AS avg_energy_7d
        FROM daily_entries
        WHERE date BETWEEN ? AND ?
        """,
        (
            start_7,
            day,
            start_7,
            day,
            start_7,
            day,
            start_7,
            day,
            start_30,
            day,
            start_30,
            day,
            start_7,
            day,
            start_7,
            day,
            start_7,
            day,
            start_30,
            day,
        ),
    ).fetchone()

    strongest = max(categories, key=lambda item: item["rate"], default=None)
    weakest = min(
        [item for item in categories if item["total"] > 0],
        key=lambda item: item["rate"],
        default=None,
    )

    return {
        "today": today,
        "streak": streak,
        "thirtyDays": {
            "total": thirty_total,
            "done": thirty_done,
            "rate": completion_rate(thirty_done, thirty_total),
        },
        "timeline": timeline,
        "categories": categories,
        "recentDays": recent_days,
        "metrics": {
            "english7d": int(metrics["english_7d"] or 0),
            "exercise7d": int(metrics["exercise_7d"] or 0),
            "jobs7d": int(metrics["jobs_7d"] or 0),
            "interviews7d": int(metrics["interviews_7d"] or 0),
            "expense30d": round(float(metrics["expense_30d"] or 0), 2),
            "income30d": round(float(metrics["income_30d"] or 0), 2),
            "avgSleep7d": round(float(metrics["avg_sleep_7d"] or 0), 1),
            "avgMood7d": round(float(metrics["avg_mood_7d"] or 0), 1),
            "avgEnergy7d": round(float(metrics["avg_energy_7d"] or 0), 1),
        },
        "signals": {
            "strongest": strongest,
            "weakest": weakest,
        },
    }


def md_cell(value: Any) -> str:
    text = "" if value is None else str(value)
    return text.replace("|", "\\|").replace("\r\n", "<br>").replace("\n", "<br>")


def render_markdown(conn: sqlite3.Connection, day: str) -> str:
    payload = fetch_day(conn, day)
    entry = payload["entry"]
    tasks = payload["tasks"]
    categories = {category["id"]: category["name"] for category in fetch_categories(conn)}
    total = len(tasks)
    done = sum(1 for task in tasks if task["done"])
    rate = round(completion_rate(done, total) * 100)

    lines = [
        f"# {day} 每日记录",
        "",
        f"生成时间：{now_iso()}",
        "",
        "## 今日概览",
        "",
        f"- 任务完成：{done}/{total}（{rate}%）",
        f"- 睡眠：{entry['sleep_hours']} 小时",
        f"- 体重：{entry['weight_kg']} kg",
        f"- 情绪：{entry['mood']}/10",
        f"- 精力：{entry['energy']}/10",
        f"- 支出：{entry['expense']}",
        f"- 收入：{entry['income']}",
        f"- 投递岗位：{entry['job_applications']} 个",
        f"- 面试/沟通：{entry['interviews']} 次",
        f"- 英语学习：{entry['english_minutes']} 分钟",
        f"- 运动训练：{entry['exercise_minutes']} 分钟",
        f"- 早餐：{entry['breakfast'] or '未记录'}",
        f"- 午餐：{entry['lunch'] or '未记录'}",
        f"- 晚餐：{entry['dinner'] or '未记录'}",
        f"- 加餐/零食：{entry['snacks'] or '未记录'}",
        f"- 饮食总结：{entry['diet_summary'] or '未记录'}",
        "",
        "## 任务打卡",
        "",
        "| 类型 | 任务 | 状态 | 记录 |",
        "| --- | --- | --- | --- |",
    ]
    for task in tasks:
        status = "已完成" if task["done"] else "未完成"
        actual = task["actual_value"]
        target = task["target_value"]
        unit = task["unit"]
        record = f"{actual:g}/{target:g} {unit}" if unit else f"{actual:g}/{target:g}"
        lines.append(
            "| "
            + " | ".join(
                [
                    md_cell(categories.get(task["category_id"], task["category_id"])),
                    md_cell(task["title"]),
                    md_cell(status),
                    md_cell(record),
                ]
            )
            + " |"
        )

    notes = entry["notes"].strip() or "无"
    lines.extend(["", "## 今日笔记", "", notes, "", "## 明日关注", ""])
    if rate < 60:
        lines.append("- 明天优先减少任务数量，先保证英语、求职、运动三条主线不断。")
    elif rate < 80:
        lines.append("- 整体推进正常，明天优先补齐低完成类型。")
    else:
        lines.append("- 今日执行较稳，明天继续保持关键任务的固定时段。")

    if to_float(entry["sleep_hours"]) and to_float(entry["sleep_hours"]) < 6:
        lines.append("- 睡眠低于6小时，明天不要叠加高强度训练。")
    if to_float(entry["expense"]) > 0:
        lines.append("- 支出已记录，周复盘时需要和现金流压力一起看。")
    if any(str(entry[field] or "").strip() for field in ("breakfast", "lunch", "dinner", "snacks")):
        lines.append("- 饮食已记录，周复盘时可以结合体重和运动一起看。")

    return "\n".join(lines).strip() + "\n"


def write_daily_markdown(conn: sqlite3.Connection, day: str) -> Path:
    DAILY_DIR.mkdir(exist_ok=True)
    path = DAILY_DIR / f"{day}.md"
    generated = f"{BLOCK_START}\n{render_markdown(conn, day)}{BLOCK_END}\n"

    if path.exists():
        existing = path.read_text(encoding="utf-8")
        if BLOCK_START in existing and BLOCK_END in existing:
            before, rest = existing.split(BLOCK_START, 1)
            _, after = rest.split(BLOCK_END, 1)
            content = before.rstrip() + "\n\n" + generated + after.lstrip()
        else:
            content = existing.rstrip() + "\n\n" + generated
    else:
        content = generated

    path.write_text(content, encoding="utf-8", newline="\n")
    return path


def bounded_float(value: Any, minimum: float, maximum: float, default: float = 0.0) -> float:
    number = to_float(value, default)
    return max(minimum, min(maximum, number))


def non_negative_float(value: Any, default: float = 0.0) -> float:
    return max(0.0, to_float(value, default))


def sleep_quality_from_hours(hours: float) -> str:
    if hours >= 7:
        return "good"
    if hours >= 6:
        return "fair"
    return "poor"


def daily_health_metadata(entry: dict[str, Any], day: str, source: str) -> dict[str, Any]:
    safe_source = source if source in {"web", "feishu", "manual", "imported"} else "web"
    sleep_hours = bounded_float(entry.get("sleep_hours"), 0, 24)
    energy_score = bounded_float(entry.get("energy"), 0, 10)
    mood_score = bounded_float(entry.get("mood"), 0, 10)
    exercise_minutes = non_negative_float(entry.get("exercise_minutes"))
    expense_cny = non_negative_float(entry.get("expense"))
    tags = ["daily", "health", safe_source]
    if 0 < energy_score <= 2:
        tags.append("low-energy")
    if 0 < sleep_hours < 6:
        tags.append("low-sleep")
    if expense_cny > 0:
        tags.append("expense-recorded")

    return {
        "schema_version": 1,
        "type": "daily_health_log",
        "date": day,
        "status": "active",
        "source": safe_source,
        "sleep_hours": sleep_hours,
        "height_cm": None,
        "weight_kg": non_negative_float(entry.get("weight_kg")),
        "body_fat_pct": None,
        "sleep_quality": sleep_quality_from_hours(sleep_hours),
        "mood_score": mood_score,
        "energy_score": energy_score,
        "exercise_minutes": exercise_minutes,
        "water_ml": None,
        "expense_cny": expense_cny,
        "symptoms": [],
        "tags": tags,
    }


def daily_health_line(label: str, value: Any, suffix: str = "") -> str:
    if value in (None, ""):
        return f"- {label}：未记录"
    return f"- {label}：{value}{suffix}"


def render_daily_health_log(entry: dict[str, Any], day: str) -> str:
    notes = str(entry.get("notes") or "").strip() or "无"
    lines = [
        SCHEMA_DAILY_BLOCK_START,
        f"# {day} 每日健康日志",
        "",
        f"生成时间：{now_iso()}",
        "",
        "## 今天身体状态",
        "",
        daily_health_line("睡眠", entry.get("sleep_hours"), " 小时"),
        daily_health_line("体重", entry.get("weight_kg"), " kg"),
        daily_health_line("精力", entry.get("energy"), "/10"),
        daily_health_line("情绪", entry.get("mood"), "/10"),
        daily_health_line("运动", entry.get("exercise_minutes"), " 分钟"),
        "",
        "## 饮食与现金流",
        "",
        daily_health_line("早餐", entry.get("breakfast")),
        daily_health_line("午餐", entry.get("lunch")),
        daily_health_line("晚餐", entry.get("dinner")),
        daily_health_line("加餐/饮料", entry.get("snacks")),
        daily_health_line("饮食总结", entry.get("diet_summary")),
        daily_health_line("支出", entry.get("expense"), " 元"),
        "",
        "## 飞书与网页记录",
        "",
        notes,
        SCHEMA_DAILY_BLOCK_END,
    ]
    return "\n".join(lines).strip() + "\n"


def replace_generated_block(content: str, generated: str, start: str, end: str) -> str:
    if start in content and end in content:
        before, rest = content.split(start, 1)
        _, after = rest.split(end, 1)
        return before.rstrip() + "\n\n" + generated + after.lstrip()
    if content.strip():
        return content.rstrip() + "\n\n" + generated
    return generated


def write_daily_health_log(conn: sqlite3.Connection, day: str, source: str = "web") -> Path:
    LOGS_DAILY_DIR.mkdir(parents=True, exist_ok=True)
    path = LOGS_DAILY_DIR / f"{day}.md"
    entry = dict(fetch_day(conn, day)["entry"])
    metadata = daily_health_metadata(entry, day, source)
    generated = render_daily_health_log(entry, day)

    if path.exists():
        post = frontmatter.load(path, encoding="utf-8")
    else:
        post = frontmatter.Post("")

    merged_metadata = dict(post.metadata)
    merged_metadata.update(metadata)
    post.metadata = merged_metadata
    post.content = replace_generated_block(
        post.content,
        generated,
        SCHEMA_DAILY_BLOCK_START,
        SCHEMA_DAILY_BLOCK_END,
    )
    path.write_text(frontmatter.dumps(post).rstrip() + "\n", encoding="utf-8", newline="\n")
    return path


def save_day(payload: SaveDayPayload, source: str = "web") -> dict[str, Any]:
    day = parse_date(payload.date)
    entry = payload.entry.model_dump()
    tasks = [task.model_dump() for task in payload.tasks]
    updated_at = now_iso()

    with connect() as conn:
        ensure_day(conn, day)
        conn.execute(
            """
            INSERT INTO daily_entries (
                date, sleep_hours, weight_kg, mood, energy, expense, income,
                job_applications, interviews, english_minutes, exercise_minutes,
                breakfast, lunch, dinner, snacks, diet_summary, notes, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(date) DO UPDATE SET
                sleep_hours = excluded.sleep_hours,
                weight_kg = excluded.weight_kg,
                mood = excluded.mood,
                energy = excluded.energy,
                expense = excluded.expense,
                income = excluded.income,
                job_applications = excluded.job_applications,
                interviews = excluded.interviews,
                english_minutes = excluded.english_minutes,
                exercise_minutes = excluded.exercise_minutes,
                breakfast = excluded.breakfast,
                lunch = excluded.lunch,
                dinner = excluded.dinner,
                snacks = excluded.snacks,
                diet_summary = excluded.diet_summary,
                notes = excluded.notes,
                updated_at = excluded.updated_at
            """,
            (
                day,
                to_float(entry.get("sleep_hours")),
                to_float(entry.get("weight_kg")),
                to_int(entry.get("mood")),
                to_int(entry.get("energy")),
                to_float(entry.get("expense")),
                to_float(entry.get("income")),
                to_int(entry.get("job_applications")),
                to_int(entry.get("interviews")),
                to_int(entry.get("english_minutes")),
                to_int(entry.get("exercise_minutes")),
                str(entry.get("breakfast") or "").strip(),
                str(entry.get("lunch") or "").strip(),
                str(entry.get("dinner") or "").strip(),
                str(entry.get("snacks") or "").strip(),
                str(entry.get("diet_summary") or "").strip(),
                str(entry.get("notes") or "").strip(),
                updated_at,
            ),
        )

        valid_categories = {category["id"] for category in fetch_categories(conn)}
        for index, task in enumerate(tasks):
            task_id = str(task.get("task_id") or "").strip()
            title = str(task.get("title") or "").strip()
            category_id = str(task.get("category_id") or "").strip()
            if not task_id or not title or category_id not in valid_categories:
                continue
            conn.execute(
                """
                INSERT INTO daily_tasks (
                    date, task_id, category_id, title, target_value, actual_value,
                    unit, done, sort_order, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(date, task_id) DO UPDATE SET
                    category_id = excluded.category_id,
                    title = excluded.title,
                    target_value = excluded.target_value,
                    actual_value = excluded.actual_value,
                    unit = excluded.unit,
                    done = excluded.done,
                    sort_order = excluded.sort_order,
                    updated_at = excluded.updated_at
                """,
                (
                    day,
                    task_id,
                    category_id,
                    title,
                    to_float(task.get("target_value"), 1),
                    to_float(task.get("actual_value")),
                    str(task.get("unit") or "次").strip(),
                    1 if task.get("done") else 0,
                    to_int(task.get("sort_order"), index),
                    updated_at,
                ),
            )

        markdown_path = write_daily_markdown(conn, day)
        schema_markdown_path = write_daily_health_log(conn, day, source)
        conn.commit()
        return {
            "day": fetch_day(conn, day),
            "dashboard": fetch_dashboard(conn, day),
            "markdownPath": str(markdown_path.relative_to(ROOT)),
            "schemaMarkdownPath": str(schema_markdown_path.relative_to(ROOT)),
        }


def load_bootstrap(day: str) -> dict[str, Any]:
    with connect() as conn:
        payload = {
            "categories": fetch_categories(conn),
            "day": fetch_day(conn, day),
            "dashboard": fetch_dashboard(conn, day),
        }
        conn.commit()
        return payload


def read_markdown_file(path: Path) -> str:
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Document not found")
    return path.read_text(encoding="utf-8", errors="replace")


def read_markdown_or_empty(path: Path) -> str:
    if not path.exists() or not path.is_file():
        return ""
    return path.read_text(encoding="utf-8", errors="replace")


def doc_updated_at(path: Path) -> str | None:
    if not path.exists():
        return None
    return datetime.fromtimestamp(path.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S")


def extract_critical_warnings(content: str) -> list[str]:
    return list(dict.fromkeys(CRITICAL_WARNING_RE.findall(content)))


def run_summary_workflow() -> dict[str, Any]:
    if not SUMMARY_SCRIPT_PATH.exists():
        raise RuntimeError(f"Summary script not found: {SUMMARY_SCRIPT_PATH.relative_to(ROOT)}")

    completed = subprocess.run(
        [sys.executable, str(SUMMARY_SCRIPT_PATH)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=180,
        check=False,
    )
    if completed.returncode != 0:
        stderr = completed.stderr.strip()
        stdout = completed.stdout.strip()
        detail = stderr or stdout or f"exit code {completed.returncode}"
        raise RuntimeError(f"Summary workflow failed: {detail}")

    current_state = read_markdown_or_empty(CURRENT_STATE_PATH)
    return {
        "ok": True,
        "stdout": completed.stdout.strip(),
        "currentStatePath": str(CURRENT_STATE_PATH.relative_to(ROOT)),
        "weeklyReportDir": str((ROOT / "reports" / "ai-weekly").relative_to(ROOT)),
        "warnings": extract_critical_warnings(current_state),
    }


def current_state_payload() -> dict[str, Any]:
    current_state = read_markdown_or_empty(CURRENT_STATE_PATH)
    master_prompt = read_markdown_or_empty(MASTER_SYSTEM_PROMPT_PATH)
    warnings = extract_critical_warnings(current_state)
    return {
        "ok": True,
        "warnings": warnings,
        "currentState": {
            "relativePath": str(CURRENT_STATE_PATH.relative_to(ROOT)).replace("\\", "/"),
            "updatedAt": doc_updated_at(CURRENT_STATE_PATH),
            "content": current_state,
        },
        "masterSystemPrompt": {
            "relativePath": str(MASTER_SYSTEM_PROMPT_PATH.relative_to(ROOT)).replace("\\", "/"),
            "updatedAt": doc_updated_at(MASTER_SYSTEM_PROMPT_PATH),
            "content": master_prompt,
        },
    }


def markdown_excerpt(content: str, limit: int = 160) -> str:
    lines = []
    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("```") or line.startswith("<!--"):
            continue
        line = re.sub(r"^#{1,6}\s*", "", line)
        line = re.sub(r"^[-*]\s+", "", line)
        line = re.sub(r"^\d+\.\s+", "", line)
        line = line.replace("**", "").replace("`", "")
        if line:
            lines.append(line)
        if len(" ".join(lines)) >= limit:
            break
    excerpt = " ".join(lines)
    return excerpt[:limit].rstrip() + ("..." if len(excerpt) > limit else "")


def static_doc_registry() -> dict[str, dict[str, Any]]:
    registry: dict[str, dict[str, Any]] = {}
    for spec in DOC_SPECS:
        doc_path = ROOT / spec["relative_path"]
        registry[str(spec["id"])] = {
            "id": str(spec["id"]),
            "title": str(spec["title"]),
            "section": str(spec["section"]),
            "summary": str(spec["summary"]),
            "relativePath": str(spec["relative_path"]).replace("\\", "/"),
            "updatedAt": doc_updated_at(doc_path),
            "sensitive": bool(spec.get("sensitive", True)),
            "kind": "markdown",
            "path": doc_path,
        }
    return registry


def daily_doc_registry() -> dict[str, dict[str, Any]]:
    registry: dict[str, dict[str, Any]] = {}
    if not DAILY_DIR.exists():
        return registry
    for path in sorted(DAILY_DIR.glob("*.md"), reverse=True):
        if not DATE_RE.match(path.stem):
            continue
        doc_id = f"daily-{path.stem}"
        registry[doc_id] = {
            "id": doc_id,
            "title": f"每日记录 {path.stem}",
            "section": "每日记录",
            "summary": "当天的行动、饮食、学习、求职、支出和复盘记录。",
            "relativePath": str(path.relative_to(ROOT)).replace("\\", "/"),
            "updatedAt": doc_updated_at(path),
            "sensitive": True,
            "kind": "daily",
            "date": path.stem,
            "path": path,
        }
    return registry


def docs_registry() -> dict[str, dict[str, Any]]:
    registry = static_doc_registry()
    registry.update(daily_doc_registry())
    return registry


def serialize_doc_meta(item: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in item.items() if key != "path"}


def list_docs() -> list[dict[str, Any]]:
    return [serialize_doc_meta(item) for item in docs_registry().values()]


def get_doc_payload(doc_id: str) -> dict[str, Any]:
    if not DOC_ID_RE.match(doc_id):
        raise HTTPException(status_code=404, detail="Document not found")
    item = docs_registry().get(doc_id)
    if not item:
        raise HTTPException(status_code=404, detail="Document not found")
    content = read_markdown_file(item["path"])
    payload = serialize_doc_meta(item)
    payload["content"] = content
    payload["excerpt"] = markdown_excerpt(content)
    return payload


def parse_feishu_message_text(event: dict[str, Any]) -> str:
    message = event.get("message") or {}
    content = message.get("content") or ""
    if isinstance(content, str):
        try:
            content_payload = json.loads(content)
        except json.JSONDecodeError:
            return content.strip()
    elif isinstance(content, dict):
        content_payload = content
    else:
        return ""

    text = str(content_payload.get("text") or "").strip()
    return re.sub(r"@\S+\s*", "", text).strip()


def is_summary_command(text: str) -> bool:
    normalized = re.sub(r"[\s，。,.!！?？]+", "", text.strip()).upper()
    return normalized in SUMMARY_COMMANDS


def parse_lifeos_text(text: str) -> tuple[dict[str, Any], str]:
    command = re.sub(r"^(?:记录|录入|打卡|新增)\s*", "", text.strip())
    entry: dict[str, Any] = {}
    for field, pattern in FEISHU_FIELD_PATTERNS.items():
        match = re.search(pattern, command, flags=re.IGNORECASE)
        if not match:
            continue
        value = first_match_value(match)
        entry[field] = to_float(value) if field in {"sleep_hours", "weight_kg", "expense", "income"} else to_int(value)
    for field, pattern in TEXT_FIELD_PATTERNS.items():
        match = re.search(pattern, command, flags=re.IGNORECASE)
        if not match:
            continue
        value = re.sub(r"\s+", " ", match.group(1)).strip(" ，,;；。")
        if value:
            entry[field] = value
    return entry, command


FIELD_LABELS = {
    "sleep_hours": "睡眠",
    "weight_kg": "体重",
    "mood": "心情",
    "energy": "精力",
    "expense": "支出",
    "income": "收入",
    "job_applications": "简历投递",
    "interviews": "面试/沟通",
    "english_minutes": "英语",
    "exercise_minutes": "运动",
    "breakfast": "早餐",
    "lunch": "午餐",
    "dinner": "晚餐",
    "snacks": "加餐/零食",
    "diet_summary": "饮食总结",
}


def append_feishu_entry(text: str) -> dict[str, Any]:
    day = today_text()
    parsed_entry, note = parse_lifeos_text(text)
    with connect() as conn:
        current = fetch_day(conn, day)
        entry = dict(current["entry"])
        for field, value in parsed_entry.items():
            entry[field] = value

        notes = str(entry.get("notes") or "").strip()
        stamped_note = f"[飞书 {datetime.now().strftime('%H:%M')}] {note}"
        entry["notes"] = f"{notes}\n{stamped_note}".strip() if notes else stamped_note

    payload = SaveDayPayload(
        date=day,
        entry=LifeOSEntry(**entry),
        tasks=[LifeOSTask(**task) for task in current["tasks"]],
    )
    result = save_day(payload, source="feishu")
    return {"day": day, "fields": sorted(parsed_entry), "note": note, "result": result}


def feishu_http_json(path: str, payload: dict[str, Any], token: str | None = None) -> dict[str, Any]:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    headers = {"Content-Type": "application/json; charset=utf-8"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = request.Request(f"{FEISHU_API_BASE}{path}", data=body, headers=headers, method="POST")
    try:
        with request.urlopen(req, timeout=8) as response:
            return json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Feishu API failed: {exc.code} {detail}") from exc


def get_feishu_tenant_token() -> str | None:
    app_id = os.getenv("FEISHU_APP_ID")
    app_secret = os.getenv("FEISHU_APP_SECRET")
    if not app_id or not app_secret:
        return None

    expires_at = FEISHU_TOKEN_CACHE.get("expires_at")
    if FEISHU_TOKEN_CACHE.get("token") and isinstance(expires_at, datetime) and expires_at > datetime.now():
        return str(FEISHU_TOKEN_CACHE["token"])

    payload = {"app_id": app_id, "app_secret": app_secret}
    result = feishu_http_json("/auth/v3/tenant_access_token/internal", payload)
    token = result.get("tenant_access_token")
    if not token:
        raise RuntimeError(f"Feishu token response missing token: {result}")
    expires_in = max(to_int(result.get("expire"), 7200) - 300, 60)
    FEISHU_TOKEN_CACHE.update({"token": token, "expires_at": datetime.now() + timedelta(seconds=expires_in)})
    return str(token)


def reply_feishu_message(message_id: str, text: str) -> None:
    token = get_feishu_tenant_token()
    if not token or not message_id:
        return
    payload = {"msg_type": "text", "content": json.dumps({"text": text}, ensure_ascii=False)}
    feishu_http_json(f"/im/v1/messages/{message_id}/reply", payload, token=token)


def auth_username() -> str:
    return os.getenv("LIFEOS_WEB_USER", "Jeff")


def normalize_username(value: str) -> str:
    return value.strip().casefold()


def auth_password() -> str:
    return os.getenv("LIFEOS_WEB_PASSWORD", "")


def session_secret() -> str:
    return os.getenv("LIFEOS_SESSION_SECRET", "")


def altcha_hmac_key() -> str:
    return os.getenv("ALTCHA_HMAC_KEY", "") or session_secret()


def generate_altcha_challenge() -> dict[str, Any]:
    """Build a v2 challenge using the official altcha library. Returns the dict
    the v3 widget expects natively: {parameters: {...}, signature: ...}."""
    expires_at = int(datetime.now().timestamp()) + ALTCHA_CHALLENGE_TTL_SECONDS
    challenge = _altcha.create_challenge(
        algorithm=ALTCHA_ALGORITHM,
        cost=ALTCHA_COST,
        counter=secrets.randbelow(ALTCHA_COUNTER_MAX),
        expires_at=expires_at,
        hmac_secret=altcha_hmac_key(),
    )
    return challenge.to_dict()


def _record_altcha_failure(reason: str, ip: str = "") -> None:
    _last_altcha_failure["reason"] = reason
    _last_altcha_failure["at"] = datetime.now().isoformat()
    _last_altcha_failure["ip"] = ip
    _login_log.warning("altcha_verify reason=%s ip=%s", reason, ip)


def verify_altcha(payload_b64: str, ip: str = "") -> bool:
    """Verify the altcha payload submitted in the login form.

    Possible failure reasons recorded for /api/altcha/debug:
      payload_missing, payload_parse_error, expired, invalid_signature,
      invalid_solution, exception:<msg>
    """
    if not payload_b64:
        _record_altcha_failure("payload_missing", ip)
        return False
    try:
        result = _altcha.verify_solution(payload_b64, altcha_hmac_key())
    except Exception as exc:
        _record_altcha_failure(f"exception:{exc!s}", ip)
        return False
    if result.error:
        _record_altcha_failure(f"payload_parse_error:{result.error}", ip)
        return False
    if result.expired:
        _record_altcha_failure("expired", ip)
        return False
    if result.invalid_signature:
        _record_altcha_failure("invalid_signature", ip)
        return False
    if result.invalid_solution:
        _record_altcha_failure("invalid_solution", ip)
        return False
    if not result.verified:
        _record_altcha_failure("not_verified", ip)
        return False
    _login_log.info("altcha_verify ok ip=%s time_ms=%.1f", ip, result.time)
    return True


def ip_rate_limited(ip: str) -> bool:
    now = datetime.now()
    cutoff = now - timedelta(seconds=IP_RATE_WINDOW_SECONDS)
    times = [t for t in IP_RATE_TIMES.get(ip, []) if t > cutoff]
    IP_RATE_TIMES[ip] = times
    return len(times) >= IP_RATE_LIMIT


def record_ip_request(ip: str) -> None:
    IP_RATE_TIMES.setdefault(ip, []).append(datetime.now())


def account_locked(username: str) -> bool:
    until = ACCOUNT_LOCKOUT_UNTIL.get(username)
    if until is None:
        return False
    if datetime.now() < until:
        return True
    ACCOUNT_LOCKOUT_UNTIL.pop(username, None)
    ACCOUNT_CONSECUTIVE_FAILURES.pop(username, None)
    return False


def record_account_failure(username: str) -> None:
    count = ACCOUNT_CONSECUTIVE_FAILURES.get(username, 0) + 1
    ACCOUNT_CONSECUTIVE_FAILURES[username] = count
    _login_log.warning("login_failure username=%r consecutive=%d", username, count)
    if count >= ACCOUNT_LOCKOUT_LIMIT:
        until = datetime.now() + timedelta(seconds=ACCOUNT_LOCKOUT_SECONDS)
        ACCOUNT_LOCKOUT_UNTIL[username] = until
        _login_log.warning("account_lockout username=%r until=%s", username, until.isoformat())


def clear_account_failures(username: str) -> None:
    ACCOUNT_CONSECUTIVE_FAILURES.pop(username, None)
    ACCOUNT_LOCKOUT_UNTIL.pop(username, None)


def env_flag(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}


def cloud_mode() -> bool:
    return env_flag("LIFEOS_CLOUD_MODE") or env_flag("LIFEOS_REQUIRE_AUTH")


def validate_security_config() -> None:
    if not auth_enabled():
        if cloud_mode():
            raise RuntimeError("LIFEOS_WEB_PASSWORD is required when LIFEOS_CLOUD_MODE=1.")
        return

    if len(session_secret()) < MIN_SESSION_SECRET_LENGTH:
        raise RuntimeError(
            "LIFEOS_SESSION_SECRET must be set to an independent random value of at least "
            f"{MIN_SESSION_SECRET_LENGTH} characters."
        )
    # ALTCHA uses LIFEOS_SESSION_SECRET as its HMAC key by default; no extra env vars required.


def client_key(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip()
    return request.client.host if request.client else "unknown"


def too_many_login_failures(key: str) -> bool:
    now = datetime.now()
    cutoff = now - timedelta(seconds=LOGIN_FAILURE_WINDOW_SECONDS)
    failures = [item for item in LOGIN_FAILURES.get(key, []) if item > cutoff]
    LOGIN_FAILURES[key] = failures
    return len(failures) >= LOGIN_FAILURE_LIMIT


def record_login_failure(key: str) -> None:
    LOGIN_FAILURES.setdefault(key, []).append(datetime.now())


def clear_login_failures(key: str) -> None:
    LOGIN_FAILURES.pop(key, None)


def session_ttl_seconds() -> int:
    raw_seconds = os.getenv("LIFEOS_SESSION_TTL_SECONDS", "").strip()
    raw_hours = os.getenv("LIFEOS_SESSION_TTL_HOURS", "").strip()
    try:
        value = int(raw_seconds) if raw_seconds else int(float(raw_hours) * 3600) if raw_hours else DEFAULT_SESSION_TTL_SECONDS
    except ValueError:
        value = DEFAULT_SESSION_TTL_SECONDS
    return max(300, min(value, 60 * 60 * 24 * 30))


def session_ttl_label() -> str:
    seconds = session_ttl_seconds()
    if seconds % 86400 == 0:
        return f"{seconds // 86400} 天"
    if seconds % 3600 == 0:
        return f"{seconds // 3600} 小时"
    if seconds % 60 == 0:
        return f"{seconds // 60} 分钟"
    return f"{seconds} 秒"


def auth_enabled() -> bool:
    return bool(auth_password())


def sign_session(username: str, expires_at: int) -> str:
    message = f"{username}|{expires_at}"
    signature = hmac.new(session_secret().encode("utf-8"), message.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{message}|{signature}"


def valid_session(token: str | None) -> bool:
    if not token or not auth_enabled():
        return False
    parts = token.split("|")
    if len(parts) != 3:
        return False
    username, expires_at_text, signature = parts
    if normalize_username(username) != normalize_username(auth_username()):
        return False
    try:
        expires_at = int(expires_at_text)
    except ValueError:
        return False
    now_ts = int(datetime.now().timestamp())
    if expires_at < now_ts:
        return False
    if expires_at - now_ts > session_ttl_seconds() + 60:
        return False
    expected = sign_session(username, expires_at).rsplit("|", 1)[1]
    return hmac.compare_digest(signature, expected)


def is_public_path(path: str) -> bool:
    return path in {
        "/login", "/api/login", "/api/auth/config", "/api/auth/me", "/api/health",
        "/api/config",
        "/api/feishu/events", "/api/altcha", "/api/altcha/debug", "/altcha.min.js",
    } or path.startswith("/favicon")


def wants_html(request: Request) -> bool:
    accept = request.headers.get("accept", "")
    return "text/html" in accept or request.url.path in {"/", "/app", "/app.html"}


def add_security_headers(response: Response) -> None:
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "same-origin")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")


def _login_redirect(error_message: str = "") -> RedirectResponse:
    url = f"/login?error={quote(error_message)}" if error_message else "/login"
    return RedirectResponse(url=url, status_code=303)


def create_app() -> FastAPI:
    init_db()
    validate_security_config()
    app = FastAPI(
        title="LifeOS Local API",
        version="2.0.0",
        description="Local-first LifeOS dashboard API backed by SQLite and Markdown mirrors.",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://127.0.0.1:5173",
            "http://localhost:5173",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(Exception)
    async def _unhandled_exception(request: Request, exc: Exception) -> Response:
        # Last-resort handler so the login flow (and any other endpoint) never
        # returns an upstream-formatted "Internal Server Error" text page.
        # API callers get a structured JSON detail; HTML callers get redirected
        # back to /login with a friendly Chinese message instead of a 500 page.
        _login_log.exception("unhandled_exception path=%s err=%r", request.url.path, exc)
        path = request.url.path
        if path == "/api/login":
            return _login_redirect("登录暂时不可用，请稍后重试。")
        if path.startswith("/api/"):
            return JSONResponse({"ok": False, "detail": "服务器内部错误，请稍后重试。"}, status_code=500)
        if "text/html" in request.headers.get("accept", ""):
            return _login_redirect("服务暂时不可用，请稍后重试。")
        return JSONResponse({"ok": False, "detail": "服务器内部错误，请稍后重试。"}, status_code=500)

    @app.middleware("http")
    async def require_login(request: Request, call_next: Any) -> Response:
        if request.method == "OPTIONS" or is_public_path(request.url.path):
            response = await call_next(request)
            add_security_headers(response)
            return response
        if not auth_enabled():
            response = await call_next(request)
            add_security_headers(response)
            return response
        if valid_session(request.cookies.get(SESSION_COOKIE)):
            response = await call_next(request)
            add_security_headers(response)
            return response
        if wants_html(request):
            response = RedirectResponse(url="/login", status_code=303)
            add_security_headers(response)
            return response
        response = JSONResponse({"detail": "Not authenticated"}, status_code=401)
        add_security_headers(response)
        return response

    if (FRONTEND_DIST / "assets").exists():
        app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/login")
    def login() -> FileResponse:
        if FRONTEND_INDEX.exists():
            return FileResponse(FRONTEND_INDEX, headers={"Cache-Control": "no-store"})
        if LEGACY_APP_FILE.exists():
            return FileResponse(LEGACY_APP_FILE, headers={"Cache-Control": "no-store"})
        return FileResponse(ROOT / "index.html", headers={"Cache-Control": "no-store"})

    @app.get("/api/altcha")
    def altcha_challenge() -> Response:
        return JSONResponse(
            generate_altcha_challenge(),
            headers={
                "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            },
        )

    @app.get("/api/altcha/debug")
    def altcha_debug() -> dict[str, Any]:
        """Diagnostic endpoint — exposes config (no secrets), recent failure, server time.
        Only enabled when LIFEOS_ALTCHA_DEBUG=1 to avoid leaking metadata in production."""
        if not env_flag("LIFEOS_ALTCHA_DEBUG"):
            return {"ok": False, "detail": "debug disabled — set LIFEOS_ALTCHA_DEBUG=1"}
        return {
            "ok": True,
            "altcha_lib_version": getattr(_altcha, "__version__", "unknown"),
            "algorithm": ALTCHA_ALGORITHM,
            "cost": ALTCHA_COST,
            "counter_max": ALTCHA_COUNTER_MAX,
            "challenge_ttl_seconds": ALTCHA_CHALLENGE_TTL_SECONDS,
            "hmac_key_set": bool(altcha_hmac_key()),
            "hmac_key_source": "ALTCHA_HMAC_KEY" if os.getenv("ALTCHA_HMAC_KEY") else "LIFEOS_SESSION_SECRET",
            "cloud_mode": cloud_mode(),
            "server_time_iso": datetime.now().isoformat(),
            "server_time_unix": int(datetime.now().timestamp()),
            "last_failure": dict(_last_altcha_failure),
        }

    @app.get("/altcha.min.js")
    def altcha_widget_js() -> Response:
        candidates = [
            FRONTEND_DIST / "altcha.min.js",
            ROOT / "web" / "node_modules" / "altcha" / "dist" / "main" / "altcha.umd.min.cjs",
        ]
        for path in candidates:
            if path.exists():
                return FileResponse(str(path), media_type="application/javascript")
        return Response(status_code=404)

    @app.post("/api/login")
    async def post_login(request: Request) -> Response:
        # Every branch in this handler must return a 303 redirect — never a 500
        # plain page. We wrap the body in a try/except so even truly unexpected
        # exceptions are mapped to a friendly Chinese message on /login.
        try:
            ip = client_key(request)
            # Per-minute IP rate limit (5 req/min)
            if ip_rate_limited(ip):
                _login_log.warning("ip_rate_limited ip=%s", ip)
                return _login_redirect("请求频率过高，请稍后再试。")
            record_ip_request(ip)
            # 15-min IP lockout after repeated failures
            if too_many_login_failures(ip):
                return _login_redirect("登录失败次数过多，请稍后再试。")
            try:
                form = parse_qs((await request.body()).decode("utf-8", errors="ignore"), keep_blank_values=True)
            except Exception as exc:
                _login_log.exception("login_form_parse_failed ip=%s err=%r", ip, exc)
                return _login_redirect("登录请求格式错误，请重试。")
            username = str((form.get("username") or [""])[0]).strip()
            password = str((form.get("password") or [""])[0])
            altcha_payload = str((form.get("altcha") or [""])[0])
            if not username or not password:
                return _login_redirect("请输入账号和密码。")
            if not auth_enabled():
                return _login_redirect("登录未配置，请先设置 LIFEOS_WEB_PASSWORD。")
            if cloud_mode():
                if not altcha_payload:
                    return _login_redirect("人机验证未完成，请等待校验后重试。")
                if not verify_altcha(altcha_payload, ip=ip):
                    record_login_failure(ip)
                    return _login_redirect("人机验证失败，请刷新页面后重试。")
            norm_user = normalize_username(username)
            if account_locked(norm_user):
                _login_log.warning("account_locked username=%r ip=%s", norm_user, ip)
                return _login_redirect("账号已被临时锁定，请 10 分钟后重试。")
            username_matches = hmac.compare_digest(norm_user, normalize_username(auth_username()))
            password_matches = hmac.compare_digest(password, auth_password())
            if not (username_matches and password_matches):
                record_login_failure(ip)
                record_account_failure(norm_user)
                return _login_redirect("账号或密码不正确。")
            clear_login_failures(ip)
            clear_account_failures(norm_user)
            ttl_seconds = session_ttl_seconds()
            expires_at = int(datetime.now().timestamp()) + ttl_seconds
            try:
                signed = sign_session(username, expires_at)
            except Exception as exc:
                _login_log.exception("login_sign_session_failed ip=%s err=%r", ip, exc)
                return _login_redirect("会话创建失败，请稍后重试。")
            response = RedirectResponse(url="/app", status_code=303)
            secure_cookie = request.headers.get("x-forwarded-proto", request.url.scheme).lower() == "https"
            response.set_cookie(
                SESSION_COOKIE,
                signed,
                max_age=ttl_seconds,
                httponly=True,
                secure=secure_cookie,
                samesite="lax",
            )
            return response
        except Exception as exc:
            # Defense-in-depth: never let a real 500 surface to the login UX.
            _login_log.exception("login_unhandled_exception err=%r", exc)
            return _login_redirect("登录暂时不可用，请稍后重试。")

    @app.post("/api/logout")
    def post_logout() -> Response:
        response = RedirectResponse(url="/login", status_code=303)
        response.delete_cookie(SESSION_COOKIE)
        return response

    @app.get("/api/auth/config")
    def auth_config() -> dict[str, Any]:
        return {
            "ok": True,
            "authEnabled": auth_enabled(),
            "altchaEnabled": cloud_mode(),
            "sessionTtlLabel": session_ttl_label(),
        }

    @app.get("/api/auth/me")
    def auth_me(request: Request) -> dict[str, Any]:
        """Lightweight auth probe consumed by the SPA before rendering protected
        pages. Always 200; the SPA inspects `authenticated` to decide whether to
        boot the app or redirect to /login. Keeping it public (registered in
        is_public_path) means the browser never gets a 401 here, so we sidestep
        any flash of protected UI."""
        if not auth_enabled():
            return {"ok": True, "authenticated": True, "authRequired": False}
        is_auth = valid_session(request.cookies.get(SESSION_COOKIE))
        return {"ok": True, "authenticated": bool(is_auth), "authRequired": True}

    @app.get("/api/health")
    def health() -> dict[str, Any]:
        return {
            "ok": True,
            "service": BRAND_NAME,
            "code_name": INTERNAL_NAME,
            "time": now_iso(),
        }

    @app.get("/api/config")
    def public_config() -> dict[str, Any]:
        """Public brand + product config consumed by the SPA so user-facing
        strings (top nav, login page, page titles, More page) render from one
        source instead of being hardcoded in .tsx files."""
        return {
            "ok": True,
            "brandName": BRAND_NAME,
            "codeName": INTERNAL_NAME,
            "tagline": PRODUCT_TAGLINE,
        }

    @app.get("/favicon.ico")
    def favicon() -> Response:
        return Response(status_code=204)

    @app.get("/api/bootstrap")
    def bootstrap(date_value: str | None = Query(default=None, alias="date")) -> dict[str, Any]:
        return load_bootstrap(parse_date(date_value))

    @app.get("/api/docs")
    def docs_index() -> dict[str, Any]:
        return {"docs": list_docs()}

    @app.get("/api/docs/{doc_id}")
    def docs_detail(doc_id: str) -> dict[str, Any]:
        return get_doc_payload(doc_id)

    @app.get("/api/current-state")
    def current_state() -> dict[str, Any]:
        return current_state_payload()

    @app.get("/api/export")
    def export_day(date_value: str | None = Query(default=None, alias="date")) -> dict[str, Any]:
        day = parse_date(date_value)
        with connect() as conn:
            path = write_daily_markdown(conn, day)
            schema_path = write_daily_health_log(conn, day, source="web")
            conn.commit()
        return {
            "ok": True,
            "markdownPath": str(path.relative_to(ROOT)),
            "schemaMarkdownPath": str(schema_path.relative_to(ROOT)),
        }

    @app.post("/api/day")
    def post_day(payload: SaveDayPayload) -> dict[str, Any]:
        try:
            return {"ok": True, **save_day(payload)}
        except Exception as exc:  # noqa: BLE001 - local tool should return actionable failures.
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @app.post("/api/trigger-summary")
    def trigger_summary() -> dict[str, Any]:
        try:
            return run_summary_workflow()
        except Exception as exc:  # noqa: BLE001 - API should expose workflow failure detail.
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @app.post("/api/feishu/events")
    def feishu_events(payload: FeishuEventPayload) -> dict[str, Any]:
        verification_token = os.getenv("FEISHU_VERIFICATION_TOKEN")
        if not verification_token and cloud_mode():
            raise HTTPException(status_code=503, detail="FEISHU_VERIFICATION_TOKEN is not configured")
        event = payload.event or {}
        header = payload.header or {}
        request_token = payload.token or event.get("token") or header.get("token")
        if verification_token and request_token != verification_token:
            raise HTTPException(status_code=403, detail="Invalid Feishu verification token")

        challenge = payload.challenge or event.get("challenge")
        if challenge:
            return {"challenge": str(challenge)}

        message = event.get("message") or {}
        message_id = str(message.get("message_id") or "")
        message_type = str(message.get("message_type") or "")
        if message_type and message_type != "text":
            reply_feishu_message(message_id, "当前只支持文本录入。")
            return {"ok": True, "ignored": "unsupported_message_type"}

        text = parse_feishu_message_text(event)
        if not text:
            return {"ok": True, "ignored": "empty_message"}

        try:
            if is_summary_command(text):
                result = run_summary_workflow()
                warnings = result.get("warnings") or []
                reply = "周报已生成，current-state 已更新。"
                if warnings:
                    reply += "\n风控预警：" + "、".join(str(item) for item in warnings)
                reply_feishu_message(message_id, reply)
                return {"ok": True, "summaryTriggered": True, "warnings": warnings}

            result = append_feishu_entry(text)
            reply = f"已录入 {result['day']}：{result['note']}"
            if result["fields"]:
                labels = [FIELD_LABELS.get(field, field) for field in result["fields"]]
                reply += f"\n识别字段：{', '.join(labels)}"
            reply_feishu_message(message_id, reply)
            return {"ok": True, "day": result["day"], "fields": result["fields"]}
        except Exception as exc:  # noqa: BLE001 - webhook should return a readable failure.
            reply_feishu_message(message_id, f"录入失败：{exc}")
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    # ── AI 配置与分析接口 ────────────────────────────────────────────

    # 支持的模型预设（前端展示用）
    AI_MODELS = [
        {"id": "Pro/deepseek-ai/DeepSeek-V3.2",  "name": "DeepSeek V3.2 Pro",  "provider": "siliconflow"},
        {"id": "deepseek-ai/DeepSeek-V3",         "name": "DeepSeek V3 (免费)", "provider": "siliconflow"},
        {"id": "Pro/deepseek-ai/DeepSeek-R1",     "name": "DeepSeek R1 Pro（推理）", "provider": "siliconflow"},
        {"id": "Qwen/Qwen3.5-72B",                "name": "Qwen3.5 72B",        "provider": "siliconflow"},
        {"id": "gpt-4o",                           "name": "GPT-4o",             "provider": "openai"},
        {"id": "gpt-4o-mini",                      "name": "GPT-4o Mini",        "provider": "openai"},
        {"id": "o3-mini",                          "name": "OpenAI o3-mini",     "provider": "openai"},
    ]

    PROVIDER_CONFIG = {
        "siliconflow": {"base_url": "https://api.siliconflow.cn/v1",  "env_key": "SILICONFLOW_API_KEY"},
        "openai":      {"base_url": "https://api.openai.com/v1",      "env_key": "OPENAI_API_KEY"},
    }

    def resolve_model(model_id: str) -> dict[str, Any]:
        for m in AI_MODELS:
            if m["id"] == model_id:
                return m
        # 默认 siliconflow
        return {"id": model_id, "provider": "siliconflow"}

    @app.get("/api/ai/models")
    def ai_models() -> dict[str, Any]:
        return {"ok": True, "models": AI_MODELS}

    # ── API Key 探测（验证 key 并列出可用模型）────────────────────────
    class ProbeKeyPayload(BaseModel):
        model_config = ConfigDict(extra="ignore")
        provider: str = "openai"          # openai | siliconflow | custom
        api_key: str
        base_url: str | None = None       # custom provider 专用

    @app.post("/api/ai/probe-key")
    async def probe_key(payload: Annotated[ProbeKeyPayload, Body()]) -> dict[str, Any]:
        if not _HTTPX_AVAILABLE:
            raise HTTPException(status_code=503, detail="httpx 未安装")
        cfg2 = PROVIDER_CONFIG.get(payload.provider, {})
        base = payload.base_url or cfg2.get("base_url")
        if not base:
            raise HTTPException(status_code=400, detail="缺少 base_url")
        try:
            async with _httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    f"{base}/models",
                    headers={"Authorization": f"Bearer {payload.api_key}"},
                )
                resp.raise_for_status()
                data = resp.json()
        except _httpx.HTTPStatusError as exc:
            raise HTTPException(status_code=502, detail=f"API 返回错误：{exc.response.text[:300]}") from exc
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"请求失败：{exc}") from exc

        raw = data.get("data", [])
        # OpenAI 有 100+ 模型，过滤出聊天相关的
        if payload.provider == "openai":
            CHAT_PREFIXES = ("gpt-4", "gpt-3.5", "o1", "o3", "o4")
            EXCLUDE       = ("instruct", "vision", "tts", "dall", "whisper",
                             "embedding", "search", "realtime", "preview-0")
            raw = [
                m for m in raw
                if any(m.get("id","").startswith(p) for p in CHAT_PREFIXES)
                and not any(x in m.get("id","") for x in EXCLUDE)
            ]
        models_out = sorted(
            [{"id": m["id"], "name": m["id"]} for m in raw],
            key=lambda x: x["id"], reverse=True,
        )
        return {"ok": True, "models": models_out, "total": len(models_out)}

    class AiAnalyzePayload(BaseModel):
        model_config = ConfigDict(extra="ignore")
        prompt: str
        date: str | None = None
        model: str = "Pro/deepseek-ai/DeepSeek-V3.2"
        api_key_override: str | None = None  # 前端传来的 key（优先于环境变量）
        base_url_override: str | None = None  # custom provider 时传入
        write_to_md: bool = False
        md_confirmed: bool = False

    @app.post("/api/ai-analyze")
    async def ai_analyze(payload: Annotated[AiAnalyzePayload, Body()]) -> dict[str, Any]:
        if not _HTTPX_AVAILABLE:
            raise HTTPException(status_code=503, detail="httpx 未安装")

        # 根据模型选择 provider 和 API key
        model_info = resolve_model(payload.model)
        provider   = model_info.get("provider", "siliconflow")
        cfg        = PROVIDER_CONFIG.get(provider, PROVIDER_CONFIG["siliconflow"])
        api_key    = payload.api_key_override or os.getenv(cfg["env_key"], "")
        base_url   = payload.base_url_override or cfg["base_url"]
        if not api_key:
            raise HTTPException(status_code=503, detail=f"{cfg['env_key']} 未配置，或请从前端传入 api_key_override")

        day = payload.date or today_text()

        # 拉取当日数据
        context_data: dict[str, Any] = {}
        try:
            with connect() as conn:
                entry = fetch_day(conn, day)
                context_data = {
                    "日期": day,
                    "简历投递": entry.get("job_applications", 0),
                    "面试沟通": entry.get("interviews", 0),
                    "英语学习(分钟)": entry.get("english_minutes", 0),
                    "运动训练(分钟)": entry.get("exercise_minutes", 0),
                    "睡眠(小时)": entry.get("sleep_hours", 0),
                    "体重(kg)": entry.get("weight_kg", 0),
                    "心情(1-10)": entry.get("mood", 0),
                    "精力(1-10)": entry.get("energy", 0),
                    "支出(元)": entry.get("expense", 0),
                    "收入(元)": entry.get("income", 0),
                    "早餐": entry.get("breakfast", ""),
                    "午餐": entry.get("lunch", ""),
                    "晚餐": entry.get("dinner", ""),
                    "今日笔记": entry.get("notes", ""),
                }
        except Exception:
            pass

        system_prompt = (
            "你是用户的个人成长 AI 助手。用户用 LifeOS 追踪求职、健康、学习、财务数据。"
            "根据数据给出结构化分析：今日亮点、需改进点、明日建议三部分，用中文，500字以内。"
        )
        user_message = f"数据（{day}）：\n{json.dumps(context_data, ensure_ascii=False, indent=2)}\n\n{payload.prompt}"

        try:
            async with _httpx.AsyncClient(timeout=90.0) as client:
                resp = await client.post(
                    f"{base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={
                        "model": payload.model,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user",   "content": user_message},
                        ],
                        "max_tokens": 1500,
                        "temperature": 0.7,
                        "stream": False,
                    },
                )
                resp.raise_for_status()
                reply = resp.json()["choices"][0]["message"]["content"]
        except _httpx.HTTPStatusError as exc:
            raise HTTPException(status_code=502, detail=f"AI API 错误：{exc.response.text}") from exc
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"AI 请求失败：{exc}") from exc

        # 若前端已确认，将生成内容追加写入每日 MD 文件
        written_path: str | None = None
        if payload.write_to_md and payload.md_confirmed:
            try:
                md_dir = ROOT / "02_每日记录"
                md_dir.mkdir(exist_ok=True)
                md_path = md_dir / f"{day}-AI总结.md"
                ts = datetime.now().strftime("%Y-%m-%d %H:%M")
                block = f"\n\n## AI 分析（{ts}，模型：{payload.model}）\n\n{reply}\n"
                with open(md_path, "a", encoding="utf-8") as f:
                    f.write(block)
                written_path = str(md_path.relative_to(ROOT))
            except Exception as exc:
                written_path = f"写入失败：{exc}"

        return {
            "ok": True,
            "reply": reply,
            "model": payload.model,
            "provider": provider,
            "date": day,
            "context": context_data,
            "writtenTo": written_path,
        }

    @app.get("/")
    @app.get("/app")
    @app.get("/app.html")
    @app.get("/profile")
    @app.get("/plan-90")
    @app.get("/files")
    @app.get("/library")
    @app.get("/daily")
    @app.get("/ai")
    @app.get("/more")
    def app_shell() -> FileResponse:
        if FRONTEND_INDEX.exists():
            return FileResponse(FRONTEND_INDEX, headers={"Cache-Control": "no-store"})
        if LEGACY_APP_FILE.exists():
            return FileResponse(LEGACY_APP_FILE, headers={"Cache-Control": "no-store"})
        return FileResponse(ROOT / "index.html", headers={"Cache-Control": "no-store"})

    return app


app = create_app()


def run(host: str, port: int, reload: bool = False) -> None:
    print(f"LifeOS FastAPI 服务已启动：http://{host}:{port}/app")
    print("API 文档：http://127.0.0.1:8765/docs")
    uvicorn.run("lifeos_server:app", host=host, port=port, reload=reload)


def main() -> None:
    parser = argparse.ArgumentParser(description="LifeOS FastAPI 本地数据库与网页打卡服务")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8765, type=int)
    parser.add_argument("--reload", action="store_true")
    args = parser.parse_args()
    run(args.host, args.port, args.reload)


if __name__ == "__main__":
    main()
