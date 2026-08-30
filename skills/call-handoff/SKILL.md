---
name: call-handoff
description: Cold-start a session from the project's newest handoff in a strict token budget. Use at session start or when the user says "call handoff", "catch up", or "where did we leave off" — reads the newest HANDOFF-*.md, open bugs, and project docs, reports a briefing, fixes generic session titles, and stops.
---

# Call Handoff — token-efficient cold start

Goal: **one pass, ≤2 tool round-trips to the briefing** (+ the Step-3 title pass),
know what the project is, where the last session stopped, what is open, what must not
break — brief the user, fix session titles, then stop. This is orientation only;
`session-start` is the fuller ritual. Never run both.

## Hard budget (this is the whole point)

- **Every round-trip re-reads the session's entire fixed context (tens of k tokens), so
  batching IS the efficiency.** Target: the one-shot script below + at most one
  follow-up Read (a >600-line handoff sliced, or one superseded handoff the newest one
  explicitly defers to) + the Step-3 title pass (one `list_sessions` + one batched
  rename message).
- **No codebase exploration.** No directory walks, no grep sweeps, no source files, no
  subagents. The handoff is the index; code gets read later, when a task is chosen.
- **The project's `CLAUDE.md` and memory are ALREADY auto-loaded into context — never
  re-read them.** Skim what's in context instead.

## Step 1 — the one-shot script (single Bash call; Git Bash works on Windows)

```bash
HL=$(find . docs handoffs -maxdepth 1 -name 'HANDOFF-*.md' 2>/dev/null | awk -F/ '{print $NF "|" $0}' | sort)
H=$(printf '%s\n' "$HL" | tail -1 | cut -d'|' -f2)
echo "=== NEWEST HANDOFF: ${H:-NONE} · prior: $(printf '%s\n' "$HL" | tail -3 | head -2 | cut -d'|' -f2 | tr '\n' ' ')"
[ -n "$H" ] && sed -n '1,600p' "$H"
echo "=== RECENCY"; git log --oneline -5 2>/dev/null; git status --porcelain=v1 -uno 2>/dev/null | head -10; ls -t | head -8
echo "=== OPEN BUGS"; [ -f BUG_LIST.md ] && grep -n "^## \|Status:" BUG_LIST.md | head -40 || echo "no BUG_LIST.md"
echo "=== NEXT SESSION PROMPT"; [ -f NEXT-SESSION-PROMPT.md ] && cat NEXT-SESSION-PROMPT.md || echo "none"
```

Optional final line, if you use the `usage-here` skill — it records a usage baseline
for the session so a later report can isolate this session's burn:

```bash
echo "=== USAGE BASELINE"; python "$HOME/.claude/skills/usage-here/usage_report.py" --snapshot
```

## Step 2 — reconcile and (rarely) follow up

- **`NEXT-SESSION-PROMPT.md`** (written by `update-handoff`) is the fastest
  orientation: if its date matches or post-dates the newest handoff, build the
  briefing around it. If it's OLDER than the handoff or the latest commits, it's
  stale — say so and trust the handoff instead (on any conflict the handoff wins).
- Commits or mtimes post-dating the handoff's date ⇒ handoff is **STALE** — say so in
  the briefing and treat git/files as truth.
- Bug entries: read in full only open/reopened ones (one targeted Read if the grep
  headers aren't enough). A ✅ entry matching a fresh symptom ⇒ suspect regression.
- **No handoff at all?** The script output already shows it: orient from `README.md`
  (one Read) + the git log, say plainly there is no handoff, note one must be created
  before session end (`update-handoff` skill).

## Output — the briefing (≤200 words; then Step 3, then STOP)

- **Project:** 1–2 sentences. · **Last session (date, source file):** what landed.
- **Freshness:** current, or stale vs. git (evidence).
- **Open now:** unfinished work, open bugs, NOT-verified items.
- **Highest-value next item.** · **Dead paths / must-not-break** (constraints, not
  suggestions). · **Session title:** `<topic> · <YYYY-MM-DD>` (see Step 3).
- **Ready — what do you want to work on?**

## Step 3 — session-title hygiene (desktop app only; skip in the plain CLI)

*Requires the desktop app's `ccd_session_mgmt` MCP tools. If they aren't available,
skip this whole step silently.*

Skill-started sessions all get auto-titled "Call handoff", making the session list
unsortable. `mcp__ccd_session_mgmt__set_session_title` renames the CURRENT session
too — pass `session_id: "self"`.

Every title — suggested or applied — is `<topic> · <YYYY-MM-DD>` (no project name, if
the session list is already grouped by project). A bare `<project> · <date>` with no
topic is a last resort, not a format.

1. Rename THIS session via `set_session_title` with `session_id: "self"`:
   `<topic> · <today>` — topic from NEXT-SESSION-PROMPT.md's Goal / the handoff's
   highest-value next item, ≤6 words. State the applied title in the briefing.
2. Call `mcp__ccd_session_mgmt__list_sessions` once, then in ONE batched message
   `set_session_title` every OTHER session still carrying a generic skill title
   ("Call handoff", "Session start", "Update handoff", …). Date = lastActivityAt.
   Topic sources, cheapest first:
   - same project → what the script already printed (no new Reads);
   - other projects → ONE extra batched Bash call heading each cwd's
     `NEXT-SESSION-PROMPT.md` Goal line, else its newest `HANDOFF-*.md` Goal/headline;
     only if neither exists, fall back to `<project> · <date>` (the one case the
     project name earns its place).
   Never rename a session that already has a meaningful title.
3. Tools unavailable (plain CLI / MCP not connected)? Skip the renames silently — the
   printed title line is the fallback.

No editing, fixing, or "head starts" off the briefing — the last session's TODOs are a
proposal, not authorization. Rules that persist into the session: rejected alternatives
are dead paths; "don't regress" notes are binding; NOT-verified stays not-verified
until this session actually runs it; update the handoff DURING the session as work
lands (`update-handoff` skill).
