---
name: update-handoff
description: 'End-of-session wrap in one pass: a detailed holistic handoff (this session plus every linked session and worktree), lessons, memory, bug ledger and NEXT-SESSION-PROMPT.md. Use on "update handoff", "wrap up", "end the session", or before context runs out.'
---

# Update Handoff — end-of-session wrap in one pass

Closes out a session: handoff + retrospective + memory + a paste-ready prompt for the
next session. **Efficiency rule: ≤3 tool round-trips** — one gather script, then ALL
file writes batched in one parallel message. Efficiency means few round-trips, never a
thin handoff: completeness of the handoff outranks its length. Most of what goes into these files is
already in this session's context; never re-read files this session wrote or discussed.

## Step 1 — gather (single Bash call)

```bash
date "+NOW: %Y-%m-%d %H%M"
if [ ! -d .git ] && [ -f WHERE-IS-THE-CODE.md ]; then T=$(grep -oE '([A-Za-z]:[\/]|~/)[^`"<>|*?]+' WHERE-IS-THE-CODE.md | head -1 | tr '\134' '/' | sed -e "s|^~|$HOME|" -e 's|[[:space:]]*$||' | awk '{ if (match($0, /^[A-Za-z]:/)) $0 = "/" tolower(substr($0, 1, 1)) substr($0, 3); print }'); [ -d "$T" ] && { echo "ENTRY POINT -> writing into $T"; cd "$T"; }; fi; pwd
if [ -d handoffs ] && grep -q '^## Topic table' CLAUDE.md 2>/dev/null; then echo "LAYERED: topic files:"; find handoffs -maxdepth 1 -name '*.md' 2>/dev/null | sort; else H=$(find . -maxdepth 1 -name 'HANDOFF-*.md' 2>/dev/null | sed 's|^\./||' | sort | tail -1); echo "CURRENT HANDOFF: ${H:-NONE}"; fi
git status --porcelain=v1 2>/dev/null | head -20; git log --oneline -8 2>/dev/null || ls -t | head -10
echo "WORKTREES:"; git worktree list 2>/dev/null; git for-each-ref --format='%(refname:short) %(upstream:track)' refs/heads 2>/dev/null | head -30
[ -n "${SKILLS_REPO:-}" ] && { echo "SKILLS CLONE:"; git -C "$SKILLS_REPO" status -sb 2>/dev/null | head -1; git -C "$SKILLS_REPO" status --porcelain=v1 2>/dev/null | head -10; }
```

## Step 1b — context sweep (ALWAYS; this is what makes the handoff detailed)

Detailed is the default; the user should never have to ask for "detailed". The handoff
is the only thing that survives this context window, so before writing anything walk the
WHOLE session, oldest to newest (including anything summarised by compaction), and list
every:

- **Request** the user made, including mid-turn asides and side tasks ("on the side…",
  "also can you…"): done / partly done / not started / dropped, and why.
- **Change**: every file created, edited or deleted (path + one line of why), every
  commit hash and push (which repo, which branch), every installer or script run.
- **Decision** and **rejected alternative**, with the evidence that decided it.
- **Exact facts** the next session would otherwise have to rediscover: paths, URLs, IDs,
  versions, commands that worked, error messages verbatim, numbers measured.
- **In-flight work**: background agents or jobs still running or whose results were not
  yet acted on, questions asked and not answered, approvals pending, where a multi-step
  task stopped (the exact next step, not "continue").
- **Preferences and rules** the user stated this session (also to memory if durable).
- **Verified vs NOT-verified**: what actually ran versus what was only written.

Then write it ALL down. Depth scales with the session, not with a word budget: a short
session gets a short handoff; a long, high-context one gets a long handoff organised by
**workstream** (one sub-section per independent thread under "what this session did",
each with its own state, files, commits, decisions and exact next step), plus a
**requests ledger** table (# · request · status · where it landed / why not) and an
**in flight at wrap** list. Prefer exact detail over summary. Before writing, tick the
list off against the draft: every item is in the handoff or consciously dropped as
trivial. If the session is huge, write the handoff FIRST (before lessons and memory) so
a context limit mid-wrap cannot lose it.

## Step 1c — linked sessions and worktrees sweep (ALWAYS when any exist)

The handoff is holistic: it covers every session and worktree working on this project,
not just this one. Skip the session part when the `ccd_session_mgmt` tools are missing
(plain CLI), but still do the worktree part.

- **Side session?** In parallel with the Step 1 gather, call
  `mcp__ccd_session_mgmt__get_session` with `"self"`. If it shows a `parentSessionId`,
  ask the user once: "report-back to the main session, or write a full handoff?" Default
  to `report-back`; the parent owns the holistic handoff.
- **Reuse**: if `collect-reports` ran in this session and nothing has changed since,
  reuse its board and its git checks. If reports are missing and the user wants them
  fresh, run `collect-reports` first.
- **Otherwise**, also in parallel with the Step 1 gather, call
  `mcp__ccd_session_mgmt__list_sessions` with `{"linked": true, "include_archived":
  true, "limit": 50}`. That gives the forks, the sessions this one started, and their
  children; the current session is not in the list. For each linked session:
  - **State**: running / idle / archived, title, last activity. RUNNING means not done:
    record what it is doing, and do NOT wait for it unless the user asked. Never predict
    its result.
  - **Its last report**: look first at the `<side-sessions-event>` notes,
    cross-session messages and subagent hand-backs already in this context, then at
    the shared notes folder if the system prompt names one. Failing those, call
    `mcp__ccd_session_mgmt__list_events` (limit ~15) and read its last wrap-up recap
    and final message. (`get_session` gives only metadata: worktree, branch and state.)
  - **Its code**: the worktree paths come from the session calls, so this is a second
    round-trip, with one Bash call covering all worktrees. Run `git -C <wt> status -sb`,
    then `git log --oneline <base>..<branch>` for unmerged commits, then check whether
    it is pushed. Base is the branch the worktree was cut from; if that is unknown, use
    `git symbolic-ref refs/remotes/origin/HEAD`. A report is a claim, so check the
    branch before writing "done".
- **Background work in this session**: running Bash jobs, subagents and workflows.
- **Orphan worktrees**: list every `git worktree list` entry with no live session.
  Merged and clean means "safe to delete (ask the user)". Unmerged or dirty means a TODO.

Write all of this into the handoff as a **"Linked sessions & worktrees"** section,
under §2 Current state. Use one table row per session or worktree, with these columns:

- session, as a `[title](#local_…)` link
- branch / worktree path
- state
- merged into what
- pushed?
- last reported result
- next step / owner

Below the table, list the decisions those sessions got from the user and anything they
need from the user. Their open items also go into the ordered TODO.

## Step 2 — decide what needs updating (write nothing yet)

- **Entry-point folder?** If the gather printed `ENTRY POINT -> ...`, every file below is
  written into THAT clone (never into the pointer folder), and the project push happens there.
- **Handoff**: if the newest handoff is from THIS session, edit it in place; otherwise
  create `HANDOFF-YYYY-MM-DD-HHMM.md` at the project root using this skeleton — what
  the project is → current state → what this session did → decisions + **rejected
  alternatives with evidence** (one **decision record** per architectural choice —
  Decision · Alternatives rejected · Evidence · Date) → **Verified / NOT-verified ledgers** → known issues →
  ordered TODO → retrospective → how to run. Add a "supersedes" line naming the
  previous handoff; keep the old ones. **No secrets** (these files are long-lived and
  often synced — reference keys by name); every relative date converted to absolute.
- Gather printed `LAYERED`, or the handoff is juggling two or more unrelated issues?
  Read this skill's `references/layered.md`.
- **Retrospective**: a new gotcha → a dated entry in whatever lessons file you keep;
  a default that got beaten → edit that guidance in place; a rule that turned out wrong
  → fix it, or propose removing it if it misled. Each lesson states the effect it should
  have and one case where it should NOT fire. Also ask which check this session resolved
  no uncertainty: cost with no value means trim it. Bar for promoting a lesson: durable,
  verified in real work, generalizable, still true in six months.
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
- [ ] **Skills repo committed AND pushed** — if you keep skills/lessons in a git clone and
      anything in it changed this session: commit and push it, then `git status -sb` shows
      neither `ahead` nor changes. An unpushed commit is invisible to every other machine.
      Push failed (offline, rejected)? Say so explicitly in the handoff and the prompt
      file; never force-push.
- [ ] **Project pushed** — if the project has a remote, `git push` (ask the user first
      before pushing anything public or production-facing; a private project remote at a
      checkpoint is routine).
- [ ] **Linked sessions covered**: every linked session and worktree from Step 1c is in
      the handoff's "Linked sessions & worktrees" table with a checked state (running
      ones marked RUNNING, not done); merged worktrees offered for cleanup, never deleted
      unasked.
- [ ] **Context-sweep coverage**: every request, change, commit, decision, exact fact and
      in-flight item from Step 1b is in the handoff (or deliberately dropped as trivial).
- [ ] Handoff, `NEXT-SESSION-PROMPT.md`, and `BUG_LIST.md` agree with each other.
- [ ] No secrets in anything written; every relative date converted to absolute.

Never end with a stale prompt file: even a no-changes wrap refreshes its date and state
line, so `call-handoff` can trust it blindly. And leave the project clean: working tree
committed or clearly described, no leftover test data (`test…`/`sample…`/`dummy…`
rows), no half-applied changes, no `_v2`/`_final` duplicate files.
