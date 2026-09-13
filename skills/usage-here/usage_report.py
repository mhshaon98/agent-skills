#!/usr/bin/env python3
"""Report what THIS Claude Code session cost, from its local JSONL transcript.

Deterministic: every number here is computed from the transcript's own
`message.usage` blocks and pricing.json. Nothing is estimated by the model.

Usage:
    python usage_report.py                      # newest transcript for cwd
    python usage_report.py --session-id <uuid>
    python usage_report.py --transcript <path>
    python usage_report.py --json               # machine-readable
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent


# ---------------------------------------------------------------- locating

def claude_home() -> Path:
    return Path(os.environ.get("CLAUDE_CONFIG_DIR") or (Path.home() / ".claude"))


def encoded_project_dir(cwd: Path) -> str:
    """Claude Code encodes the project path by replacing separators with '-'."""
    s = str(cwd).replace("\\", "/")
    s = s.replace(":", "-").replace("/", "-").replace(" ", "-").replace(".", "-")
    return s


def find_transcript(session_id: str | None, explicit: str | None, cwd: Path) -> Path:
    if explicit:
        p = Path(explicit)
        if not p.is_file():
            sys.exit(f"No transcript at {p}")
        return p

    projects = claude_home() / "projects"
    if not projects.is_dir():
        sys.exit(f"No transcript store at {projects} — is this a Claude Code session?")

    if session_id:
        hits = sorted(projects.glob(f"**/{session_id}.jsonl"))
        if not hits:
            sys.exit(f"No transcript for session {session_id} under {projects}")
        return hits[0]

    proj = projects / encoded_project_dir(cwd)
    candidates = sorted(proj.glob("*.jsonl"), key=lambda p: p.stat().st_mtime) if proj.is_dir() else []
    if not candidates:
        # Fall back to the newest transcript anywhere — better than nothing,
        # but say so loudly at the call site.
        candidates = sorted(projects.glob("**/*.jsonl"), key=lambda p: p.stat().st_mtime)
        if not candidates:
            sys.exit(f"No transcripts found under {projects}")
        print(f"NOTE: no transcript dir for {cwd}; using newest transcript overall.", file=sys.stderr)
    return candidates[-1]


# ---------------------------------------------------------------- pricing

def load_json(name: str) -> dict:
    with open(HERE / name, encoding="utf-8") as fh:
        return json.load(fh)


def price_row(usage: dict, model: str, pricing: dict) -> tuple[float, dict]:
    """Return (usd, token breakdown) for one assistant message."""
    models = pricing["models"]
    rates = models.get(model) or pricing["unknown_model_fallback"]
    inp, out = rates["input"], rates["output"]

    cc = usage.get("cache_creation") or {}
    w1h = cc.get("ephemeral_1h_input_tokens", 0)
    w5m = cc.get("ephemeral_5m_input_tokens", 0)
    # Older transcripts have only the flat total; treat it as 5m.
    flat = usage.get("cache_creation_input_tokens", 0)
    if not (w1h or w5m):
        w5m = flat

    toks = {
        "input": usage.get("input_tokens", 0),
        "cache_write_5m": w5m,
        "cache_write_1h": w1h,
        "cache_read": usage.get("cache_read_input_tokens", 0),
        "output": usage.get("output_tokens", 0),
    }
    usd = (
        toks["input"] * inp
        + toks["cache_write_5m"] * inp * pricing["cache_write_5m_multiplier"]
        + toks["cache_write_1h"] * inp * pricing["cache_write_1h_multiplier"]
        + toks["cache_read"] * inp * pricing["cache_read_multiplier"]
        + toks["output"] * out
    ) / 1_000_000
    return usd, toks


# ---------------------------------------------------------------- parsing

def first_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                return block.get("text", "")
    return ""


def label_for(text: str, words: int = 5) -> str:
    cleaned = " ".join(text.replace("\n", " ").split())
    if not cleaned:
        return "(no text)"
    parts = cleaned.split(" ")[:words]
    label = " ".join(parts)
    return label + ("…" if len(cleaned) > len(label) else "")


def parse(path: Path, pricing: dict) -> dict:
    rows = []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                try:
                    rows.append(json.loads(line))
                except json.JSONDecodeError:
                    continue

    by_model = defaultdict(lambda: {"usd": 0.0, "calls": 0, "toks": defaultdict(int)})
    by_prompt: dict[str, dict] = {}
    prompt_order: list[str] = []
    timeline: list[tuple[datetime, int, float]] = []  # (ts, total tokens, usd)
    current_prompt = "(session start)"
    total_usd = 0.0
    sidechain_usd = 0.0

    for row in rows:
        rtype = row.get("type")

        if rtype == "user" and not row.get("isSidechain"):
            pid = row.get("promptId") or row.get("uuid") or current_prompt
            content = (row.get("message") or {}).get("content")
            # A real prompt is a plain string; tool results are block lists.
            if isinstance(content, str):
                if pid not in by_prompt:
                    by_prompt[pid] = {"label": label_for(content), "usd": 0.0, "tokens": 0}
                    prompt_order.append(pid)
                current_prompt = pid
            elif pid in by_prompt:
                current_prompt = pid
            continue

        if rtype != "assistant":
            continue

        msg = row.get("message") or {}
        usage = msg.get("usage") or {}
        if not usage:
            continue
        model = msg.get("model") or "unknown"
        usd, toks = price_row(usage, model, pricing)
        total = sum(toks.values())

        entry = by_model[model]
        entry["usd"] += usd
        entry["calls"] += 1
        for k, v in toks.items():
            entry["toks"][k] += v
        total_usd += usd
        if row.get("isSidechain"):
            sidechain_usd += usd

        if current_prompt in by_prompt:
            by_prompt[current_prompt]["usd"] += usd
            by_prompt[current_prompt]["tokens"] += total

        ts = row.get("timestamp")
        if ts:
            try:
                timeline.append((datetime.fromisoformat(ts.replace("Z", "+00:00")), total, usd))
            except ValueError:
                pass

    return {
        "path": path,
        "by_model": by_model,
        "prompts": [dict(by_prompt[p], id=p) for p in prompt_order],
        "timeline": sorted(timeline),
        "total_usd": total_usd,
        "sidechain_usd": sidechain_usd,
    }


# ---------------------------------------------------------------- windows

def window_totals(timeline, since: datetime) -> tuple[int, float]:
    toks = sum(t for ts, t, _ in timeline if ts >= since)
    usd = sum(u for ts, _, u in timeline if ts >= since)
    return toks, usd


def parse_duration(s: str) -> timedelta:
    """'4h30m' / '45m' / '2h' -> timedelta."""
    import re

    m = re.fullmatch(r"(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?", s.strip(), re.I)
    if not m or not any(m.groups()):
        raise argparse.ArgumentTypeError(f"bad duration {s!r}; use forms like 4h30m, 45m, 2h")
    return timedelta(hours=int(m.group(1) or 0), minutes=int(m.group(2) or 0))


def block_start(resets_in: timedelta | None, block_hours: int, now: datetime) -> tuple[datetime, bool]:
    """Start of the current fixed usage block.

    The 5-hour limit is a FIXED block, not a rolling window: `/usage` reports how
    long until it resets, so the block began (block_hours - resets_in) ago. With no
    reading we fall back to rolling, which over-counts — flagged in the output.
    """
    if resets_in is None:
        return now - timedelta(hours=block_hours), False
    elapsed = timedelta(hours=block_hours) - resets_in
    if elapsed < timedelta(0):
        elapsed = timedelta(0)
    return now - elapsed, True


WEEKDAYS = {"mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6}


def week_start(limits: dict, now_local: datetime) -> datetime | None:
    """Start of the current weekly block, anchored to the plan's reset time."""
    day = (limits.get("weekly_reset_weekday") or "").strip().lower()[:3]
    hour = limits.get("weekly_reset_hour_local")
    if day not in WEEKDAYS or hour is None:
        return None
    d = now_local.replace(hour=int(hour), minute=0, second=0, microsecond=0)
    while d.weekday() != WEEKDAYS[day] or d > now_local:
        d -= timedelta(days=1)
    return d.astimezone(timezone.utc)


def scan_all(since: datetime, pricing: dict) -> dict:
    """Sum every local transcript from `since` onward — the closest local proxy
    for what /usage counts. Still only Claude Code on THIS machine."""
    projects = claude_home() / "projects"
    totals = {"tokens": 0, "usd": 0.0, "fable_tokens": 0, "fable_usd": 0.0}
    if not projects.is_dir():
        return totals
    for f in projects.glob("**/*.jsonl"):
        try:
            lines = f.read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError:
            continue
        for ln in lines:
            if '"assistant"' not in ln:
                continue
            try:
                row = json.loads(ln)
            except json.JSONDecodeError:
                continue
            if row.get("type") != "assistant":
                continue
            msg = row.get("message") or {}
            usage, ts = msg.get("usage"), row.get("timestamp")
            if not usage or not ts:
                continue
            try:
                t = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            except ValueError:
                continue
            if t < since:
                continue
            model = msg.get("model") or "unknown"
            usd, toks = price_row(usage, model, pricing)
            total = sum(toks.values())
            totals["tokens"] += total
            totals["usd"] += usd
            if model.startswith(("claude-fable", "claude-mythos")):
                totals["fable_tokens"] += total
                totals["fable_usd"] += usd
    return totals


def share_str(part: float, whole: float) -> str:
    return f"{part / whole * 100:.1f}%" if whole else "n/a"


# ---------------------------------------------------------------- snapshots

def snapshot_path(session_id: str) -> Path:
    """Snapshots are machine-local ephemera — they live under ~/.claude, never inside
    a cloud-synced folder or the skills repo (sync + per-machine state is a reliable way to get
    conflicted copies)."""
    d = claude_home() / "usage-here"
    d.mkdir(parents=True, exist_ok=True)
    return d / f"{session_id}.json"


def write_snapshot(session_id: str, transcript: Path | None, opts: dict,
                   started_at: datetime | None = None) -> Path:
    """Record the instant the session started, plus any /usage reading taken then.

    Only the instant is stored — every 'since baseline' total is recomputed from
    the transcripts at report time, so the snapshot can't drift out of date.
    `started_at` overrides 'now' (used by --backdate to recover a missed baseline).
    """
    reading = {
        k: opts.get(k)
        for k in ("block_pct", "weekly_pct", "weekly_fable_pct")
        if opts.get(k) is not None
    }
    if opts.get("block_resets_in") is not None:
        reading["block_resets_in_minutes"] = int(opts["block_resets_in"].total_seconds() // 60)

    start = started_at or datetime.now(timezone.utc)
    payload = {
        "session_id": session_id,
        "transcript": str(transcript) if transcript else None,
        "started_at": start.isoformat(),
        "started_at_local": start.astimezone().strftime("%Y-%m-%d %H:%M %Z"),
        "backdated": started_at is not None,
        "usage_reading": reading or None,
    }
    p = snapshot_path(session_id)
    p.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return p


def first_timestamp(path: Path) -> datetime | None:
    """First message timestamp in a transcript — the session's true start."""
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            if '"timestamp"' not in line:
                continue
            try:
                ts = json.loads(line).get("timestamp")
                if ts:
                    return datetime.fromisoformat(ts.replace("Z", "+00:00"))
            except (json.JSONDecodeError, ValueError):
                continue
    return None


def read_snapshot(session_id: str) -> dict | None:
    p = snapshot_path(session_id)
    if not p.is_file():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def prune_snapshots(keep_days: int = 30) -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(days=keep_days)
    d = claude_home() / "usage-here"
    if not d.is_dir():
        return
    for p in d.glob("*.json"):
        try:
            if datetime.fromtimestamp(p.stat().st_mtime, timezone.utc) < cutoff:
                p.unlink()
        except OSError:
            pass


# ---------------------------------------------------------------- output

def fmt_tokens(n: int) -> str:
    if n >= 1_000_000:
        return f"{n / 1_000_000:.2f}M"
    if n >= 1_000:
        return f"{n / 1_000:.1f}k"
    return str(n)


def render(data: dict, limits: dict, pricing: dict, opts: dict) -> str:
    out: list[str] = []
    total_usd = data["total_usd"]
    by_model = data["by_model"]
    grand_tokens = sum(sum(e["toks"].values()) for e in by_model.values())

    out.append(f"Session transcript: {data['path']}")
    out.append("")
    out.append("## Cost by model (API list price)")
    out.append("")
    out.append("| Model | Calls | In | Cache write | Cache read | Out | Total tokens | % | USD |")
    out.append("|---|--:|--:|--:|--:|--:|--:|--:|--:|")
    for model, e in sorted(by_model.items(), key=lambda kv: -kv[1]["usd"]):
        t = e["toks"]
        tot = sum(t.values())
        share_pct = (e["usd"] / total_usd * 100) if total_usd else 0.0
        out.append(
            f"| {model} | {e['calls']} | {fmt_tokens(t['input'])} | "
            f"{fmt_tokens(t['cache_write_5m'] + t['cache_write_1h'])} | "
            f"{fmt_tokens(t['cache_read'])} | {fmt_tokens(t['output'])} | "
            f"{fmt_tokens(tot)} | {share_pct:.1f}% | ${e['usd']:.4f} |"
        )
    out.append(f"| **Total** | | | | | | **{fmt_tokens(grand_tokens)}** | 100% | **${total_usd:.4f}** |")
    if data["sidechain_usd"]:
        out.append("")
        out.append(f"Of which subagent (sidechain) calls: ${data['sidechain_usd']:.4f}")

    now = datetime.now(timezone.utc)
    now_local = datetime.now().astimezone()
    tl = data["timeline"]

    blk_start, blk_anchored = block_start(
        opts.get("block_resets_in"), limits.get("five_hour_block_hours") or 5, now
    )
    wk_start = week_start(limits, now_local)

    h5_tok, h5_usd = window_totals(tl, blk_start)
    acct5 = scan_all(blk_start, pricing)
    rows = [("5-hour block", h5_tok, h5_usd, acct5["tokens"], acct5["usd"], opts.get("block_pct"))]

    if wk_start:
        wk_tok, wk_usd = window_totals(tl, wk_start)
        acctw = scan_all(wk_start, pricing)
        rows.append(("Week (all models)", wk_tok, wk_usd, acctw["tokens"], acctw["usd"],
                     opts.get("weekly_pct")))
        fable_tok = sum(sum(e["toks"].values()) for m, e in by_model.items()
                        if m.startswith(("claude-fable", "claude-mythos")))
        fable_usd = sum(e["usd"] for m, e in by_model.items()
                        if m.startswith(("claude-fable", "claude-mythos")))
        rows.append(("Week (Fable-class)", fable_tok, fable_usd,
                     acctw["fable_tokens"], acctw["fable_usd"], opts.get("weekly_fable_pct")))

    out.append("")
    out.append("## Share of limits")
    out.append("")
    out.append("| Window | This session | All local sessions | Session's share | `/usage` says | ≈ attributable to this session |")
    out.append("|---|--:|--:|--:|--:|--:|")
    for name, s_tok, s_usd, a_tok, a_usd, reading in rows:
        frac = (s_tok / a_tok) if a_tok else 0.0
        attributed = f"~{reading * frac:.2f} pts of {reading}%" if reading is not None else "—"
        out.append(
            f"| {name} | {fmt_tokens(s_tok)} (${s_usd:.2f}) | {fmt_tokens(a_tok)} (${a_usd:.2f}) | "
            f"{share_str(s_tok, a_tok)} | {str(reading) + '%' if reading is not None else '—'} | {attributed} |"
        )

    out.append("")
    if blk_anchored:
        out.append(f"5-hour block anchored to the `/usage` reset time; block started "
                   f"{blk_start.astimezone():%H:%M}.")
    else:
        out.append("WARNING: 5-hour block treated as ROLLING (no --block-resets-in given). The real "
                   "limit is a fixed block, so this over-counts. Pass --block-resets-in 4h30m from `/usage`.")
    if wk_start:
        out.append(f"Week anchored to {limits.get('weekly_reset_weekday')} "
                   f"{limits.get('weekly_reset_hour_local')}:00 local; window started "
                   f"{wk_start.astimezone():%a %d %b %H:%M}.")
    else:
        out.append("WARNING: weekly window not anchored — set weekly_reset_weekday and "
                   "weekly_reset_hour_local in limits.json.")
    out.append("")
    out.append(
        "The last column is arithmetic on your own `/usage` reading — this session's share of "
        "local activity multiplied by the reported percentage — not a measured limit. It assumes "
        "Claude Code on THIS machine is all that consumed the limit in the window; other machines, "
        "Cowork, and claude.ai are invisible here, and each one makes this session's true share "
        "smaller than shown. `/usage` stays authoritative."
    )

    snap = opts.get("snapshot")
    if snap:
        try:
            base = datetime.fromisoformat(snap["started_at"])
        except (KeyError, ValueError):
            base = None
        if base:
            s_tok, s_usd = window_totals(tl, base)
            acct = scan_all(base, pricing)
            other_tok = max(acct["tokens"] - s_tok, 0)
            other_usd = max(acct["usd"] - s_usd, 0.0)
            elapsed = datetime.now(timezone.utc) - base

            out.append("")
            out.append("## Since this session started")
            out.append("")
            out.append(f"Baseline taken {snap.get('started_at_local', base.isoformat())} "
                       f"({int(elapsed.total_seconds() // 60)} min ago).")
            out.append("")
            out.append("| Source | Tokens | USD equiv | Share of local burn |")
            out.append("|---|--:|--:|--:|")
            out.append(f"| This session | {fmt_tokens(s_tok)} | ${s_usd:.2f} | "
                       f"{share_str(s_tok, acct['tokens'])} |")
            out.append(f"| Other local sessions | {fmt_tokens(other_tok)} | ${other_usd:.2f} | "
                       f"{share_str(other_tok, acct['tokens'])} |")
            out.append(f"| **All local Claude Code** | **{fmt_tokens(acct['tokens'])}** | "
                       f"**${acct['usd']:.2f}** | 100% |")

            # Two /usage readings bracket the interval, so the delta is a measured
            # consumption — far better calibration material than a single reading.
            before = (snap.get("usage_reading") or {})
            pairs = [
                ("5-hour block", "block_pct", opts.get("block_pct")),
                ("Weekly (all)", "weekly_pct", opts.get("weekly_pct")),
                ("Weekly (Fable)", "weekly_fable_pct", opts.get("weekly_fable_pct")),
            ]
            deltas = [(n, before[k], now_pct) for n, k, now_pct in pairs
                      if k in before and now_pct is not None]
            if deltas:
                out.append("")
                out.append("### Measured against `/usage` (baseline → now)")
                out.append("")
                out.append("| Limit | Then | Now | Δ | Local burn since baseline | Implied cost per 1% |")
                out.append("|---|--:|--:|--:|--:|--:|")
                for name, then, nowp in deltas:
                    d = nowp - then
                    per_pt = (
                        f"{fmt_tokens(int(acct['tokens'] / d))} / ${acct['usd'] / d:.2f}"
                        if d > 0 and acct["tokens"] > 0
                        else "—"
                    )
                    out.append(f"| {name} | {then}% | {nowp}% | {d:+.0f} pts | "
                               f"{fmt_tokens(acct['tokens'])} (${acct['usd']:.2f}) | {per_pt} |")
                out.append("")
                out.append(
                    "A Δ across a bracketed interval is real calibration material — unlike a single "
                    "low reading — but it is only trustworthy when this PC was the sole active client "
                    "for the whole interval AND the block did not reset mid-interval. Both readings "
                    "must also come from the same block: if the 5-hour figure went DOWN, it reset and "
                    "that row is meaningless. Record a clean pair in limits.json before trusting it."
                )
        else:
            out.append("")
            out.append("(Snapshot file found but unreadable — ignoring baseline.)")
    else:
        out.append("")
        out.append("No session-start snapshot found. `session-start` / `call-handoff` should take one; "
                   "without it there is no baseline, so 'other sessions since you began' can't be split out.")

    out.append("")
    out.append("## Three most expensive prompts")
    out.append("")
    top = sorted(data["prompts"], key=lambda p: -p["usd"])[:3]
    if not top:
        out.append("(no user prompts recorded)")
    else:
        out.append("| # | Prompt | Tokens | USD | % of session |")
        out.append("|--:|---|--:|--:|--:|")
        for i, p in enumerate(top, 1):
            share = (p["usd"] / total_usd * 100) if total_usd else 0.0
            out.append(
                f"| {i} | {p['label']} | {fmt_tokens(p['tokens'])} | ${p['usd']:.4f} | {share:.1f}% |"
            )
    return "\n".join(out)


def main() -> None:
    # Windows consoles default to cp1252 and mangle the em-dashes/ellipses below.
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

    ap = argparse.ArgumentParser()
    ap.add_argument("--session-id")
    ap.add_argument("--transcript")
    ap.add_argument("--cwd", default=os.getcwd())
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--block-resets-in", type=parse_duration, metavar="4h30m",
                    help="time until the 5-hour block resets, from /usage — anchors the "
                         "block window instead of treating it as rolling")
    ap.add_argument("--block-pct", type=float, metavar="N",
                    help="the 5-hour percentage /usage reports right now")
    ap.add_argument("--weekly-pct", type=float, metavar="N",
                    help="the weekly all-models percentage /usage reports right now")
    ap.add_argument("--weekly-fable-pct", type=float, metavar="N",
                    help="the weekly Fable percentage /usage reports right now")
    ap.add_argument("--snapshot", action="store_true",
                    help="record this instant as the session's baseline and exit "
                         "(run once at session start)")
    ap.add_argument("--backdate", action="store_true",
                    help="with --snapshot: use the transcript's first timestamp as the "
                         "baseline instead of now (recovers a missed session-start snapshot)")
    args = ap.parse_args()

    opts = {
        "block_resets_in": args.block_resets_in,
        "block_pct": args.block_pct,
        "weekly_pct": args.weekly_pct,
        "weekly_fable_pct": args.weekly_fable_pct,
    }

    pricing = load_json("pricing.json")
    limits = load_json("limits.json")

    # Session identity: explicit flag > the harness's own env var > transcript stem.
    # The env var matters — at session start "newest transcript by mtime" can be a
    # DIFFERENT session whose file was written more recently (this session's own
    # JSONL may not be flushed yet), which mis-keys the snapshot.
    session_id = (args.session_id
                  or os.environ.get("CLAUDE_CODE_SESSION_ID")
                  or os.environ.get("CLAUDE_SESSION_ID"))
    try:
        path = find_transcript(session_id, args.transcript, Path(args.cwd))
    except SystemExit:
        # First turn of a session: the transcript may not exist on disk yet. A
        # snapshot only records the instant, so it is still valid to take one.
        if args.snapshot and session_id and not args.backdate:
            path = None
        else:
            raise
    if session_id is None:
        session_id = path.stem

    if args.snapshot:
        prune_snapshots()
        started = None
        if args.backdate:
            started = first_timestamp(path)
            if started is None:
                sys.exit(f"--backdate: no timestamps found in {path}")
        p = write_snapshot(session_id, path, opts, started_at=started)
        reading = "with /usage reading" if any(
            opts.get(k) is not None for k in ("block_pct", "weekly_pct", "weekly_fable_pct")
        ) else "no /usage reading (pass --block-pct/--weekly-pct to enable Δ calibration later)"
        print(f"Usage baseline recorded for session {session_id[:8]} — {reading}. [{p}]")
        return

    opts["snapshot"] = read_snapshot(session_id)
    data = parse(path, pricing)

    if args.json:
        payload = {
            "transcript": str(path),
            "total_usd": round(data["total_usd"], 6),
            "sidechain_usd": round(data["sidechain_usd"], 6),
            "by_model": {
                m: {"usd": round(e["usd"], 6), "calls": e["calls"], "tokens": dict(e["toks"])}
                for m, e in data["by_model"].items()
            },
            "top_prompts": sorted(data["prompts"], key=lambda p: -p["usd"])[:3],
        }
        print(json.dumps(payload, indent=2))
    else:
        print(render(data, limits, pricing, opts))


if __name__ == "__main__":
    main()
