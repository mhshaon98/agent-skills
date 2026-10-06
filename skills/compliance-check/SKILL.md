---
name: compliance-check
description: 'Live compliance close-out: checks what is actually live (store listing and labels, published policies, deployed backend, retention and deletion jobs) against the code and the published words, then works the remediation runbook. Use on /compliance-check, "what''s left on compliance", "close out the audit", or before a store submission.'
argument-hint: "[check|closeout|store|retention|health-data|reconcile|embedded]"
---

# /compliance-check

`app-audit` finds what could be wrong by reading the repository. **`compliance-check`
proves what is true in the live world and closes the gap.** It checks the surfaces a
repository cannot show (the store listing as published, the privacy labels as
answered, the policy page as served, the backend as deployed, the cron as scheduled),
compares each against the code AND against the exact published sentence, and then
drives remediation to done, one confirmed step at a time.

**This is an automated technical and disclosure compliance-assistance system. It is
not legal advice and never certifies compliance.** Never write that anything is
compliant, certified, secure, or guaranteed. Describe evidence and residual risk.

Distilled from a real compliance close-out of a shipped consumer app, where every one
of these checks found a real gap that the repository-only audit had either missed or
recorded with a stale status.

## 0. Modes

Parse `$ARGUMENTS` (case-insensitive). Empty means `check`.

| Mode | Does | Writes |
|---|---|---|
| `check` (default) | All live-surface checks that apply, finding reconciliation, one ledger + ordered runbook | `.app-audit/` only |
| `closeout` | `check`, then works the runbook item by item with per-item confirmation | product source, website, backend: each only after an explicit yes |
| `store` | Store listing, labels, manifests, review notes, subscription metadata only | `.app-audit/` only |
| `retention` | Published retention and deletion sentences vs implemented jobs and flows | `.app-audit/` only |
| `health-data` | US consumer health data laws (WA, NV, CT) and any GDPR special-category angle | `.app-audit/` only |
| `reconcile` | Re-verify every non-closed finding in `findings.json` against current code | `.app-audit/` only |
| `embedded` | Called by `app-audit`: `check` without the runbook, returns finding rows | nothing; the orchestrator writes state |

Unrecognized argument: say what you received and run `check`.

## 1. First actions

1. State the mode in one line.
2. Locate `.app-audit/` in the project (git root first). If `findings.json` exists, load
   it and `state.json`; the prose `APP-AUDIT.md` is usually staler than the JSON, so the
   JSON is the status truth. If no audit exists, run anyway: the live checks stand on
   their own, and recommend `/app-audit` for the repository-side catalog.
3. Build the **surface inventory** (section 2) from the repo plus what project notes say
   is live. Mark each surface APPLIES / NOT_APPLICABLE with a reason.
4. Read only the references the applicable surfaces need:

| File | Read when |
|---|---|
| `references/live-surfaces.md` | Always: the check catalog, commands, pass criteria |
| `references/us-consumer-health-data.md` | Any health, fitness, body, wellness, reproductive, or biometric data, even if it "stays on device" |
| `references/retention-and-deletion.md` | Any published retention period, any deletion flow, any purge job |
| `references/production-safety.md` | Before ANY write to a live backend, store console, website, or default branch; `closeout` mode always |
| `templates/` | Only when a runbook item needs that artifact |

## 2. Surface inventory (the things only the live world can show)

| # | Surface | Typical evidence source |
|---|---|---|
| S1 | Store listing as published: live version, release date, storefronts, description text | iTunes lookup API / Play listing, never project notes |
| S2 | Store privacy labels / Data Safety answers | the console in a browser |
| S3 | Binary disclosures: privacy manifests, purpose strings, entitlements | built bundle, not just source |
| S4 | Published policy pages (privacy, consumer health data, terms) and where they are linked | the live URL, curl + text grep |
| S5 | Deployed backend: RLS/policies, function grants, edge function versions vs repo | read-only SQL + function list |
| S6 | Retention and deletion jobs as scheduled | cron table, job run history, storage state |
| S7 | Account deletion as experienced: what the UI claims vs what the server did | code path + server response contract |
| S8 | Consent and notice surfaces in the app (first-use notices, settings links) | simulator or device screenshot |
| S9 | Ops floor: backups, MFA, member list, alerting/uptime, CI on the candidate, branch protection | consoles + `gh` |
| S10 | Processor contracts (DPA) and data region | vendor console legal page, project settings |

## 3. The check loop (every surface)

For each APPLIES surface:

1. **Read the live state** with the method in `references/live-surfaces.md`. Never
   substitute a project-notes statement or a commit message for a live read; record the
   retrieval date.
2. **Put three things side by side:** the live state, the code, and the exact published
   sentence (policy, label, description, in-app copy). Quote the sentence.
3. **Check unit, trigger, scope, extras** for anything that deletes, retains, shares, or
   discloses: per row or per thread or per account; age of what; which tables, buckets,
   third parties; and anything the implementation does that the words do not say.
   (Seen: a proposed purge deleted by message age and pruned push tokens while the
   policy promised thread-level deletion and said nothing about tokens.)
4. **Classify:** `PASS` (with evidence), `FAIL_TECHNICAL`, `REVIEW` (human or legal call),
   `UNKNOWN` (fact needed, list it). Never turn missing evidence into PASS.
5. **Cheap unknowns first.** Before batching a question for the owner, spend the thirty
   seconds a public API or a read-only console page would take. (Seen: "which
   storefronts?" sat as an unknown until one lookup showed EU availability, which made
   GDPR apply and exposed a policy with no GDPR content.)

## 4. Reconciliation (statuses drift faster than code)

Any finding in `findings.json` that is not `RESOLVED` / `ACCEPTED_RISK` gets re-checked
against CURRENT code by an independent read-only verifier (`app-audit-verifier`, or
a general-purpose read-only subagent with the same brief if the fleet is not installed). The brief must ask
for VERIFIED_FIXED / PARTIALLY_FIXED / NOT_FIXED per finding with `file:line`, plus a
compile/test run. Update statuses only from that evidence. Expect surprises in both
directions: in the source close-out a "fixed" migration still failed a fresh rebuild, and three
"failing" findings were already fixed.

Status vocabulary this skill adds on top of the app-audit schema, when evidence
supports it: `PARTIALLY_FIXED`, `FIXED_UNVERIFIED`, `RESOLVED_PARTIAL`, `ACCEPTED_RISK`
(owner decision, recorded with date and mitigation). Always write a one-sentence
`resolution` with commit hash or console evidence and the date.

## 5. Output (check modes)

Write `.app-audit/COMPLIANCE-CHECK.md` (overwrite; date in the title) and update
`findings.json` statuses. The report, in this order:

1. **Outcome line**: how many HIGH/MEDIUM items are open, and the single most important one.
2. **Live facts read today** table: fact, value, source, retrieval date.
3. **Findings ledger**: ID, status now, one-line evidence, what closes it.
4. **Ordered runbook** grouped by who acts: (a) owner-only console items, (b) production
   changes needing a yes, (c) code changes, (d) release-time items, (e) later versions.
   Each item: exact action, done-when test, rollback.
5. **Accepted risks** with the decision date.
6. **NOT verified** list, explicitly.

Keep the chat answer short: outcome, the top items, and a question about where to start.

## 6. Closeout mode (working the runbook)

Read `references/production-safety.md` first. Then, per item:

- **Pre-flight read-only**: prove the change is safe with live data (who still depends on
  the thing being removed; row counts; which client versions call which path).
- **Test without staging**: seed, run, measure inside a transaction that ends in
  `raise exception`, then confirm real counts and triggers are unchanged.
- **Confirm before any outward or production action**, per action, in chat. A prior
  "yes" covers only the action it answered.
- **Policy before enforcement**: publish the retention window or disclosure BEFORE the
  job that enforces it runs, and make the job match the sentence.
- **Blocked by the permission layer?** Do not retry or route around it. Hand the owner one
  copy-paste command or a one-shot idempotent script that never prints secrets, then
  verify the result read-only yourself.
- **Verify after**: live read, not "the command succeeded". Record the evidence in the
  finding's `resolution` and in the project's session notes.
- **Owner decisions**: when asked to "make the best decision", pick the option that is
  honest to the user without false alarms, state the trade-off in one line, and list
  every state that produces the signal you surface.

## 7. Integration with app-audit

`app-audit` invokes this skill in `embedded` mode (Skill tool, `compliance-check`, args
`embedded`) at its live-surface step, and recommends `/compliance-check closeout` in its
report when findings exist. In `embedded` mode:

- run sections 2 to 4 only; no runbook, no writes, no production or console actions;
- return finding rows in app-audit's schema with `module` ids prefixed `live.`
  (for example `live.store-labels`, `live.retention-job`, `live.health-data-policy`) and
  provenance `compliance-check`;
- browser-only surfaces (S2, S9 console pages) that cannot be read in this session become
  `UNKNOWN` with `facts_required`, never PASS.

## 8. Non-negotiables

1. Never print secret values. Key names only; scripts read keys and store them without
   echoing (see `templates/setup-script-skeleton.sh`).
2. Never claim compliance, certification (SOC 2, ISO, HIPAA), or "secure".
3. Legal conclusions cite primary authority with a retrieval date and are re-verified
   when older than 90 days (`app-audit-legal-researcher` + `app-audit-source-verifier`).
   Anything counsel should confirm is labelled as such.
4. No create-account, payment, credential entry, CAPTCHA, or security-setting change on
   the owner's behalf; hand those to the owner.
5. No push, deploy, migration, store edit, or website publish without an explicit yes for
   that action.
6. Leave no test data behind; say so if a check necessarily created real rows.
7. No em dashes in anything written for the owner.
