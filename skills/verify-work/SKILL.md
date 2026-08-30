---
name: verify-work
description: Use BEFORE claiming work is "done", "complete", "working", or "fixed", and before writing a handoff or completion summary. Verification ladder plus the honest Verified/NOT-verified ledger — "verified" is a claim about evidence, not confidence.
---

# Verify Before Claiming Done

Every project has caught real bugs at the verification stage that looked fine in the
diff. A green build is the floor, never the finish line.

## The verification ladder

Climb as high as the change warrants, and **state which rung you reached**:

1. **Compiles/builds clean** — necessary, never sufficient.
2. **Unit tests pass** — new logic in a service layer gets a test; UI glue doesn't
   by default.
3. **Exercised live** — run the actual app/server and drive the changed paths:
   - curl every new/changed endpoint — success AND rejection paths;
   - click through every changed screen (browser automation / simulator), including
     dark mode and narrow widths for UI work;
   - a packaged/frozen build is a DIFFERENT runtime from a source run — test the
     artifact that ships, not just the source.
4. **Numbers reconciled against ground truth** — for data tools, totals must match
   the source exactly after every change; ship that as a permanent health check.
5. **Independent review pass** — before releases (see the `pre-release-review` skill).

## The honest ledger (required in every completion claim and handoff)

- **Verified:** exactly what was run, where, with what result. State reached, not
  effort spent ("all 7 tabs exercised via browser automation on this Mac; totals
  match the workbook to the dollar" — not "did lots of testing").
- **NOT verified:** everything implemented but not run — other OS ("implemented,
  none run on Windows"), physical device, native dialogs needing a human click,
  live backend schema not yet executed. Never let an untested platform ride
  implicitly on a tested one's green checkmark.

## Honesty rules (absolute)

- Failing tests are reported as failing, with output.
- Skipped steps are reported as skipped.
- Stubs throw honest errors — never pretend-succeed.
- Never soften a data-risk finding; never inflate a partial success.
- Believing "done" from any agent (or your past self) without evidence is a bug.
  Evidence = commands + output + file:line refs.

## Common verification traps

- "Obviously correct" fixes that fail live — run it, don't trust the diff.
- UI verified only by build success — screenshots catch what green builds can't
  (double tab bars, letterboxing, clipped toolbar content are all real escapes).
- Synthetic-input UI tests need DPI awareness and readiness checks, and must never
  run on a machine the user is actively using.
- Camera/sensor/device behavior can't be machine-verified — keep a human-verification
  checklist in the handoff.
