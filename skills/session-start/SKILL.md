---
name: session-start
description: Use at the start of ANY work session on a project — before reading code or making changes — and when joining an unfamiliar or legacy project. Runs the startup ritual — newest handoff, bug ledger, project docs — then restates the goal.
---

# Session Start Ritual

Orient before touching anything. Takes ~2 minutes and prevents re-testing dead
approaches, regressing user-iterated designs, and debugging known bugs from scratch.

## Steps

1. **Find and read the newest `HANDOFF-*.md`** at the project root (filename format
   `HANDOFF-YYYY-MM-DD-HHMM.md`). It is the source of truth for project state.
   - If its date looks stale vs. `git log` or file mtimes, say so and reconcile.
   - **If no handoff exists** (first session or legacy project): orient from
     README/code instead, and create the first handoff before the session ends
     (use the `update-handoff` skill).
2. **Read the project's own `CLAUDE.md` / `README.md`** if present.
3. **Read `BUG_LIST.md`** at the repo root — the cumulative bug ledger. Note which
   areas are historically bug-prone. Do not create an empty one preemptively; the
   `bug-ledger` skill creates it when the first bug appears.
4. **Inspect before changing.** Look at the actual files, data shapes, and current
   behavior relevant to today's task. Never assume the handoff is complete.
5. **Take a usage baseline** (optional — if you use the `usage-here` skill). One
   command, one line of output; it records the instant the session began so a later
   report can separate this session's burn from other sessions sharing the same
   rate-limit window:

   ```bash
   python "$HOME/.claude/skills/usage-here/usage_report.py" --snapshot
   ```
6. **Restate the goal** to the user in 1–2 sentences, including constraints and what
   must NOT break. State any assumptions explicitly and proceed — ask clarifying
   questions only when truly blocked.

## Rules that apply from here on

- Rejected alternatives recorded in handoffs are **dead paths** — do not re-test them.
- "Don't regress" notes on UI designs are binding.
- Keep the handoff updated DURING the session as work lands, not only at the end.
- **Runtime resource-exhaustion check** (once per project): if this project spawns OS
  processes, runs a long-running service/daemon, ships a container/compose/k8s surface,
  or runs untrusted code, confirm it has PID/memory caps; if not, apply the additive
  repo-local guards and flag the rest (see the `security-pass` skill).
  Static sites, single-file scripts with no spawning, pure libraries, plain client apps
  → skip. Don't re-flag a project whose handoff already records the caps live at the
  host/orchestrator.

## Keep the phases separate

Understand → Plan → Build → Verify → Hand off. Don't edit while you're still
discovering; don't claim success while you're still building. If you keep a personal
lessons/anti-patterns file, skim the sections relevant to today's stack here.
