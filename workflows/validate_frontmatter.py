from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any

import frontmatter
from jsonschema import Draft202012Validator, FormatChecker


ROOT = Path(__file__).resolve().parents[1]
SCHEMA_DIR = ROOT / "data" / "schemas"
TYPE_TO_SCHEMA = {
    "daily_health_log": "daily-health.schema.json",
    "annual_business_goal": "annual-business-goal.schema.json",
    "finance_dashboard": "finance-dashboard.schema.json",
}

# Directories whose .md files are documentation/archive/build-output and must
# never be schema-validated. Matched against any path segment so nested copies
# (e.g. web/node_modules/foo/docs) are also skipped.
DEFAULT_EXCLUDE_DIRS = {
    "docs",
    "archive",
    "node_modules",
    "output",
    "test-results",
    "__pycache__",
    "dist",
    ".git",
    ".claude",
    ".playwright-cli",
    ".sync_logs",
    ".axiom-secrets",
}


def normalize_for_json_schema(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(key): normalize_for_json_schema(item) for key, item in value.items()}
    if isinstance(value, list):
        return [normalize_for_json_schema(item) for item in value]
    if isinstance(value, tuple):
        return [normalize_for_json_schema(item) for item in value]
    return value


def display_path(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(ROOT))
    except ValueError:
        return str(path)


def dotted_path(parts: Any) -> str:
    values = [str(part) for part in parts]
    return ".".join(values) if values else "<root>"


def iter_markdown_files(path: Path, exclude_dirs: set[str] | None = None) -> list[Path]:
    if path.is_file():
        return [path] if path.suffix.lower() == ".md" else []
    excludes = DEFAULT_EXCLUDE_DIRS if exclude_dirs is None else exclude_dirs
    results: list[Path] = []
    for item in path.rglob("*.md"):
        if not item.is_file():
            continue
        if any(part in excludes for part in item.relative_to(path).parts):
            continue
        results.append(item)
    return sorted(results)


def load_schema(schema_name: str) -> dict[str, Any]:
    schema_path = SCHEMA_DIR / schema_name
    with schema_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def validate_file(path: Path, verbose: bool) -> bool:
    try:
        post = frontmatter.load(path, encoding="utf-8")
    except Exception as exc:
        print(f"FAIL {display_path(path)}")
        print(f"  Could not read frontmatter: {exc}")
        return False

    metadata = normalize_for_json_schema(dict(post.metadata))
    document_type = metadata.get("type")
    schema_name = TYPE_TO_SCHEMA.get(document_type)
    if not schema_name:
        print(f"FAIL {display_path(path)}")
        print(f"  Unsupported or missing frontmatter type: {document_type!r}")
        return False

    try:
        schema = load_schema(schema_name)
    except Exception as exc:
        print(f"FAIL {display_path(path)}")
        print(f"  Could not load schema {schema_name}: {exc}")
        return False

    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = sorted(validator.iter_errors(metadata), key=lambda error: [str(part) for part in error.path])
    if not errors:
        print(f"PASS {display_path(path)}")
        return True

    print(f"FAIL {display_path(path)}")
    for error in errors:
        print(f"  {dotted_path(error.path)}: {error.message}")
        if verbose:
            print(f"    schema: {dotted_path(error.schema_path)}")
    return False


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate Axiom Core Markdown YAML frontmatter against JSON Schema files."
    )
    parser.add_argument(
        "--path",
        required=True,
        help="Markdown file or directory to validate recursively.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print schema paths for validation errors.",
    )
    parser.add_argument(
        "--exclude",
        action="append",
        default=None,
        help=(
            "Directory name to skip (matched against any path segment). "
            "Repeatable. Overrides the built-in default exclude list."
        ),
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    target = Path(args.path)
    if not target.is_absolute():
        target = ROOT / target

    if not target.exists():
        print(f"Path does not exist: {target}", file=sys.stderr)
        return 2

    exclude_dirs = set(args.exclude) if args.exclude else None
    markdown_files = iter_markdown_files(target, exclude_dirs=exclude_dirs)
    if not markdown_files:
        print(f"No Markdown files found under {display_path(target)}")
        return 0

    all_passed = True
    for path in markdown_files:
        all_passed = validate_file(path, args.verbose) and all_passed

    return 0 if all_passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
