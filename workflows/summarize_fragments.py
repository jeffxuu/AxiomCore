from __future__ import annotations

import argparse
import calendar
import re
import sys
from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

import frontmatter


ROOT = Path(__file__).resolve().parents[1]
WARNING_ENERGY = "[CRITICAL WARNING: ENERGY]"
WARNING_BUDGET = "[CRITICAL WARNING: BUDGET]"
WARNING_CASHFLOW = "[CRITICAL WARNING: CASHFLOW]"
WARNING_VALIDATION_DEADLINE = "[CRITICAL WARNING: VALIDATION_DEADLINE]"
AUTO_SUMMARY_START = "<!-- AUTO_SUMMARY_START -->"
AUTO_SUMMARY_END = "<!-- AUTO_SUMMARY_END -->"

STOPWORDS = {
    "the",
    "and",
    "for",
    "with",
    "this",
    "that",
    "from",
    "today",
    "tomorrow",
    "schema",
    "version",
    "type",
    "status",
    "active",
    "null",
    "true",
    "false",
    "今天",
    "明天",
    "记录",
    "当前",
    "本月",
    "一个",
    "需要",
    "业务",
    "个人",
    "账户",
}


@dataclass
class MarkdownDoc:
    path: Path
    metadata: dict[str, Any]
    content: str


def normalize_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(key): normalize_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [normalize_value(item) for item in value]
    if isinstance(value, tuple):
        return [normalize_value(item) for item in value]
    return value


def resolve_path(value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else ROOT / path


def display_path(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(ROOT))
    except ValueError:
        return str(path)


def iter_markdown_files(path: Path) -> list[Path]:
    if not path.exists():
        return []
    if path.is_file():
        return [path] if path.suffix.lower() == ".md" else []
    return sorted(item for item in path.rglob("*.md") if item.is_file())


def read_markdown(path: Path) -> MarkdownDoc | None:
    try:
        post = frontmatter.load(path, encoding="utf-8")
    except Exception as exc:
        print(f"SKIP {display_path(path)}: could not read frontmatter: {exc}", file=sys.stderr)
        return None
    return MarkdownDoc(
        path=path,
        metadata=normalize_value(dict(post.metadata)),
        content=post.content,
    )


def read_many(paths: list[Path]) -> list[MarkdownDoc]:
    docs: list[MarkdownDoc] = []
    for path in paths:
        doc = read_markdown(path)
        if doc:
            docs.append(doc)
    return docs


def read_optional(path: Path) -> MarkdownDoc | None:
    if not path.exists():
        return None
    return read_markdown(path)


def parse_iso_date(value: Any) -> date | None:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None
    return None


def as_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def extract_daily_metrics(docs: list[MarkdownDoc], lookback_days: int) -> list[dict[str, Any]]:
    metrics: list[dict[str, Any]] = []
    for doc in docs:
        meta = doc.metadata
        if meta.get("type") != "daily_health_log":
            continue
        day = parse_iso_date(meta.get("date"))
        metrics.append(
            {
                "path": display_path(doc.path),
                "date": day.isoformat() if day else str(meta.get("date") or ""),
                "date_obj": day,
                "energy_score": as_float(meta.get("energy_score")),
                "sleep_hours": as_float(meta.get("sleep_hours")),
                "mood_score": as_float(meta.get("mood_score")),
                "exercise_minutes": as_float(meta.get("exercise_minutes")),
            }
        )

    metrics.sort(key=lambda item: item["date_obj"] or date.min)
    if lookback_days > 0:
        return metrics[-lookback_days:]
    return metrics


def extract_keywords(docs: list[MarkdownDoc], limit: int = 12) -> list[tuple[str, int]]:
    counter: Counter[str] = Counter()
    for doc in docs:
        tags = doc.metadata.get("tags")
        if isinstance(tags, list):
            for tag in tags:
                text = str(tag).strip().lower()
                if text and text not in STOPWORDS:
                    counter[text] += 3

        text = re.sub(r"[#`*_>\-\[\]():|/\\,.;!?，。；：！？（）【】]", " ", doc.content.lower())
        for token in re.findall(r"[a-z0-9_]{2,}|[\u4e00-\u9fff]{2,}", text):
            if token not in STOPWORDS:
                counter[token] += 1

    return counter.most_common(limit)


def has_three_low_energy_entries(metrics: list[dict[str, Any]]) -> bool:
    streak = 0
    for item in metrics:
        energy = item.get("energy_score")
        if energy is not None and energy < 5:
            streak += 1
            if streak >= 3:
                return True
        else:
            streak = 0
    return False


def analyze_energy(metrics: list[dict[str, Any]]) -> bool:
    single_extreme = any(
        item.get("energy_score") is not None and item["energy_score"] <= 2 for item in metrics
    )
    return single_extreme or has_three_low_energy_entries(metrics)


def month_progress(period: str, today: date) -> float:
    try:
        year_text, month_text = period.split("-", 1)
        year = int(year_text)
        month = int(month_text)
    except ValueError:
        return 0

    _, days_in_month = calendar.monthrange(year, month)
    if today.year < year or (today.year == year and today.month < month):
        return 0
    if today.year > year or (today.year == year and today.month > month):
        return 1
    return min(max(today.day / days_in_month, 0), 1)


def finance_metrics(finance_doc: MarkdownDoc | None, today: date) -> dict[str, Any]:
    if not finance_doc:
        return {}
    meta = finance_doc.metadata
    personal_cash = meta.get("personal_cash") if isinstance(meta.get("personal_cash"), dict) else {}
    business_cash = meta.get("business_cash") if isinstance(meta.get("business_cash"), dict) else {}

    budget_total = as_float(business_cash.get("budget_total_cny"))
    budget_spent = as_float(business_cash.get("budget_spent_cny")) or 0
    budget_committed = as_float(business_cash.get("budget_committed_cny")) or 0
    budget_consumed = budget_spent + budget_committed
    actual_rate = budget_consumed / budget_total if budget_total and budget_total > 0 else None
    expected_rate = month_progress(str(meta.get("period") or ""), today)

    return {
        "path": display_path(finance_doc.path),
        "cashflow_status": personal_cash.get("cashflow_status"),
        "runway_months": as_float(business_cash.get("runway_months")),
        "budget_total_cny": budget_total,
        "budget_spent_cny": budget_spent,
        "budget_committed_cny": budget_committed,
        "budget_consumed_cny": budget_consumed,
        "budget_actual_rate": actual_rate,
        "budget_expected_rate": expected_rate,
    }


def business_metrics(business_doc: MarkdownDoc | None) -> dict[str, Any]:
    if not business_doc:
        return {}
    meta = business_doc.metadata
    return {
        "path": display_path(business_doc.path),
        "business_name": meta.get("business_name"),
        "stage": meta.get("stage"),
        "capital_plan_cny": as_float(meta.get("capital_plan_cny")),
        "hard_stop_loss_cny": as_float(meta.get("hard_stop_loss_cny")),
        "validation_deadline": meta.get("validation_deadline"),
    }


def analyze_budget(metrics: dict[str, Any]) -> bool:
    runway = metrics.get("runway_months")
    if runway is not None and runway < 6:
        return True

    actual_rate = metrics.get("budget_actual_rate")
    expected_rate = metrics.get("budget_expected_rate")
    if actual_rate is None or expected_rate is None:
        return False
    return actual_rate > expected_rate + 0.20


def analyze_cashflow(metrics: dict[str, Any]) -> bool:
    return str(metrics.get("cashflow_status") or "").lower() == "red"


def analyze_validation_deadline(metrics: dict[str, Any], today: date) -> bool:
    deadline = parse_iso_date(metrics.get("validation_deadline"))
    return bool(deadline and today > deadline)


def build_warnings(
    daily_metrics: list[dict[str, Any]],
    finance: dict[str, Any],
    business: dict[str, Any],
    today: date,
) -> list[str]:
    warnings: list[str] = []
    if analyze_energy(daily_metrics):
        warnings.append(WARNING_ENERGY)
    if analyze_budget(finance):
        warnings.append(WARNING_BUDGET)
    if analyze_cashflow(finance):
        warnings.append(WARNING_CASHFLOW)
    if analyze_validation_deadline(business, today):
        warnings.append(WARNING_VALIDATION_DEADLINE)
    return warnings


def format_number(value: Any, suffix: str = "") -> str:
    number = as_float(value)
    if number is None:
        return "N/A"
    if number.is_integer():
        return f"{int(number)}{suffix}"
    return f"{number:.2f}{suffix}"


def build_report(
    daily_metrics: list[dict[str, Any]],
    finance: dict[str, Any],
    business: dict[str, Any],
    keywords: list[tuple[str, int]],
    warnings: list[str],
    source_counts: dict[str, int],
    generated_at: str,
    dry_run: bool,
) -> str:
    lines = [
        "# AI 汇总报告预览" if dry_run else "# AI 汇总报告",
        "",
        f"Generated at: {generated_at}",
        "",
        "## 预警标签",
    ]
    if dry_run:
        lines.insert(2, "DRY RUN: no files were modified.")
        lines.insert(3, "")

    if warnings:
        lines.extend(f"- {warning}" for warning in warnings)
    else:
        lines.append("- 无 critical warning")

    lines.extend(
        [
            "",
            "## 读取范围",
            f"- daily records: {source_counts.get('daily', 0)}",
            f"- fragments: {source_counts.get('fragments', 0)}",
            f"- finance dashboard: {'yes' if finance else 'no'}",
            f"- business goal: {'yes' if business else 'no'}",
            "",
            "## 提取的每日指标",
        ]
    )
    if daily_metrics:
        for item in daily_metrics:
            lines.append(
                "- "
                f"{item['date']} | "
                f"energy={format_number(item.get('energy_score'))} | "
                f"sleep={format_number(item.get('sleep_hours'), 'h')} | "
                f"mood={format_number(item.get('mood_score'))} | "
                f"exercise={format_number(item.get('exercise_minutes'), 'min')} | "
                f"{item['path']}"
            )
    else:
        lines.append("- No daily_health_log records found.")

    lines.extend(["", "## 提取的财务与业务指标"])
    if finance:
        actual_rate = finance.get("budget_actual_rate")
        expected_rate = finance.get("budget_expected_rate")
        lines.extend(
            [
                f"- cashflow_status: {finance.get('cashflow_status')}",
                f"- runway_months: {format_number(finance.get('runway_months'))}",
                f"- budget_consumed_cny: {format_number(finance.get('budget_consumed_cny'))}",
                f"- budget_total_cny: {format_number(finance.get('budget_total_cny'))}",
                "- budget_rate: "
                + (
                    f"actual={actual_rate:.1%}, expected={expected_rate:.1%}"
                    if actual_rate is not None and expected_rate is not None
                    else "N/A"
                ),
            ]
        )
    else:
        lines.append("- No finance_dashboard found.")

    if business:
        lines.extend(
            [
                f"- business_name: {business.get('business_name')}",
                f"- stage: {business.get('stage')}",
                f"- validation_deadline: {business.get('validation_deadline')}",
                f"- capital_plan_cny: {format_number(business.get('capital_plan_cny'))}",
                f"- hard_stop_loss_cny: {format_number(business.get('hard_stop_loss_cny'))}",
            ]
        )
    else:
        lines.append("- No annual_business_goal found.")

    lines.extend(["", "## 提取的关键词"])
    if keywords:
        lines.extend(f"- {word}: {count}" for word, count in keywords)
    else:
        lines.append("- No keywords extracted.")

    return "\n".join(lines)


def default_current_state_content(today: date) -> str:
    return f"""---
schema_version: 1
type: current_state
status: active
updated_at: {today.isoformat()}
---

# 当前状态

## 当前阶段

- 当前主线：2026 年在广州建立独立业务，同时守住健康和个人现金流底线。
- 当前状态：active

## 核心约束

- 保命与健康稳定优先于业务推进。
- 个人现金流不断供优先于业务扩张。
- 100,000 元业务启动资金必须独立核算，不得默认挪作个人债务还款。

## 自动汇总

{AUTO_SUMMARY_START}
暂无自动汇总。
{AUTO_SUMMARY_END}
"""


def update_current_state(path: Path, report: str, today: date) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        content = path.read_text(encoding="utf-8")
    else:
        content = default_current_state_content(today)

    replacement = f"{AUTO_SUMMARY_START}\n{report.strip()}\n{AUTO_SUMMARY_END}"
    pattern = re.compile(
        rf"{re.escape(AUTO_SUMMARY_START)}.*?{re.escape(AUTO_SUMMARY_END)}",
        re.DOTALL,
    )
    if pattern.search(content):
        content = pattern.sub(lambda _match: replacement, content)
    else:
        content = content.rstrip() + "\n\n## 自动汇总\n\n" + replacement + "\n"

    path.write_text(content.rstrip() + "\n", encoding="utf-8")


def weekly_report_path(report_dir: Path, today: date) -> Path:
    iso_year, iso_week, _ = today.isocalendar()
    return report_dir / f"{iso_year}-W{iso_week:02d}.md"


def append_weekly_report(report_dir: Path, report: str, generated_at: str, today: date) -> Path:
    report_dir.mkdir(parents=True, exist_ok=True)
    path = weekly_report_path(report_dir, today)
    entry = f"## Run {generated_at}\n\n{report.strip()}\n"
    if path.exists():
        content = path.read_text(encoding="utf-8").rstrip()
        content = content + "\n\n---\n\n" + entry
    else:
        iso_year, iso_week, _ = today.isocalendar()
        content = f"""---
schema_version: 1
type: ai_weekly_report
status: active
period: {iso_year}-W{iso_week:02d}
---

# AI 周报 {iso_year}-W{iso_week:02d}

{entry}"""
    path.write_text(content.rstrip() + "\n", encoding="utf-8")
    return path


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Summarize LifeOS fragments and daily logs.")
    parser.add_argument("--dry-run", action="store_true", help="Print report only; do not write files.")
    parser.add_argument("--daily-dir", default="logs/daily", help="Directory containing daily Markdown logs.")
    parser.add_argument(
        "--fragment-dir",
        default="logs/fragments/inbox",
        help="Directory containing fragment Markdown notes.",
    )
    parser.add_argument(
        "--finance-path",
        default="templates/finance-dashboard.md",
        help="Finance dashboard Markdown file.",
    )
    parser.add_argument(
        "--business-path",
        default="templates/annual-business-goal.md",
        help="Annual business goal Markdown file.",
    )
    parser.add_argument("--lookback-days", type=int, default=7, help="Number of recent daily records to analyze.")
    parser.add_argument(
        "--current-state-path",
        default="profile/current-state.md",
        help="Path to the current-state Markdown file updated in write mode.",
    )
    parser.add_argument(
        "--weekly-report-dir",
        default="reports/ai-weekly",
        help="Directory for weekly AI reports written in write mode.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    today = date.today()
    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    daily_paths = iter_markdown_files(resolve_path(args.daily_dir))
    fragment_paths = iter_markdown_files(resolve_path(args.fragment_dir))
    daily_docs = read_many(daily_paths)
    fragment_docs = read_many(fragment_paths)
    finance_doc = read_optional(resolve_path(args.finance_path))
    business_doc = read_optional(resolve_path(args.business_path))

    daily_metrics = extract_daily_metrics(daily_docs, args.lookback_days)
    finance = finance_metrics(finance_doc, today)
    business = business_metrics(business_doc)
    keyword_docs = daily_docs + fragment_docs + [doc for doc in (finance_doc, business_doc) if doc]
    keywords = extract_keywords(keyword_docs)
    warnings = build_warnings(daily_metrics, finance, business, today)

    report = build_report(
        daily_metrics=daily_metrics,
        finance=finance,
        business=business,
        keywords=keywords,
        warnings=warnings,
        source_counts={"daily": len(daily_docs), "fragments": len(fragment_docs)},
        generated_at=generated_at,
        dry_run=args.dry_run,
    )
    print(report)
    if args.dry_run:
        return 0

    current_state_path = resolve_path(args.current_state_path)
    weekly_dir = resolve_path(args.weekly_report_dir)
    update_current_state(current_state_path, report, today)
    weekly_path = append_weekly_report(weekly_dir, report, generated_at, today)
    print("")
    print(f"WROTE current-state: {display_path(current_state_path)}")
    print(f"WROTE weekly-report: {display_path(weekly_path)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
