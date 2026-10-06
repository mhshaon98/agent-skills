---
name: call-handoff
description: Cold-start briefing from the project's newest handoff, open bugs and next-session prompt in two round-trips, then stop. Use at session start or on "call handoff", "catch up", "where did we leave off".
---

# Call Handoff — token-efficient cold start

Goal: **one pass, ≤2 tool round-trips to the briefing** (+ the Step-3 title pass),
know what the project is, where the last session stopped, what is open, what must not
break — brief the user, fix session titles, then stop. This is the single session-start
ritual (the `session-start` skill is a stub that points here): orientation only, with
the code read later, once a task is chosen (last section).

## Budget

- Every round-trip re-reads the session's entire fixed context (tens of k tokens), so
  batching is the saving. Target: the one-shot script below + at most one
  follow-up Read (a >600-line handoff sliced, or one superseded handoff the newest one
  explicitly defers to) + the Step-3 title pass (one `list_sessions` + one batched
  rename message).
- **No codebase exploration.** No directory walks, no grep sweeps, no source files, no
  subagents. The handoff is the index; code gets read later, when a task is chosen.
- The project's `CLAUDE.md` and memory are already auto-loaded into context, so a
  re-read spends a round-trip on nothing. Skim what's in context instead.

## Step 1 — the one-shot script (single Bash call; Git Bash works on Windows)

Set `S` to the local clone of your skills repo if you keep one in git (leave it empty
to skip the sync block).

```bash
S="${SKILLS_REPO:-}"; echo "=== SKILLS SYNC (${S:-none configured})"
if [ -n "$S" ] && [ -d "$S/.git" ]; then D=$(git -C "$S" status --porcelain=v1 | head -3); if [ -n "$D" ]; then echo "DIRTY skills clone - not pulling:"; echo "$D"; else B=$(git -C "$S" rev-parse HEAD); git -C "$S" pull --ff-only 2>&1 | tail -1; git -C "$S" diff --name-only "$B" HEAD | grep -qE '^(skills|agents|hooks)/' && echo "SKILLS CHANGED -> re-install needed"; fi; git -C "$S" log -1 --format='skills @ %h %ad %s' --date=short; git -C "$S" status -sb | head -1
elif [ -n "$S" ]; then echo "NO CLONE at $S - clone your skills repo there first"; fi
echo "=== ENTRY POINT?"; if [ -z "$(find . docs handoffs -maxdepth 1 -name 'HANDOFF-*.md' 2>/dev/null | head -1)" ] && [ ! -d .git ] && ! grep -q '^## Topic table' CLAUDE.md 2>/dev/null; then for P in WHERE-IS-THE-CODE.md CLAUDE.md; do [ -f "$P" ] || continue; T=$(grep -oE '([A-Za-z]:[\/]|~/)[^`"<>|*?]+' "$P" | head -1 | tr '\134' '/' | sed -e "s|^~|$HOME|" -e 's|[[:space:]]*$||' | awk '{ if (match($0, /^[A-Za-z]:/)) $0 = "/" tolower(substr($0, 1, 1)) substr($0, 3); print }'); [ -n "$T" ] && [ -d "$T" ] && { echo "pointer $P -> $T (cd there; this folder is the entry point only)"; cd "$T" || true; break; }; done; fi; pwd
echo "=== PROJECT SYNC"; if git remote get-url origin >/dev/null 2>&1; then if [ -z "$(git status --porcelain=v1 -uno)" ]; then git pull --ff-only 2>&1 | tail -1; else echo "dirty tree - not pulling"; fi; git status -sb | head -1; else echo "no remote"; fi
if [ -d handoffs ] && grep -q '^## Topic table' CLAUDE.md 2>/dev/null; then echo "=== LAYERED HANDOFFS (router = CLAUDE.md topic table, already in context - read ONE topic file)"; find handoffs -maxdepth 1 -name '*.md' 2>/dev/null | sort | while read -r f; do echo "$f · $(grep -m1 -i '^Last updated' "$f")"; done
else
HL=$(find . docs handoffs -maxdepth 1 -name 'HANDOFF-*.md' 2>/dev/null | while read -r f; do printf '%s|%s\n' "$(basename "$f")" "$f"; done | sort)
H=$(printf '%s\n' "$HL" | tail -1 | cut -d'|' -f2)
echo "=== NEWEST HANDOFF: ${H:-NONE} · prior: $(printf '%s\n' "$HL" | tail -3 | head -2 | cut -d'|' -f2 | tr '\n' ' ')"
[ -n "$H" ] && sed -n '1,600p' "$H"; fi
echo "=== RECENCY"; git log --oneline -5 2>/dev/null; git status --porcelain=v1 -uno 2>/dev/null | head -10; ls -t | head -8
echo "=== OPEN BUGS"; [ -f BUG_LIST.md ] && grep -n "^## \|Status:" BUG_LIST.md | head -40 || echo "no BUG_LIST.md"
echo "=== NEXT SESSION PROMPT"; [ -f NEXT-SESSION-PROMPT.md ] && cat NEXT-SESSION-PROMPT.md || echo "none"
```

Optional final line, if you use the `usage-here` skill — it records a usage baseline
for the session so a later report can isolate this session's burn:

```bash
echo "=== USAGE BASELINE"; "$(command -v python3 || command -v python)" "$HOME/.claude/skills/usage-here/usage_report.py" --snapshot
```

## Step 2 — reconcile and (rarely) follow up

- **Sync lines first.** `SKILLS CHANGED` ⇒ the installed copies under `~/.claude/skills`
  are stale: re-run your install step from the clone in one Bash call of its own and
  report its last lines. `DIRTY skills clone` or `ahead` in the status line ⇒ a previous
  session on THIS machine left work uncommitted/unpushed: say so in the briefing (it is
  invisible to other machines) and offer `update-handoff` to finish it. `NO CLONE` ⇒
  tell the user to clone the repo and stop. A pull that fails (offline, diverged) is
  reported, never retried with force.

- **`NEXT-SESSION-PROMPT.md`** (written by `update-handoff`) is the fastest
  orientation: if its date matches or post-dates the newest handoff, build the
  briefing around it. If it's OLDER than the handoff or the latest commits, it's
  stale — say so and trust the handoff instead (on any conflict the handoff wins).
- Commits or mtimes post-dating the handoff's date ⇒ handoff is **STALE** — say so in
  the briefing and treat git/files as truth.
- Bug entries: read in full only open/reopened ones (one targeted Read if the grep
  headers aren't enough). A ✅ entry matching a fresh symptom ⇒ suspect regression.
- Script printed `pointer …` or `LAYERED HANDOFFS`? Read this skill's
  `references/layouts.md` before the briefing (one extra Read that only these two
  layouts pay).
- **Flat handoff juggling several independent issues** (≥2 unrelated threads — different
  devices, vendors, customer contacts, or source folders — each with its own TODO)?
  Mention once in the briefing that `update-handoff` can split it into layered topic files.
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

## When a task is chosen (the rest of the old session-start ritual)

- Restate the goal in 1–2 sentences, with constraints and what must not break. State
  assumptions and proceed; ask only when truly blocked.
- Inspect before changing: read the files, data shapes and current behaviour the task touches; the handoff is an index, not a guarantee.
- Skim your project's lessons / anti-patterns file (if you keep one) for the sections on today's stack.
- Keep phases separate: Understand → Plan → Build → Verify → Hand off.
- Once per project, if it spawns OS processes, runs a daemon, ships a container or runs untrusted code: confirm PID/memory caps exist (`security-pass`, runtime section). Skip if the handoff already records them.
