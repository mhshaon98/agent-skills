---
name: usage-here
description: Report what THIS session has cost — tokens and dollars by model, share of the 5-hour and weekly limits, and the three most expensive prompts. Use whenever the user says "usage here", "what did this session cost", "how much have I burned", "token usage", or asks about limits mid-session.
context: fork
background: true
model: sonnet
---

# Usage Here — what this session cost

Reports **this one session**, computed by script from the session's own JSONL. Never
estimate or eyeball token counts yourself. Session burn is fixed context times
round-trips, and that fixed context is mostly invisible overhead rather than the work —
the driver sits in the cache-read column, which no eyeball estimate ever finds.

**You are running as a forked background subagent on Sonnet** (frontmatter: `context:
fork`, `background: true`, `model: sonnet` — requires Claude Code ≥ 2.1.218; older
versions run it inline, which is fine). Report on the **parent session**, not your own
fork: no args picks the newest session transcript for this cwd, which is the parent —
if ambiguous, pass `--session-id` with the UUID from the scratchpad path. Your final
message IS the report posted to chat — emit the full markdown, self-contained.

## Run

```bash
"$(command -v python3 || command -v python)" "$HOME/.claude/skills/usage-here/usage_report.py"
```

(PowerShell: `python "$env:USERPROFILE\.claude\skills\usage-here\usage_report.py"`.)
No args needed: the script resolves the session from `CLAUDE_CODE_SESSION_ID` in the
environment (falls back to newest transcript for the cwd — **run from the project
root, not the skill folder**). Flags: `--session-id <uuid>`, `--transcript <path>`,
`--cwd <dir>`, `--json`.

**A `/usage` reading makes the block anchor correct.** As a background fork you cannot
stop to ask for one: if the invocation args include a reading, pass its flags; otherwise
run without, let the script print its rolling-window warning, and end the report with
one line inviting the user to re-run with a `/usage` reading for anchored numbers:

```bash
python3 usage_report.py --block-resets-in 4h30m --block-pct 1 --weekly-pct 44 --weekly-fable-pct 36
```

Paste the emitted markdown tables as-is; add ≤2 lines of commentary (biggest cost
driver + anything anomalous).

## What it measures

- **Cost by model** at Anthropic API list price. Cache writes bill 1.25× input (5-min
  TTL) or 2× (1-hour); reads 0.1× — the script reads each message's `cache_creation`
  split, so both TTLs price correctly.
- **Share of limits** — **the limits are fixed blocks anchored to reset instants, never
  rolling windows** (the 5h block starts at `/usage`'s "resets in"; the weekly anchor —
  Thu 19:00 local — lives in `limits.json`). Without `--block-resets-in` it falls back
  to rolling and prints a warning; rolling over-counts.
- **Since this session started** — needs the session-start `--snapshot` baseline;
  splits burn into this session vs other local sessions. Two bracketing `/usage`
  readings additionally give a measured Δ in percentage points.
- **Top 3 prompts** by cost.

## The session-start snapshot

At the top of a session (`session-start` step 5 / `call-handoff` script):

```bash
"$(command -v python3 || command -v python)" "$HOME/.claude/skills/usage-here/usage_report.py" --snapshot
```

Add the `/usage` flags when a reading is on screen. The snapshot stores **only the
instant** in `~/.claude/usage-here/<session-id>.json` (machine-local — never inside a
cloud-synced folder or your skills repo — pruned at 30 days); all totals are recomputed from transcripts at
report time, so it cannot drift. Re-running `--snapshot` mid-session overwrites the
baseline (valid for measuring one stretch, but discards the original start). It keys
on `CLAUDE_CODE_SESSION_ID`, so it works even before the session's transcript is
flushed to disk. **Missed the session-start snapshot?** `--snapshot --backdate` sets
the baseline to the transcript's first timestamp — the true session start.

## Honesty rules — state these, don't bury them

1. **The dollar figure is API-equivalent list price, not a bill** — a Claude
   subscription already covers these prompts. Say so.
2. The report covers up to the last completed assistant turn; the reporting turn
   itself isn't in it.
3. **Percentages are this session's share of LOCAL activity only.** Other machines,
   Cowork, and claude.ai draw the same limits invisibly; `/usage` is the only
   account-wide truth. The attributable-% column is arithmetic (local share × the
   supplied reading), not measurement — every invisible client makes the real share
   smaller.
4. **`limits.json` absolute budgets are `null` on purpose — never fill them from a low
   `/usage` reading.** A 1% reading carries ±50% rounding error and the candidate
   units disagreed >3× (logged under `observations` in that file). A usable
   calibration needs: block 20–40% used, this PC the only active client, `/usage` and
   the script run over the same anchored window, and a second reading on another day
   agreeing on the same unit before anything is recorded. A guessed denominator is
   worse than honest dashes.
5. Cowork and claude.ai sessions have no local transcript — this skill only works in
   Claude Code; say so and point at `/usage`.

## Pricing maintenance

`pricing.json` holds per-model rates and the cache multipliers. Unknown model IDs fall
back to Opus-tier rates — add missing models rather than trust the fallback. When prices
change, update `pricing.json` only; nothing else hard-codes a rate.
