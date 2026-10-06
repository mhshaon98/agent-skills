# Verification & Code Quality Standards

"Verified" is a claim about evidence, not confidence. Real projects routinely catch bugs
at the verification stage that looked fine in the diff.

## 1. The verification ladder

Climb as high as the change warrants; state which rung you reached.

1. **Compiles/builds clean** (`swift build`, `python -m py_compile`, etc.) — the floor,
   never the finish line.
2. **Unit tests pass** — pure services should have them (queries, persistence, domain
   math, seeding, sync/health). New logic in a service layer gets a test; UI glue does
   not need one by default.
3. **Exercised live** — run the actual app/server and drive the changed paths: curl every
   new/changed endpoint (success AND rejection paths), click through every changed screen
   (browser automation or simulator), including dark mode / narrow widths for UI work.
4. **Numbers reconciled against ground truth** — for data tools, totals must match the
   source **to the cent** after every change. Build this as a permanent health check.
5. **Independent review pass** — before any release/submission, a fresh-eyes review agent
   over the FULL changed surface since the last review (not just the last diff). This
   catches shipping bugs remarkably often; skipping it is the recurring regret.

## 2. The honest ledger: Verified / NOT verified

Every handoff and every completion claim carries two lists:

- **Verified**: what was run, where, with what result ("every changed screen exercised via
  browser automation on macOS; totals match the source to the cent").
- **NOT verified**: everything implemented but not run — other OS ("implemented, none run
  on Windows"), physical device (camera quality, on-device AI inference), native dialogs
  needing a human click, live backend schema not yet executed.

Never let an untested platform ride implicitly on a tested one's green checkmark.

## 3. Debugging discipline

- **Root-cause, don't patch symptoms.** A gallery-flash bug's first fix (remove an
  animation + add a fade gate) treated the symptom and failed; the real cause was an
  inherited spring animation from a parent `withAnimation`. If a fix is "make the symptom
  less visible," keep digging.
- **Reproduce before fixing; re-run the reproduction after fixing.**
- **Two failed attempts → stop, escalate**: step back, re-read the surrounding system,
  consider a stronger model or a debugging agent. Don't grind attempt #5 blind.
- When a fix depends on an unidentified culprit, prefer a **structural clamp** that makes
  the whole class of bug impossible (e.g. a container-relative width pin) over hunting
  one phantom offender — but say that's what you did.
- Verify the *evidence* supports a state-changing action before taking it; a familiar
  symptom can have an unfamiliar cause.

## 4. Code quality rules

- **Pure, testable core**: business logic in services with no UI imports; views render
  state and forward intents.
- **Fail loudly at boundaries, degrade gracefully at features**: config errors are
  surfaced, never silently swallowed; optional features (AI, sync, write capability)
  check their prerequisites up front and present an honest disabled state, not fake
  success. Stubs throw honest errors ("not implemented"), never pretend-succeed.
- **Locks and snapshots**: any state shared with a background refresher is read under a
  lock or as a snapshot (an unlocked cache read raced a refresher in practice).
- **Clamp footguns at the input**: a `max_backups: 0` config once deleted all backups —
  validate config values and clamp to safe ranges.
- **Every write to user data**: capability check → lock → backup → write → audit entry.
- **Reusable patterns over one-offs**: one shared button-style fix can cover every
  button in an app; prefer fixing the shared component to patching call sites.
- **Comments state constraints the code can't show** (why this library, why the width
  clamp, why SELECT stays open) — not narration of what the next line does.
- **Naming/dating**: dated handoffs (`HANDOFF-YYYY-MM-DD-HHMM.md`); absolute dates
  everywhere. For served web assets, defeat stale caches one way or the other:
  `?v=YYYYMMDDx` version strings or `Cache-Control: no-store` headers.

## 5. Error handling & logging

- User-facing tools: every failure path ends in a human-readable message with a next
  step (a native alert, an in-app error display), not a stack trace.
- Long-running tools: a per-run heartbeat ("no new items") so silence unambiguously
  means broken.
- Audit logs are append-only JSONL with timestamps and old/new values.
- Health checks are features, not tests: ship them (a `health_check.py`, a health tab,
  a sync-health screen, a test-data detector) so regressions surface themselves.

## 6. Progressive validation for shared agent configuration

Changes to a shared agent-instruction setup (always-loaded instruction files, installers,
hooks, skill descriptions/routing) propagate to every machine, project, and future
session — a bad edit multiplies. Validate progressively, never all-at-once:

- **Scratch first**: installers and hooks run against scratch files/paths (e.g. a
  settings-path override) before touching the real user config.
- **One environment first**: let the change live in the environment that made it before
  others pick it up; the handoff tells the next one what to watch for.
- **Behavioral changes get a probe**: an instruction or routing change is only
  "verified" after a REAL later session demonstrates the behavior (a small canary
  instruction is a cheap standing probe for always-loaded-instruction retention).
  Until then it is "implemented, NOT verified" in the ledger.
- Rollback story before the change: keep the config in git and note the last-good
  commit in the handoff when touching core files.

## 7. Refactor checklist

Refactors are where working behavior silently dies. Before starting:
- [ ] Behavior baseline captured: what does it do NOW (tests, recorded outputs,
      screenshots for UI, reconciled totals for data tools)
- [ ] Blast radius listed: every caller/consumer of what's changing
- [ ] Reason stated: a refactor needs a payoff (enables X, removes bug class Y) — not
      "cleaner." No drive-by refactors inside bug-fix commits.

While refactoring:
- [ ] Preserve observable behavior exactly unless a change is the stated goal — flag any
      intentional behavior change separately
- [ ] Prefer fixing the shared component over patching call sites; prefer structural
      fixes that kill the bug class over spot fixes
- [ ] Keep user-iterated designs intact — "don't regress" notes in handoffs are binding

After:
- [ ] Re-verify against the baseline (same tests/outputs/totals)
- [ ] Old code deleted, not commented out or left as `_old` copies
- [ ] Handoff updated: what moved where, and why

## 8. Release/readiness checklist (condensed)

Before calling anything "ready to ship/submit":

- [ ] Independent review-agent pass over the full changed surface since last review
- [ ] Verified/NOT-verified ledger written
- [ ] Data migration path tested (fresh install AND upgrade-with-existing-data)
- [ ] Security advisors run on any touched live backend — and re-checked that fixes stuck
- [ ] No test/sample data left (health check confirms)
- [ ] Version/build numbers bumped correctly (a build number ever uploaded anywhere must
  never be reused)
- [ ] User-facing copy checked against the project's copy rules
- [ ] Store/deploy checklist docs updated (release notes, privacy questionnaire deltas)
- [ ] Handoff updated; working tree clean or explained
