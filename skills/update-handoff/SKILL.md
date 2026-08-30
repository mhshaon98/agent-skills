---
name: update-handoff
description: End-of-session wrap-up in one efficient pass — updates the handoff, memory, changelog, and bug ledger as needed, and writes NEXT-SESSION-PROMPT.md so the next session starts instantly. Use when the user says "update handoff", "wrap up", "end the session", or before context runs out.
---

# Update Handoff — end-of-session wrap in one pass

Closes out a session: handoff + retrospective + memory + a paste-ready prompt for the
next session. **Efficiency rule: ≤3 tool round-trips** — one gather script, then ALL
file writes batched in one parallel message. Most of what goes into these files is
already in this session's context; never re-read files this session wrote or discussed.

## Step 1 — gather (single Bash call)

```bash
date "+NOW: %Y-%m-%d %H%M"
H=$(ls -1 HANDOFF-*.md 2>/dev/null | sort | tail -1); echo "CURRENT HANDOFF: ${H:-NONE}"
git status --porcelain=v1 2>/dev/null | head -20; git log --oneline -8 2>/dev/null || ls -t | head -10
```

## Step 2 — decide what needs updating (write nothing yet)

- **Handoff**: if the newest handoff is from THIS session, edit it in place; otherwise
  create `HANDOFF-YYYY-MM-DD-HHMM.md` at the project root using this skeleton — what
  the project is → current state → what this session did → decisions + **rejected
  alternatives with evidence** → **Verified / NOT-verified ledgers** → known issues →
  ordered TODO → retrospective → how to run. Add a "supersedes" line naming the
  previous handoff; keep the old ones. **No secrets** (these files are long-lived and
  often synced — reference keys by name); every relative date converted to absolute.
- **Retrospective**: a new gotcha → a dated entry in whatever lessons file you keep;
  a default that got beaten → edit that guidance in place; a rule that turned out wrong
  → fix it. Bar for promoting a lesson: durable, verified in real work, generalizable,
  still true in six months.
- **Memory**: cross-session lessons → your assistant's memory files (one fact per file
  plus an index line). Reference from the handoff, don't duplicate into it.
- **`BUG_LIST.md`**: update entries for any bug fixed or reopened this session.
- **`NEXT-SESSION-PROMPT.md`** (project root — ALWAYS written, OVERWRITE the old one;
  one file, never dated copies):

  ```markdown
  # Next Session Prompt — YYYY-MM-DD HH:MM
  <paste-ready prompt, ≤250 words, addressed to the next Claude:>
  - Goal (1–2 sentences) and the immediate next action(s)
  - State: done/verified vs NOT verified (be honest)
  - Constraints, must-not-break, dead paths
  - Files worth reading first (usually just handoff section names)
  - Recommended model tier for the next session's work
  ```

  The prompt file is the "do this next" card; the handoff is the full state. They must
  not contradict — **on any conflict the handoff wins**, and `call-handoff` reads both.

## Step 3 — write everything in ONE parallel batch

All Write/Edit calls in the same message (handoff, prompt file, changelog, memory,
ledger — whichever apply). Then confirm in one line per file, and report honestly
anything NOT updated and why. If your lessons store isn't writable from here, put the
lessons in the handoff marked "PROMOTE TO LESSONS".

## Step 4 — closing checklist (each one done, or say why not)

- [ ] **Lessons committed in the same pass** — not left uncommitted in the working tree
      for the next session to trip over.
- [ ] Handoff, `NEXT-SESSION-PROMPT.md`, and `BUG_LIST.md` agree with each other.
- [ ] No secrets in anything written; every relative date converted to absolute.

Never end with a stale prompt file: even a no-changes wrap refreshes its date and state
line, so `call-handoff` can trust it blindly. And leave the project clean: working tree
committed or clearly described, no leftover test data (`test…`/`sample…`/`dummy…`
rows), no half-applied changes, no `_v2`/`_final` duplicate files.
