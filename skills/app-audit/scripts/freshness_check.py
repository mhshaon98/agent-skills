#!/usr/bin/env python3
"""Flag SOURCE_REVIEW_REQUIRED entries in an /app-audit source registry.

Applies the freshness windows from requirements section E:

    platform_policy    30 days   (fast-changing platform policies)
    active_regulation  30 days   (active / new regulation)
    statute            90 days   (stable statutory text)
    engineering       365 days   (engineering references)

A stale entry must be re-researched before an audit relies on it. Entries whose
recorded status is not CURRENT (VACATED, REPEALED, SUPERSEDED, UNDER_CHALLENGE,
UPCOMING, UNKNOWN) are also flagged for review by default, because they cannot
be cited as-is.

Read-only: never writes, never fetches anything from the network.

Exit codes: 0 = every entry fresh, 3 = at least one SOURCE_REVIEW_REQUIRED,
            2 = usage / unreadable input.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys

DEFAULT_WINDOWS = {
    "platform_policy": 30,
    "active_regulation": 30,
    "statute": 90,
    "engineering": 365,
}

# authority_type -> freshness class, used when freshness_class is absent
AUTHORITY_CLASS = {
    "platform_policy": "platform_policy",
    "regulation": "active_regulation",
    "regulator_guidance": "active_regulation",
    "government_guidance": "active_regulation",
    "enforcement_action": "active_regulation",
    "statute": "statute",
    "court_decision": "statute",
    "primary_other": "statute",
    "engineering_reference": "engineering",
    "secondary_analysis": "engineering",
}

NON_CURRENT_REVIEW = {
    "UPCOMING",
    "SUPERSEDED",
    "VACATED",
    "REPEALED",
    "UNDER_CHALLENGE",
    "UNKNOWN",
}


def load_entries(path: str) -> tuple[list[dict], dict]:
    with open(path, "r", encoding="utf-8") as handle:
        data = json.load(handle)
    if isinstance(data, list):
        return data, {}
    if isinstance(data, dict):
        entries = data.get("entries")
        if not isinstance(entries, list):
            raise ValueError("registry object has no 'entries' array")
        overrides = data.get("freshness_windows") or {}
        if not isinstance(overrides, dict):
            raise ValueError("'freshness_windows' must be an object")
        return entries, overrides
    raise ValueError("registry must be an array of entries or an object with 'entries'")


def classify(entry: dict) -> str:
    explicit = entry.get("freshness_class")
    if isinstance(explicit, str) and explicit in DEFAULT_WINDOWS:
        return explicit
    return AUTHORITY_CLASS.get(str(entry.get("authority_type", "")), "engineering")


def evaluate(entries: list[dict], windows: dict, today: dt.date, flag_noncurrent: bool) -> list[dict]:
    results = []
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            results.append(
                {
                    "rule_id": f"<entry {index}>",
                    "review_required": True,
                    "reasons": ["entry is not an object"],
                    "days_stale": None,
                    "days_since_verified": None,
                    "freshness_class": None,
                    "window_days": None,
                    "status": None,
                    "last_verified": None,
                }
            )
            continue

        rule_id = str(entry.get("rule_id") or f"<entry {index}>")
        cls = classify(entry)
        window = entry.get("freshness_window_days")
        if not isinstance(window, int) or isinstance(window, bool) or window < 1:
            window = int(windows.get(cls, DEFAULT_WINDOWS[cls]))

        reasons: list[str] = []
        days_since = None
        days_stale = None

        raw_date = entry.get("last_verified")
        if not isinstance(raw_date, str) or not raw_date:
            reasons.append("last_verified missing")
        else:
            try:
                verified = dt.date.fromisoformat(raw_date)
            except ValueError:
                reasons.append(f"last_verified '{raw_date}' is not a YYYY-MM-DD date")
            else:
                days_since = (today - verified).days
                if days_since < 0:
                    reasons.append(f"last_verified '{raw_date}' is in the future")
                elif days_since > window:
                    days_stale = days_since - window
                    reasons.append(
                        f"stale by {days_stale}d "
                        f"(verified {days_since}d ago, {cls} window {window}d)"
                    )

        status = entry.get("status")
        if flag_noncurrent and isinstance(status, str) and status in NON_CURRENT_REVIEW:
            reasons.append(f"status={status} — cannot be relied on as CURRENT")

        if entry.get("review_required") is True:
            reasons.append("review_required flag set in the registry")

        results.append(
            {
                "rule_id": rule_id,
                "authority_name": entry.get("authority_name"),
                "citation_or_section": entry.get("citation_or_section"),
                "status": status,
                "freshness_class": cls,
                "window_days": window,
                "last_verified": raw_date if isinstance(raw_date, str) else None,
                "days_since_verified": days_since,
                "days_stale": days_stale,
                "review_required": bool(reasons),
                "reasons": reasons,
            }
        )
    return results


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        prog="freshness_check.py",
        description="Flag SOURCE_REVIEW_REQUIRED entries in an app-audit source registry.",
        epilog="exit 0 = all fresh, 3 = review required, 2 = usage error",
    )
    parser.add_argument("registry", help="path to source-registry JSON (array or {entries:[...]})")
    parser.add_argument("--platform-days", type=int, help="window for platform policies (default 30)")
    parser.add_argument("--regulation-days", type=int, help="window for active regulation (default 30)")
    parser.add_argument("--statute-days", type=int, help="window for stable statutes (default 90)")
    parser.add_argument("--engineering-days", type=int, help="window for engineering refs (default 365)")
    parser.add_argument("--today", help="evaluate as of this YYYY-MM-DD date (default: system today)")
    parser.add_argument(
        "--no-flag-noncurrent",
        action="store_true",
        help="do not flag entries whose status is not CURRENT",
    )
    parser.add_argument("--json", action="store_true", help="machine-readable output")
    parser.add_argument("--all", action="store_true", help="also list fresh entries")

    if not argv:
        parser.print_usage(sys.stderr)
        print("error: a registry file is required", file=sys.stderr)
        return 2
    args = parser.parse_args(argv)

    try:
        entries, file_windows = load_entries(args.registry)
    except OSError as exc:
        print(f"error: cannot read registry: {exc}", file=sys.stderr)
        return 2
    except (ValueError, json.JSONDecodeError) as exc:
        print(f"error: invalid registry: {exc}", file=sys.stderr)
        return 2

    windows = dict(DEFAULT_WINDOWS)
    for key, value in file_windows.items():
        if key in windows and isinstance(value, int) and not isinstance(value, bool) and value >= 1:
            windows[key] = value
    cli_windows = {
        "platform_policy": args.platform_days,
        "active_regulation": args.regulation_days,
        "statute": args.statute_days,
        "engineering": args.engineering_days,
    }
    for key, value in cli_windows.items():
        if value is not None:
            if value < 1:
                print(f"error: --{key.replace('_', '-')} must be >= 1", file=sys.stderr)
                return 2
            windows[key] = value

    if args.today:
        try:
            today = dt.date.fromisoformat(args.today)
        except ValueError:
            print(f"error: --today '{args.today}' is not a YYYY-MM-DD date", file=sys.stderr)
            return 2
    else:
        today = dt.date.today()

    results = evaluate(entries, windows, today, not args.no_flag_noncurrent)
    stale = [r for r in results if r["review_required"]]

    if args.json:
        print(
            json.dumps(
                {
                    "registry": args.registry,
                    "evaluated_on": today.isoformat(),
                    "windows": windows,
                    "entries_total": len(results),
                    "review_required_count": len(stale),
                    "review_required": stale,
                    "entries": results if args.all else None,
                },
                indent=2,
            )
        )
    else:
        print(f"freshness check: {args.registry}  (as of {today.isoformat()})")
        print(
            "windows: "
            + ", ".join(f"{k}={v}d" for k, v in windows.items())
            + f"  |  entries: {len(results)}"
        )
        if not stale:
            print("OK: all entries fresh — no SOURCE_REVIEW_REQUIRED")
        else:
            print(f"\nSOURCE_REVIEW_REQUIRED: {len(stale)} of {len(results)} entries")
            for item in stale:
                stale_text = (
                    f"stale {item['days_stale']}d" if item["days_stale"] is not None else "review"
                )
                print(
                    f"  - {item['rule_id']} [{item['status']}] ({item['freshness_class']}, "
                    f"window {item['window_days']}d, {stale_text})"
                )
                for reason in item["reasons"]:
                    print(f"      * {reason}")
        if args.all:
            fresh = [r for r in results if not r["review_required"]]
            if fresh:
                print(f"\nFRESH: {len(fresh)} entries")
                for item in fresh:
                    print(
                        f"  - {item['rule_id']} [{item['status']}] "
                        f"verified {item['days_since_verified']}d ago "
                        f"(window {item['window_days']}d)"
                    )

    return 3 if stale else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
