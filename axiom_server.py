from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import sqlite3
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Annotated, Any
from urllib.parse import parse_qs, quote

try:
    import httpx as _httpx
    _HTTPX_AVAILABLE = True
except ImportError:
    _HTTPX_AVAILABLE = False

import uvicorn
from fastapi import Body, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field

import altcha as _altcha


BRAND_NAME = "Axiom Core"
PRODUCT_TAGLINE = "Personal Decision Intelligence"

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
DB_PATH = DATA_DIR / "axiom_core.db"
FRONTEND_DIST = ROOT / "web" / "dist"
FRONTEND_INDEX = FRONTEND_DIST / "index.html"
SPA_NOT_BUILT = (
    "<!doctype html><meta charset='utf-8'><title>Axiom Core</title>"
    "<pre style='font:13px ui-monospace,monospace;padding:24px;color:#e0525e;'>"
    "Frontend bundle missing.\n\n"
    "Run `cd web && npm ci && npm run build` then restart axiom-core.</pre>"
)
DOC_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")


SESSION_COOKIE = "axiom_session"
DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 8
MIN_SESSION_SECRET_LENGTH = 32

LOGIN_FAILURE_WINDOW_SECONDS = 15 * 60
LOGIN_FAILURE_LIMIT = 8
LOGIN_FAILURES: dict[str, list[datetime]] = {}

IP_RATE_WINDOW_SECONDS = 60
IP_RATE_LIMIT = 5
IP_RATE_TIMES: dict[str, list[datetime]] = {}

ACCOUNT_LOCKOUT_LIMIT = 5
ACCOUNT_LOCKOUT_SECONDS = 600
ACCOUNT_CONSECUTIVE_FAILURES: dict[str, int] = {}
ACCOUNT_LOCKOUT_UNTIL: dict[str, datetime] = {}

ALTCHA_COUNTER_MAX = 50_000
ALTCHA_CHALLENGE_TTL_SECONDS = 300
ALTCHA_ALGORITHM = "SHA-256"
ALTCHA_COST = 1

_login_log = logging.getLogger("axiom.login")
_last_altcha_failure: dict[str, Any] = {"reason": None, "at": None, "ip": None}


# ─── Business sandbox configuration ────────────────────────────────
# The "floor" is the absolute net-position danger line. We don't track time-
# till-zero (the operator is already in debt). We track time-till-floor: at
# the current monthly burn, how many months before the position crosses this
# absolute cap. Configured via env so the operator can tune the threshold
# without redeploying schema.
def floor_position() -> float:
    try:
        return float(os.getenv("AXIOM_CAPITAL_FLOOR", "-100000"))
    except ValueError:
        return -100000.0


# ─── Document vault ─────────────────────────────────────────────────
DOC_SPECS = [
    {"id": "product-vision",    "title": "Product Vision",     "section": "Axiom Core", "summary": "What Axiom Core solves; what it explicitly does not do.", "relative_path": Path("docs") / "product-vision.md"},
    {"id": "decision-engine",   "title": "Decision Engine",    "section": "Axiom Core", "summary": "Capital, ROI and hard-veto rules that gate every commit.", "relative_path": Path("docs") / "decision-engine.md"},
    {"id": "ai-agent",          "title": "AI Agent Charter",   "section": "Axiom Core", "summary": "The CDO persona, observable inputs, hard boundaries.", "relative_path": Path("docs") / "ai-agent.md"},
    {"id": "roadmap",           "title": "Roadmap",            "section": "Axiom Core", "summary": "Near-term, quarterly and annual evolution path.", "relative_path": Path("docs") / "roadmap.md"},
    {"id": "architecture",      "title": "System Architecture", "section": "System",    "summary": "Front/back tiers, local + cloud topology, data flow.", "relative_path": Path("docs") / "architecture.md"},
    {"id": "data-flow",         "title": "Data Flow",          "section": "System",    "summary": "How records propagate between local, cloud, and disk artifacts.", "relative_path": Path("docs") / "data-flow.md"},
    {"id": "data-model",        "title": "Data Model",         "section": "System",    "summary": "SQLite schema and JSON Schema alignment.", "relative_path": Path("docs") / "data-model.md"},
    {"id": "security",          "title": "Security & Privacy", "section": "Ops",       "summary": "Sensitive-data rules for the public repo + credentials handling.", "relative_path": Path("docs") / "security.md"},
    {"id": "deployment",        "title": "Deployment",         "section": "Ops",       "summary": "Operator-facing deploy flow + rollback playbook.", "relative_path": Path("docs") / "deployment.md"},
    {"id": "operations",        "title": "Day-to-day Ops",     "section": "Ops",       "summary": "Local services, scheduled jobs, log paths, troubleshooting.", "relative_path": Path("docs") / "operations.md"},
]


# ─── Pydantic models ────────────────────────────────────────────────
class BaselineIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    starting_position: float
    baseline_date: str | None = None
    note: str | None = ""


class CapitalTxIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    kind: str  # 'income' | 'expense'
    amount: float
    occurred_at: str | None = None  # ISO date
    note: str | None = ""
    category: str | None = ""
    project_id: str | None = None


class ProjectIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    status: str = "active"  # active | paused | killed | shipped
    thesis: str | None = ""
    roi_projection: float | None = 0
    risk_level: str = "medium"  # low | medium | high | extreme
    kill_criteria: str | None = ""
    capital_committed: float | None = 0
    capital_spent: float | None = 0


class ProjectPatch(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str | None = None
    status: str | None = None
    thesis: str | None = None
    roi_projection: float | None = None
    risk_level: str | None = None
    kill_criteria: str | None = None
    capital_committed: float | None = None
    capital_spent: float | None = None


class DecisionIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    context: str
    options: list[str] | None = Field(default_factory=list)
    choice: str | None = ""
    rationale: str | None = ""
    expected_outcome: str | None = ""
    status: str = "open"  # open | committed | reviewed
    decided_at: str | None = None


class DecisionPatch(BaseModel):
    model_config = ConfigDict(extra="ignore")
    context: str | None = None
    options: list[str] | None = None
    choice: str | None = None
    rationale: str | None = None
    expected_outcome: str | None = None
    status: str | None = None
    reviewed_outcome: str | None = None
    reviewed_at: str | None = None


# ─── Utilities ──────────────────────────────────────────────────────
def now_iso() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def today_iso() -> str:
    return datetime.now().strftime("%Y-%m-%d")


def gen_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def to_float(value: Any, default: float = 0.0) -> float:
    if value in (None, ""):
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


# ─── Database ───────────────────────────────────────────────────────
def connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def init_db() -> None:
    """Initialize the business-sandbox schema. Idempotent.

    Schema:
      - capital_baseline: single-row anchor (id=1) holding the starting net
        position and the baseline date. Default: -50,000 CNY on first run.
      - capital_tx: every income or expense entry the operator records.
      - projects: the active commercial sandbox — name, thesis, risk, ROI.
      - decisions: structured decision audit log (context/rationale/outcome).
    """
    with connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS capital_baseline (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                starting_position REAL NOT NULL,
                baseline_date TEXT NOT NULL,
                note TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS capital_tx (
                id TEXT PRIMARY KEY,
                kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
                amount REAL NOT NULL,
                occurred_at TEXT NOT NULL,
                note TEXT NOT NULL DEFAULT '',
                category TEXT NOT NULL DEFAULT '',
                project_id TEXT,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_capital_tx_date ON capital_tx(occurred_at);
            CREATE INDEX IF NOT EXISTS idx_capital_tx_project ON capital_tx(project_id);

            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'active',
                thesis TEXT NOT NULL DEFAULT '',
                roi_projection REAL NOT NULL DEFAULT 0,
                risk_level TEXT NOT NULL DEFAULT 'medium',
                kill_criteria TEXT NOT NULL DEFAULT '',
                capital_committed REAL NOT NULL DEFAULT 0,
                capital_spent REAL NOT NULL DEFAULT 0,
                started_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS decisions (
                id TEXT PRIMARY KEY,
                context TEXT NOT NULL,
                options TEXT NOT NULL DEFAULT '[]',
                choice TEXT NOT NULL DEFAULT '',
                rationale TEXT NOT NULL DEFAULT '',
                expected_outcome TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'open',
                reviewed_outcome TEXT NOT NULL DEFAULT '',
                decided_at TEXT,
                reviewed_at TEXT,
                created_at TEXT NOT NULL
            );
            """
        )

        # First-run baseline: operator is 50,000 CNY in debt.
        row = conn.execute("SELECT 1 FROM capital_baseline WHERE id = 1").fetchone()
        if row is None:
            conn.execute(
                "INSERT INTO capital_baseline (id, starting_position, baseline_date, note, updated_at) VALUES (1, ?, ?, ?, ?)",
                (-50000.0, today_iso(), "Initial debt baseline", now_iso()),
            )
        conn.commit()


def baseline_row(conn: sqlite3.Connection) -> dict[str, Any]:
    row = conn.execute("SELECT starting_position, baseline_date, note, updated_at FROM capital_baseline WHERE id = 1").fetchone()
    if row is None:
        return {"starting_position": -50000.0, "baseline_date": today_iso(), "note": "", "updated_at": now_iso()}
    return dict(row)


def update_baseline(payload: BaselineIn) -> dict[str, Any]:
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO capital_baseline (id, starting_position, baseline_date, note, updated_at)
            VALUES (1, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                starting_position = excluded.starting_position,
                baseline_date = excluded.baseline_date,
                note = excluded.note,
                updated_at = excluded.updated_at
            """,
            (
                float(payload.starting_position),
                payload.baseline_date or today_iso(),
                (payload.note or "").strip(),
                now_iso(),
            ),
        )
        conn.commit()
        return baseline_row(conn)


def list_capital_tx(limit: int = 200) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM capital_tx ORDER BY occurred_at DESC, created_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]


def insert_capital_tx(payload: CapitalTxIn) -> dict[str, Any]:
    if payload.kind not in {"income", "expense"}:
        raise HTTPException(status_code=400, detail="kind must be 'income' or 'expense'")
    amount = abs(float(payload.amount))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="amount must be positive")
    occurred_at = (payload.occurred_at or today_iso()).strip()
    if not re.match(r"^\d{4}-\d{2}-\d{2}", occurred_at):
        occurred_at = today_iso()
    tx_id = gen_id("tx")
    created_at = now_iso()
    with connect() as conn:
        conn.execute(
            "INSERT INTO capital_tx (id, kind, amount, occurred_at, note, category, project_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                tx_id,
                payload.kind,
                amount,
                occurred_at,
                (payload.note or "").strip(),
                (payload.category or "").strip(),
                payload.project_id,
                created_at,
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM capital_tx WHERE id = ?", (tx_id,)).fetchone()
        return dict(row)


def delete_capital_tx(tx_id: str) -> None:
    with connect() as conn:
        cursor = conn.execute("DELETE FROM capital_tx WHERE id = ?", (tx_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Transaction not found")
        conn.commit()


def list_projects() -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM projects ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 WHEN 'shipped' THEN 2 ELSE 3 END, updated_at DESC",
        ).fetchall()
        return [dict(r) for r in rows]


def insert_project(payload: ProjectIn) -> dict[str, Any]:
    if payload.status not in {"active", "paused", "killed", "shipped"}:
        raise HTTPException(status_code=400, detail="invalid status")
    if payload.risk_level not in {"low", "medium", "high", "extreme"}:
        raise HTTPException(status_code=400, detail="invalid risk_level")
    pid = gen_id("prj")
    ts = now_iso()
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO projects (id, name, status, thesis, roi_projection, risk_level, kill_criteria, capital_committed, capital_spent, started_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                pid,
                payload.name.strip(),
                payload.status,
                (payload.thesis or "").strip(),
                to_float(payload.roi_projection),
                payload.risk_level,
                (payload.kill_criteria or "").strip(),
                to_float(payload.capital_committed),
                to_float(payload.capital_spent),
                ts,
                ts,
            ),
        )
        conn.commit()
        return dict(conn.execute("SELECT * FROM projects WHERE id = ?", (pid,)).fetchone())


def update_project(project_id: str, patch: ProjectPatch) -> dict[str, Any]:
    fields = patch.model_dump(exclude_unset=True)
    if "status" in fields and fields["status"] not in {"active", "paused", "killed", "shipped"}:
        raise HTTPException(status_code=400, detail="invalid status")
    if "risk_level" in fields and fields["risk_level"] not in {"low", "medium", "high", "extreme"}:
        raise HTTPException(status_code=400, detail="invalid risk_level")
    if not fields:
        with connect() as conn:
            row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Project not found")
            return dict(row)
    sets = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [now_iso(), project_id]
    with connect() as conn:
        cursor = conn.execute(f"UPDATE projects SET {sets}, updated_at = ? WHERE id = ?", values)
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Project not found")
        conn.commit()
        return dict(conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone())


def delete_project(project_id: str) -> None:
    with connect() as conn:
        cursor = conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Project not found")
        conn.commit()


def list_decisions(limit: int = 200) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM decisions ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'committed' THEN 1 ELSE 2 END, created_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [_decision_row(r) for r in rows]


def _decision_row(row: sqlite3.Row) -> dict[str, Any]:
    d = dict(row)
    try:
        d["options"] = json.loads(d.get("options") or "[]")
    except json.JSONDecodeError:
        d["options"] = []
    return d


def insert_decision(payload: DecisionIn) -> dict[str, Any]:
    if payload.status not in {"open", "committed", "reviewed"}:
        raise HTTPException(status_code=400, detail="invalid status")
    did = gen_id("dec")
    ts = now_iso()
    options_json = json.dumps([str(o).strip() for o in (payload.options or []) if str(o).strip()], ensure_ascii=False)
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO decisions (id, context, options, choice, rationale, expected_outcome, status, decided_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                did,
                payload.context.strip(),
                options_json,
                (payload.choice or "").strip(),
                (payload.rationale or "").strip(),
                (payload.expected_outcome or "").strip(),
                payload.status,
                (payload.decided_at or "").strip() or None,
                ts,
            ),
        )
        conn.commit()
        return _decision_row(conn.execute("SELECT * FROM decisions WHERE id = ?", (did,)).fetchone())


def update_decision(decision_id: str, patch: DecisionPatch) -> dict[str, Any]:
    fields = patch.model_dump(exclude_unset=True)
    if "status" in fields and fields["status"] not in {"open", "committed", "reviewed"}:
        raise HTTPException(status_code=400, detail="invalid status")
    if "options" in fields and fields["options"] is not None:
        fields["options"] = json.dumps([str(o).strip() for o in fields["options"] if str(o).strip()], ensure_ascii=False)
    if not fields:
        with connect() as conn:
            row = conn.execute("SELECT * FROM decisions WHERE id = ?", (decision_id,)).fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Decision not found")
            return _decision_row(row)
    sets = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [decision_id]
    with connect() as conn:
        cursor = conn.execute(f"UPDATE decisions SET {sets} WHERE id = ?", values)
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Decision not found")
        conn.commit()
        return _decision_row(conn.execute("SELECT * FROM decisions WHERE id = ?", (decision_id,)).fetchone())


def delete_decision(decision_id: str) -> None:
    with connect() as conn:
        cursor = conn.execute("DELETE FROM decisions WHERE id = ?", (decision_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Decision not found")
        conn.commit()


def dashboard_snapshot() -> dict[str, Any]:
    """Compute the command-deck snapshot from the new schema.

    Net position: baseline + sum(income) - sum(expense).
    Monthly numbers: 30-day rolling income / expense / net.
    Runway: months from current net to floor at the current monthly burn.
       - cash-flow positive (monthly_net >= 0) → runway = None (∞).
       - cash-flow negative → (net - floor) / |monthly_net|.
    """
    with connect() as conn:
        baseline = baseline_row(conn)
        totals = conn.execute(
            """
            SELECT
              COALESCE(SUM(CASE WHEN kind='income'  THEN amount ELSE 0 END), 0) AS total_in,
              COALESCE(SUM(CASE WHEN kind='expense' THEN amount ELSE 0 END), 0) AS total_out
            FROM capital_tx
            """
        ).fetchone()
        net_position = baseline["starting_position"] + (totals["total_in"] or 0) - (totals["total_out"] or 0)

        today = datetime.now().date()
        d_start_30 = (today - timedelta(days=29)).isoformat()
        m_totals = conn.execute(
            """
            SELECT
              COALESCE(SUM(CASE WHEN kind='income'  THEN amount ELSE 0 END), 0) AS m_in,
              COALESCE(SUM(CASE WHEN kind='expense' THEN amount ELSE 0 END), 0) AS m_out
            FROM capital_tx
            WHERE occurred_at >= ?
            """,
            (d_start_30,),
        ).fetchone()
        monthly_in = float(m_totals["m_in"] or 0)
        monthly_out = float(m_totals["m_out"] or 0)
        monthly_net = monthly_in - monthly_out

        floor = floor_position()
        if monthly_net >= 0:
            runway_months: float | None = None
        else:
            distance = net_position - floor
            burn = abs(monthly_net)
            runway_months = max(0.0, round(distance / burn, 2)) if burn > 0 else None

        projects = list_projects()
        active_projects = [p for p in projects if p["status"] == "active"]
        decisions = list_decisions(limit=50)
        open_decisions = [d for d in decisions if d["status"] == "open"]

        recent_tx = [dict(r) for r in conn.execute(
            "SELECT * FROM capital_tx ORDER BY occurred_at DESC, created_at DESC LIMIT 8"
        ).fetchall()]

        # Timeline: 30-day running net position
        rows = conn.execute(
            """
            SELECT occurred_at, kind, amount FROM capital_tx
            WHERE occurred_at >= ?
            ORDER BY occurred_at ASC, created_at ASC
            """,
            (d_start_30,),
        ).fetchall()
        # Running net starts from net_position - (sum of last-30d transactions),
        # then adds each transaction forward.
        thirty_day_in = sum(r["amount"] for r in rows if r["kind"] == "income")
        thirty_day_out = sum(r["amount"] for r in rows if r["kind"] == "expense")
        running = net_position - (thirty_day_in - thirty_day_out)
        timeline: list[dict[str, Any]] = []
        for offset in range(30):
            day = (today - timedelta(days=29 - offset)).isoformat()
            day_in = sum(r["amount"] for r in rows if r["kind"] == "income" and r["occurred_at"][:10] == day)
            day_out = sum(r["amount"] for r in rows if r["kind"] == "expense" and r["occurred_at"][:10] == day)
            running += day_in - day_out
            timeline.append({"date": day, "in": round(day_in, 2), "out": round(day_out, 2), "net": round(running, 2)})

        return {
            "ok": True,
            "baseline": {
                "starting_position": float(baseline["starting_position"]),
                "baseline_date": baseline["baseline_date"],
                "note": baseline["note"],
            },
            "capital": {
                "net_position": round(net_position, 2),
                "total_in": round(float(totals["total_in"] or 0), 2),
                "total_out": round(float(totals["total_out"] or 0), 2),
                "monthly_in": round(monthly_in, 2),
                "monthly_out": round(monthly_out, 2),
                "monthly_net": round(monthly_net, 2),
                "floor": floor,
                "runway_months": runway_months,
            },
            "projects": {
                "active": active_projects,
                "all_count": len(projects),
                "active_count": len(active_projects),
            },
            "decisions": {
                "open": open_decisions,
                "all_count": len(decisions),
                "open_count": len(open_decisions),
            },
            "recent_tx": recent_tx,
            "timeline": timeline,
        }


# ─── Docs (vault) ───────────────────────────────────────────────────
def read_markdown_file(path: Path) -> str:
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Document not found")
    return path.read_text(encoding="utf-8", errors="replace")


def doc_updated_at(path: Path) -> str | None:
    if not path.exists():
        return None
    return datetime.fromtimestamp(path.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S")


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


def docs_registry() -> dict[str, dict[str, Any]]:
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
            "sensitive": False,
            "kind": "markdown",
            "path": doc_path,
        }
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


# ─── Auth + ALTCHA (preserved verbatim from Phase 5) ────────────────
def auth_username() -> str:
    return os.getenv("AXIOM_WEB_USER", "Jeff")


def normalize_username(value: str) -> str:
    return value.strip().casefold()


def auth_password() -> str:
    return os.getenv("AXIOM_WEB_PASSWORD", "")


def session_secret() -> str:
    return os.getenv("AXIOM_SESSION_SECRET", "")


def altcha_hmac_key() -> str:
    return os.getenv("ALTCHA_HMAC_KEY", "") or session_secret()


def generate_altcha_challenge() -> dict[str, Any]:
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
    return env_flag("AXIOM_CLOUD_MODE") or env_flag("AXIOM_REQUIRE_AUTH")


def validate_security_config() -> None:
    if not auth_enabled():
        if cloud_mode():
            raise RuntimeError("AXIOM_WEB_PASSWORD is required when AXIOM_CLOUD_MODE=1.")
        return
    if len(session_secret()) < MIN_SESSION_SECRET_LENGTH:
        raise RuntimeError(
            f"AXIOM_SESSION_SECRET must be at least {MIN_SESSION_SECRET_LENGTH} characters."
        )


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
    raw_seconds = os.getenv("AXIOM_SESSION_TTL_SECONDS", "").strip()
    raw_hours = os.getenv("AXIOM_SESSION_TTL_HOURS", "").strip()
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
        "/api/altcha", "/api/altcha/debug", "/altcha.min.js",
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


# ─── App ────────────────────────────────────────────────────────────
def create_app() -> FastAPI:
    init_db()
    validate_security_config()
    app = FastAPI(
        title="Axiom Core",
        version="4.0.0",
        description="Personal decision intelligence — business sandbox edition.",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(Exception)
    async def _unhandled_exception(request: Request, exc: Exception) -> Response:
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

    # ── Static / shell ──
    def serve_spa() -> Response:
        """All HTML routes resolve to the built React bundle — no legacy
        fallback. If the bundle is missing, we surface a clear operator message
        instead of silently rendering a stale standalone prototype."""
        if FRONTEND_INDEX.exists():
            return FileResponse(FRONTEND_INDEX, headers={"Cache-Control": "no-store"})
        return Response(SPA_NOT_BUILT, status_code=503, media_type="text/html; charset=utf-8")

    @app.get("/login")
    def login() -> Response:
        return serve_spa()

    @app.get("/api/altcha")
    def altcha_challenge() -> Response:
        return JSONResponse(
            generate_altcha_challenge(),
            headers={"Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate", "Pragma": "no-cache", "Expires": "0"},
        )

    @app.get("/api/altcha/debug")
    def altcha_debug() -> dict[str, Any]:
        if not env_flag("AXIOM_ALTCHA_DEBUG"):
            return {"ok": False, "detail": "debug disabled — set AXIOM_ALTCHA_DEBUG=1"}
        return {
            "ok": True,
            "altcha_lib_version": getattr(_altcha, "__version__", "unknown"),
            "algorithm": ALTCHA_ALGORITHM,
            "cost": ALTCHA_COST,
            "counter_max": ALTCHA_COUNTER_MAX,
            "challenge_ttl_seconds": ALTCHA_CHALLENGE_TTL_SECONDS,
            "hmac_key_set": bool(altcha_hmac_key()),
            "hmac_key_source": "ALTCHA_HMAC_KEY" if os.getenv("ALTCHA_HMAC_KEY") else "AXIOM_SESSION_SECRET",
            "cloud_mode": cloud_mode(),
            "server_time_iso": datetime.now().isoformat(),
            "server_time_unix": int(datetime.now().timestamp()),
            "last_failure": dict(_last_altcha_failure),
        }

    @app.get("/altcha.min.js")
    def altcha_widget_js() -> Response:
        candidates = [FRONTEND_DIST / "altcha.min.js", ROOT / "web" / "node_modules" / "altcha" / "dist" / "main" / "altcha.umd.min.cjs"]
        for path in candidates:
            if path.exists():
                return FileResponse(str(path), media_type="application/javascript")
        return Response(status_code=404)

    @app.post("/api/login")
    async def post_login(request: Request) -> Response:
        try:
            ip = client_key(request)
            if ip_rate_limited(ip):
                _login_log.warning("ip_rate_limited ip=%s", ip)
                return _login_redirect("请求频率过高，请稍后再试。")
            record_ip_request(ip)
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
                return _login_redirect("登录未配置，请先设置 AXIOM_WEB_PASSWORD。")
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
            response.set_cookie(SESSION_COOKIE, signed, max_age=ttl_seconds, httponly=True, secure=secure_cookie, samesite="lax")
            return response
        except Exception as exc:
            _login_log.exception("login_unhandled_exception err=%r", exc)
            return _login_redirect("登录暂时不可用，请稍后重试。")

    @app.post("/api/logout")
    def post_logout() -> Response:
        response = RedirectResponse(url="/login", status_code=303)
        response.delete_cookie(SESSION_COOKIE)
        return response

    @app.get("/api/auth/config")
    def auth_config() -> dict[str, Any]:
        return {"ok": True, "authEnabled": auth_enabled(), "altchaEnabled": cloud_mode(), "sessionTtlLabel": session_ttl_label()}

    @app.get("/api/auth/me")
    def auth_me(request: Request) -> dict[str, Any]:
        if not auth_enabled():
            return {"ok": True, "authenticated": True, "authRequired": False}
        is_auth = valid_session(request.cookies.get(SESSION_COOKIE))
        return {"ok": True, "authenticated": bool(is_auth), "authRequired": True}

    @app.get("/api/health")
    def health() -> dict[str, Any]:
        return {"ok": True, "service": BRAND_NAME, "time": now_iso()}

    @app.get("/api/config")
    def public_config() -> dict[str, Any]:
        return {"ok": True, "brandName": BRAND_NAME, "tagline": PRODUCT_TAGLINE}

    @app.get("/favicon.ico")
    def favicon() -> Response:
        return Response(status_code=204)

    # ── Business sandbox API ──
    @app.get("/api/dashboard")
    def dashboard() -> dict[str, Any]:
        return dashboard_snapshot()

    @app.get("/api/capital/baseline")
    def capital_baseline_get() -> dict[str, Any]:
        with connect() as conn:
            return {"ok": True, "baseline": baseline_row(conn)}

    @app.put("/api/capital/baseline")
    def capital_baseline_put(payload: Annotated[BaselineIn, Body()]) -> dict[str, Any]:
        return {"ok": True, "baseline": update_baseline(payload)}

    @app.get("/api/capital/tx")
    def capital_tx_list(limit: int = Query(default=200, ge=1, le=1000)) -> dict[str, Any]:
        return {"ok": True, "transactions": list_capital_tx(limit)}

    @app.post("/api/capital/tx")
    def capital_tx_create(payload: Annotated[CapitalTxIn, Body()]) -> dict[str, Any]:
        return {"ok": True, "transaction": insert_capital_tx(payload)}

    @app.delete("/api/capital/tx/{tx_id}")
    def capital_tx_delete(tx_id: str) -> dict[str, Any]:
        delete_capital_tx(tx_id)
        return {"ok": True}

    @app.get("/api/projects")
    def projects_list() -> dict[str, Any]:
        return {"ok": True, "projects": list_projects()}

    @app.post("/api/projects")
    def projects_create(payload: Annotated[ProjectIn, Body()]) -> dict[str, Any]:
        return {"ok": True, "project": insert_project(payload)}

    @app.put("/api/projects/{project_id}")
    def projects_patch(project_id: str, payload: Annotated[ProjectPatch, Body()]) -> dict[str, Any]:
        return {"ok": True, "project": update_project(project_id, payload)}

    @app.delete("/api/projects/{project_id}")
    def projects_delete(project_id: str) -> dict[str, Any]:
        delete_project(project_id)
        return {"ok": True}

    @app.get("/api/decisions")
    def decisions_list() -> dict[str, Any]:
        return {"ok": True, "decisions": list_decisions()}

    @app.post("/api/decisions")
    def decisions_create(payload: Annotated[DecisionIn, Body()]) -> dict[str, Any]:
        return {"ok": True, "decision": insert_decision(payload)}

    @app.put("/api/decisions/{decision_id}")
    def decisions_patch(decision_id: str, payload: Annotated[DecisionPatch, Body()]) -> dict[str, Any]:
        return {"ok": True, "decision": update_decision(decision_id, payload)}

    @app.delete("/api/decisions/{decision_id}")
    def decisions_delete(decision_id: str) -> dict[str, Any]:
        delete_decision(decision_id)
        return {"ok": True}

    # ── Docs / Vault ──
    @app.get("/api/docs")
    def docs_index() -> dict[str, Any]:
        return {"docs": list_docs()}

    @app.get("/api/docs/{doc_id}")
    def docs_detail(doc_id: str) -> dict[str, Any]:
        return get_doc_payload(doc_id)

    # ── AI proxy (preserved) ──
    AI_MODELS = [
        {"id": "Pro/deepseek-ai/DeepSeek-V3.2",  "name": "DeepSeek V3.2 Pro",  "provider": "siliconflow"},
        {"id": "deepseek-ai/DeepSeek-V3",         "name": "DeepSeek V3 (free)", "provider": "siliconflow"},
        {"id": "Pro/deepseek-ai/DeepSeek-R1",     "name": "DeepSeek R1 Pro",    "provider": "siliconflow"},
        {"id": "Qwen/Qwen3.5-72B",                "name": "Qwen3.5 72B",        "provider": "siliconflow"},
        {"id": "gpt-4o",                           "name": "GPT-4o",             "provider": "openai"},
        {"id": "gpt-4o-mini",                      "name": "GPT-4o Mini",        "provider": "openai"},
        {"id": "o3-mini",                          "name": "OpenAI o3-mini",     "provider": "openai"},
    ]
    PROVIDER_CONFIG = {
        "siliconflow": {"base_url": "https://api.siliconflow.cn/v1", "env_key": "SILICONFLOW_API_KEY"},
        "openai":      {"base_url": "https://api.openai.com/v1",     "env_key": "OPENAI_API_KEY"},
    }

    def resolve_model(model_id: str) -> dict[str, Any]:
        for m in AI_MODELS:
            if m["id"] == model_id:
                return m
        return {"id": model_id, "provider": "siliconflow"}

    @app.get("/api/ai/models")
    def ai_models() -> dict[str, Any]:
        return {"ok": True, "models": AI_MODELS}

    class ProbeKeyPayload(BaseModel):
        model_config = ConfigDict(extra="ignore")
        provider: str = "openai"
        api_key: str
        base_url: str | None = None

    @app.post("/api/ai/probe-key")
    async def probe_key(payload: Annotated[ProbeKeyPayload, Body()]) -> dict[str, Any]:
        if not _HTTPX_AVAILABLE:
            raise HTTPException(status_code=503, detail="httpx not installed")
        cfg2 = PROVIDER_CONFIG.get(payload.provider, {})
        base = payload.base_url or cfg2.get("base_url")
        if not base:
            raise HTTPException(status_code=400, detail="missing base_url")
        try:
            async with _httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(f"{base}/models", headers={"Authorization": f"Bearer {payload.api_key}"})
                resp.raise_for_status()
                data = resp.json()
        except _httpx.HTTPStatusError as exc:
            raise HTTPException(status_code=502, detail=f"API error: {exc.response.text[:300]}") from exc
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"request failed: {exc}") from exc
        raw = data.get("data", [])
        if payload.provider == "openai":
            CHAT_PREFIXES = ("gpt-4", "gpt-3.5", "o1", "o3", "o4")
            EXCLUDE = ("instruct", "vision", "tts", "dall", "whisper", "embedding", "search", "realtime", "preview-0")
            raw = [m for m in raw if any(m.get("id", "").startswith(p) for p in CHAT_PREFIXES) and not any(x in m.get("id", "") for x in EXCLUDE)]
        models_out = sorted([{"id": m["id"], "name": m["id"]} for m in raw], key=lambda x: x["id"], reverse=True)
        return {"ok": True, "models": models_out, "total": len(models_out)}

    class AiAnalyzePayload(BaseModel):
        model_config = ConfigDict(extra="ignore")
        prompt: str
        model: str = "Pro/deepseek-ai/DeepSeek-V3.2"
        api_key_override: str | None = None
        base_url_override: str | None = None

    @app.post("/api/ai-analyze")
    async def ai_analyze(payload: Annotated[AiAnalyzePayload, Body()]) -> dict[str, Any]:
        if not _HTTPX_AVAILABLE:
            raise HTTPException(status_code=503, detail="httpx not installed")
        model_info = resolve_model(payload.model)
        provider = model_info.get("provider", "siliconflow")
        cfg = PROVIDER_CONFIG.get(provider, PROVIDER_CONFIG["siliconflow"])
        api_key = payload.api_key_override or os.getenv(cfg["env_key"], "")
        base_url = payload.base_url_override or cfg["base_url"]
        if not api_key:
            raise HTTPException(status_code=503, detail=f"{cfg['env_key']} not configured")

        snapshot = dashboard_snapshot()
        context_data = {
            "baseline": snapshot["baseline"],
            "capital": snapshot["capital"],
            "active_projects": [
                {"name": p["name"], "status": p["status"], "risk": p["risk_level"], "roi": p["roi_projection"], "thesis": p["thesis"]}
                for p in snapshot["projects"]["active"]
            ],
            "open_decisions": [
                {"context": d["context"], "options": d["options"], "rationale": d["rationale"]}
                for d in snapshot["decisions"]["open"]
            ],
            "recent_transactions": snapshot["recent_tx"][:5],
        }
        system_prompt = (
            "You are the Chief Decision Officer of Axiom Core. The operator runs a personal business sandbox "
            "with a hard capital floor. Based on the JSON snapshot below, return a structured brief: "
            "(1) one-line verdict (approve / hold / reject), "
            "(2) numeric rationale (net position, monthly_net, runway months vs floor), "
            "(3) at most 3 immediate next actions. "
            "Reply in the language of the user's prompt. Be cold, specific, no platitudes. Under 500 words."
        )
        user_message = f"Snapshot:\n{json.dumps(context_data, ensure_ascii=False, indent=2)}\n\nOperator prompt:\n{payload.prompt}"

        try:
            async with _httpx.AsyncClient(timeout=90.0) as client:
                resp = await client.post(
                    f"{base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={
                        "model": payload.model,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_message},
                        ],
                        "max_tokens": 1500,
                        "temperature": 0.7,
                        "stream": False,
                    },
                )
                resp.raise_for_status()
                reply = resp.json()["choices"][0]["message"]["content"]
        except _httpx.HTTPStatusError as exc:
            raise HTTPException(status_code=502, detail=f"AI API error: {exc.response.text}") from exc
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"AI request failed: {exc}") from exc

        return {
            "ok": True,
            "reply": reply,
            "model": payload.model,
            "provider": provider,
            "context": context_data,
        }

    # ── App shell catch-all ──
    @app.get("/")
    @app.get("/app")
    @app.get("/app.html")
    @app.get("/projects")
    @app.get("/decisions")
    @app.get("/ledger")
    @app.get("/files")
    @app.get("/library")
    @app.get("/vault")
    @app.get("/ai")
    @app.get("/oracle")
    @app.get("/more")
    @app.get("/settings")
    def app_shell() -> Response:
        return serve_spa()

    return app


app = create_app()


def run(host: str, port: int, reload: bool = False) -> None:
    print(f"Axiom Core FastAPI service started: http://{host}:{port}/app")
    print(f"OpenAPI docs: http://127.0.0.1:{port}/docs")
    uvicorn.run("axiom_server:app", host=host, port=port, reload=reload)


def main() -> None:
    parser = argparse.ArgumentParser(description="Axiom Core — business sandbox FastAPI")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8765, type=int)
    parser.add_argument("--reload", action="store_true")
    args = parser.parse_args()
    run(args.host, args.port, args.reload)


if __name__ == "__main__":
    sys.exit(main() or 0)
