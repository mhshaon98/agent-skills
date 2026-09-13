---
name: bug-ledger
description: Use whenever a bug is reported, discovered, fixed, or reopened, or before working in a historically bug-prone area. Maintains the cumulative bug ledger (BUG_LIST.md) — many "new" bugs are old ones recurring or a fix that regressed, so check it BEFORE debugging.
---

# Bug Ledger Discipline

`BUG_LIST.md` at the repo root is the project's institutional bug memory: every bug
ever found, its root cause, and the full attempt history (what worked, what didn't,
what regressed). The handoff is "where we are now"; the ledger is "everything we've
ever fought and how." It lives in git so it travels with the clone.

## When a bug is reported

1. **Scan `BUG_LIST.md` FIRST** — search by area, compare symptom AND environment
   (device / OS / build):
   - Matches an entry marked ✅ FIXED → suspect a **regression**; reopen that entry,
     don't debug blind.
   - Matches a "cross-cutting lessons" pattern → apply the known diagnosis first.
   - **Note which build the symptom was seen on** — a report against the live/shipped
     build is NOT evidence that an unreleased fix failed.
2. If no ledger exists yet, create it now (template below). Don't create one
   preemptively on bug-free projects.

## When a bug is fixed or reopened

Update the matching entry (or add one) **in the same session** — don't let it drift.
Record: symptom → root cause (the mechanism, not the patch) → each attempt with its
result → current fix with file:line → verification status.

**Status legend:** 🔴 OPEN · 🟠 PARTIAL/needs verification · ✅ FIXED (verified) ·
🟡 FIXED (not yet verified on the real target) · ⚪️ DEFERRED (known, accepted).
**Compiling ≠ fixed** — a behavioral fix stays 🟡 until exercised on the real target.

## Entry template

```markdown
### BUG-NN — <short title>   [status emoji + label]
- **Area:** <camera / storage / auth / UI / build / …>
- **Reported / found:** <when, how, on which BUILD/env>
- **Symptom:** what the user/observer sees.
- **Root cause:** the actual mechanism — or "unknown; hypotheses below".
- **Attempts:** chronological: tried X → RESULT (worked / didn't / regressed Y).
- **Current fix:** what's in the tree now (file:line).
- **Verification:** how confirmed (device / prod / curl / test) — or "NOT verified".
- **Files / Refs:** paths; handoff / commit links.
```

## File structure (when creating a new ledger)

Sections in order: **OPEN / ACTIVE** (newest first) → **DEFERRED** → **FIXED**
(grouped by area, keep the attempt history — that's the point) → **Cross-cutting
lessons** (recurring traps, so a "new" bug can be matched to a known pattern).
Add a header note telling every future session to read the file during session start
and update it in the same session a bug is touched.

## Triage method (before writing the ledger entry)

Each rung is a precondition for the next — don't record a fix until all six are done:

1. **Reproduce** — no repro = a hypothesis, not a bug. This is where you scan
   `BUG_LIST.md` and check ✅ entries for regressions (step 1 of "When a bug is
   reported"); a re-triggered old bug repros the old way.
2. **Localize the layer** — UI / API / data / build / external / the test itself; git
   bisect to the introducing commit.
3. **Reduce to a minimal failing case** — strip unrelated code, simplify inputs.
4. **Fix the root cause, not the symptom** — a DB-query fix, not a UI dedup.
5. **Regression test** — one test that catches this specific failure.
6. **Verify end-to-end** — focused test → full suite → build → manual check.

Hard rule: once something is broken, STOP adding features until it is fixed — new work
on top of a break compounds the diagnosis. (adapted from addyosmani/agent-skills, MIT)

## Debugging rules while working an entry

- Reproduce before fixing; re-run the reproduction after fixing.
- Root-cause, don't symptom-patch — "hide/delay/fade the problem" means keep digging.
- **Two failed attempts → stop grinding**: step back, re-read the surrounding system,
  escalate model tier or spawn a debugging agent.
