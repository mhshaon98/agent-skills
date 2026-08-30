# Fix Safety — fix mode, safety classes, verify mode

Reference for `/app-audit`. Loaded on demand by SKILL.md whenever the mode is `fix`,
`fix critical`, `fix safe`, or `verify`.

`/app-audit` is **an automated technical and disclosure compliance-assistance
system**. A completed fix pass is never reported as guaranteed compliance or
guaranteed security.

---

## 0. The one write rule

> **Only `app-audit-implementer` may modify product source, and only when the
> orchestrator is in an explicit fix mode.**

- Default `/app-audit`, `full`, `launch`, `research`, `security`, `privacy`, and
  `verify` are **strictly non-destructive**. After such a run the project's
  `git status` must be unchanged apart from `<project>/.app-audit/` artifacts.
- Every other agent in the fleet is read-only by tool allowlist — no `Edit`,
  no `Write`, no `NotebookEdit`. Read-only agents may not work around this with
  shell redirection, `sed -i`, `patch`, `tee`, or any other state-changing command.
- Codex is **never** asked to write files, in any mode, anywhere.
- The implementer receives **one finding per brief**. It does not roam, does not
  "while I was in there" adjacent files, and does not batch unrelated fixes.
- `<project>/.app-audit/` state files are written by the orchestrator, not the
  implementer, and are the only writes a non-fix run may make. Recommend gitignoring
  that directory; never commit it automatically.

---

## 1. Fix workflow

Executed in this order. Do not skip forward.

1. **Read findings** — load `<project>/.app-audit/findings.json` and `state.json`
   from the prior audit. If no prior audit state exists, say so and run (or ask to
   run) an audit first; do not fix from a fresh guess.
2. **Select FAIL_TECHNICAL findings.** Only `FAIL_TECHNICAL` is fixable material.
   `REVIEW` and `UNKNOWN` are not — they are unresolved questions, and "fixing" them
   silently converts uncertainty into a claim.
3. **Research unclear fixes.** If the correct remediation depends on a current
   platform policy, statute, or provider API contract, run research first
   (`references/research-policy.md`) — do not fix from memory.
4. **Codex plan review if consequential** — checkpoint C. Regressions, security
   holes, migration hazards, missing edge cases, simpler alternatives.
5. **Classify safety** — assign every candidate fix exactly one class from §2.
6. **Implement safe changes** — dispatch `app-audit-implementer`, one finding per
   brief, class rules enforced in the brief itself.
7. **Run tests.** The project's existing suite plus any regression test the fix
   warrants. A fix with no way to fail is not verified.
8. **Codex post-fix review where warranted** — checkpoint D. Generally for all
   HIGH/CRITICAL remediation and anything touching a trust boundary.
9. **Independent verification** — §4. A separate reviewer, not the implementer.
10. **Update report** — findings, statuses, `verification_steps`, audit trail, and
    the fix order in APP-AUDIT.md; refresh APP-AUDIT.json and `.app-audit/` state.

### 1.1 Submodes

| Invocation | Scope |
|---|---|
| `fix` | All fixable `FAIL_TECHNICAL` findings, subject to safety class. `PLAN_REQUIRED` produces a plan for the user, not a change. `HUMAN_REVIEW` and `PROHIBITED_AUTOFIX` are never applied. |
| `fix critical` | **CRITICAL severity only.** Everything else is left untouched and reported as deferred. Use when the goal is to unblock a launch, not to tidy. |
| `fix safe` | **`SAFE_AUTOFIX` class only.** The most conservative mode: mechanical, well-understood, evidence-backed repairs. Nothing requiring a plan, a legal judgment, or a business fact is touched. |

Severity and safety class are independent axes. A CRITICAL finding can be
`PLAN_REQUIRED` (it still does not get auto-fixed under `fix critical` — it gets a
plan). A LOW finding can be `SAFE_AUTOFIX`. `fix critical` filters by severity;
`fix safe` filters by class; plain `fix` applies both sets of rules.

---

## 2. Safety classes

Every fix carries exactly one class. Encode the class on the finding
(`safe_to_autofix`, `human_review_required`) and in the implementer's brief.

### SAFE_AUTOFIX

Mechanical, well-understood, evidence-backed, low blast radius.

> broken links, missing authorization check, missing timeout, tracker ignoring
> rejection, broken deletion path, missing webhook signature verification,
> regression test, clearly unintended public private storage

"Clearly unintended" is load-bearing on the last item: a public bucket is **not** a
vulnerability by itself. Confirm the bucket holds private user data, not marketing
assets, before touching it.

### PLAN_REQUIRED

Correct in principle, but the change has migration or blast-radius risk. Produce a
written plan (steps, rollback, data story, test plan) and stop. Route through Codex
checkpoint C before presenting it.

> db migration, auth redesign, storage migration, queue redesign, breaking API
> change, major infra

Anything touching a data store, schema, or user-owned file also inherits the standing
rule: migration **and** rollback story before the first write; additive over
destructive; backup plus audit log for precious files.

### HUMAN_REVIEW

The blocker is a judgment or a fact the repo cannot supply. Surface it with the exact
question; never guess it into a change.

> legal wording, business applicability facts, testimonial authenticity, retention
> policy, contract decisions

### PROHIBITED_AUTOFIX

Never performed silently — and in `/app-audit`, never performed by the system at all.
These are handed to the user with the reasoning and the recommended action.

> add arbitration, class waiver, indemnity; change governing law; delete production
> data/accounts; charge cards; cancel customers; rotate production credentials;
> deploy; publish store changes

No mode overrides this list. `fix`, `fix critical`, and `fix safe` all refuse it. A
finding whose only remediation is on this list is reported as remediation-blocked,
with the manual steps written out for the user to run themselves.

---

## 3. Choosing the class

- Default **up** the ladder when uncertain: `SAFE_AUTOFIX` is the claim that the fix
  is understood and bounded, not a hope.
- If the fix's correctness depends on a fact not in the repo → `HUMAN_REVIEW`.
- If reverting the fix would require a data migration → `PLAN_REQUIRED`.
- If the change alters a contract with a user (terms, billing, account state, stored
  credentials, published listings) → `PROHIBITED_AUTOFIX`.
- Contract clauses — arbitration, class-action waiver, jury waiver, indemnification,
  liability cap, governing law, venue, broad IP assignment, broad UGC license — are
  `HUMAN_REVIEW` at minimum, and **never silently added**; adding them is
  `PROHIBITED_AUTOFIX`.

---

## 4. Post-fix independent review

After significant fixes:

1. **A separate reviewer inspects the diff without assuming it is correct.** Not the
   implementer, and not a continuation of the implementer's thread — its own agent,
   given the finding and the diff, asked to determine whether the diff actually
   resolves the finding. The brief must not state that the fix is believed correct.
2. **HIGH/CRITICAL remediation generally also gets a Codex review** — checkpoint D:
   does the diff solve the issue, does it introduce new problems, are the tests
   sufficient. Unanchored where possible: show the diff and the original problem
   statement, not Claude's verdict on the fix.
3. **Tests must have been run, not merely written.** Record the command and the
   result in `verification_steps`.
4. If review disagrees with the implementer, that is a material disagreement — run
   the deliberation loop in `references/codex-policy.md` §7 and record it.
5. If Codex is unavailable, mark `codex_review.performed = false`, say so in the
   report, and do not upgrade confidence in the fix on Claude's read alone.

---

## 5. Verify mode

`/app-audit verify` re-examines previously fixed findings. It is read-only — verify
mode never modifies product source.

1. **Load prior findings** from `<project>/.app-audit/`. Re-verify stale
   time-sensitive sources on resume (freshness windows in
   `references/research-policy.md`).
2. **Reproduce independently.** Re-run the original reproduction — the request, the
   query, the authorization attempt, the deletion trace — from scratch. Do not reuse
   the earlier transcript as evidence.
3. **Run regression tests.** Confirm the specific test that would catch this defect
   exists and fails against the pre-fix behavior in principle. A fix with no failing
   case is unverified, not verified.
4. **Compare before/after.** Explicitly, with the same evidence type as the original
   finding (file:line, config, request/response, network or database behavior).
5. **Challenge apparent fixes.** Ask what would still make the original attack or
   leak work: a second code path to the same resource, a cached client, an
   unauthenticated variant of the route, an admin bypass, a different content type,
   a queued job that reintroduces the record.
6. **Reopen unresolved findings.** Restore `FAIL_TECHNICAL` (or `REVIEW` if the
   evidence is now ambiguous) and record why the earlier fix did not hold.

> **Never PASS a finding because the diff "looks right".**

A diff is a description of intent. PASS requires reproduced behavior. If the
behavior cannot be reproduced in the available environment, the correct status is
`UNKNOWN` with the missing capability listed — not PASS.

---

## 6. Partial-fix detection

A fix that closes one path while leaving equivalent paths open is a **partial fix**.
It stays `FAIL_TECHNICAL` (severity may drop); it does not PASS.

**Worked example — the S3 deletion case.** A finding says account deletion leaves the
user's uploaded files behind. The fix adds a delete call for
`s3://bucket/uploads/{user_id}/`. Verification must then ask: does *all* user-owned
storage live under that one prefix? Typically it does not —

- `avatars/{user_id}/` and other per-feature prefixes,
- generated exports, invoices, or report PDFs under a jobs prefix,
- thumbnails or derivatives written by a resize worker to a separate bucket,
- objects in a different region or a backup bucket with its own lifecycle,
- versioned objects and delete markers where versioning is enabled,
- CDN copies still served from cache,
- rows still referencing the deleted objects (or the reverse: orphan objects with no
  row left to find them by).

Until every user-owned location is covered, the deletion finding is **partially
fixed**, not resolved. The same pattern applies elsewhere: one endpoint hardened out
of three that reach the same object; consent honored for one tracker while a second
still fires; idempotency added to one webhook handler among several; a timeout added
to one of the AI calls.

Detection routine: for each fix, enumerate **all** paths to the affected resource or
behavior from the discovery data-flow model, then verify each one. If the enumeration
itself cannot be completed from the evidence available, the status is `UNKNOWN` with
the unenumerated surface named — never PASS.
