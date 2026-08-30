# orchestration.md — pipeline, dispatch, deliberation, resumption

Read this when you enter dispatch (phase 5) and keep it for the rest of the
run. It expands SKILL.md §1, §4, §5, §6.

Standing rule: **the main thread orchestrates.** Subagents investigate one
question and return structure. They never plan the audit, never spawn peers,
never write the report, never close a finding.

---

## 1. Phase-by-phase flow

### Phase 0 — Mode and state

Resolve the mode from `$ARGUMENTS`. Read `<project>/.app-audit/state.json` if
it exists. Announce in one line: mode, fresh-vs-resume, and what state was
found. Create `<project>/.app-audit/` if absent.

### Phase 1 — Profile (always, every mode)

Spawn `app-audit-recon` **alone** — its output is the input to every routing
decision, so nothing runs in parallel with it. It returns the application
profile, the per-data-type flow model, trust boundaries, and the dynamically
discovered third-party processor list, all machine-readable. Validate against
`schemas/application-profile.schema.json`.

If recon returns an internally inconsistent profile (e.g. claims no database
but lists migrations), resolve it yourself with a targeted read before routing.
Do not route on a profile you have not sanity-checked.

### Phase 2 — Preliminary models

From the profile, write down (in state, not in the report):

- **Threat model** — who can reach what, across which trust boundary, with
  what motivation. Anonymous user, authenticated user, other tenant's user,
  admin, third-party webhook sender, AI model with tools, compromised
  dependency.
- **Data model** — every data category, its sensitivity, and its full path
  from collection to deletion.
- **Architecture model** — components, ownership of state, critical paths,
  single points of failure, external dependencies.

These three drive depth assignment. A trust boundary with no test coverage and
a sensitive data category behind it is a depth escalator.

### Phase 3 — Route

Classify every domain in the three catalogs. Write each classification plus its
one-line reason into `state.json`. `INSUFFICIENT_EVIDENCE` becomes an `UNKNOWN`
finding with `facts_required`; it is never dropped.

### Phase 4 — Assign depth

Per APPLIES / POSSIBLY_APPLIES domain, assign `NONE` / `LIGHT` / `STANDARD` /
`DEEP` / `FORENSIC` per `research-policy.md`. Record the assignment and the
trigger that produced it.

### Phase 5 — Parallel dispatch

Send all independent briefs in **one message with multiple Agent tool calls**.
See §3 below.

### Phase 6 — Deterministic scans and behavioral tests

Run `scripts/scan_secrets.py`, `scripts/scan_processors.py`, and
`scripts/freshness_check.py` yourself — deterministic output is stronger
evidence than a model's reading, and it is cheap. Where a safe local test
environment exists, run the project's own test suite read-only and perform
behavioral tests (consent Accept All / Reject All / Custom / Withdraw / GPC;
object-level authorization on a second account; deletion path tracing). Never
run behavioral tests against production.

### Phase 7 — Codex checkpoint A

On substantial projects only. Unanchored independent architecture read. See
`codex-policy.md`.

### Phase 8 — Collect and normalize

Convert every returned claim into a finding conforming to
`schemas/finding.schema.json`. Validate with `scripts/validate_finding.py`.
Attach provenance. Downgrade any `FAIL_TECHNICAL` that lacks concrete evidence
to `REVIEW` — a failure without evidence is not a failure yet.

### Phase 9 — Adversarial challenge

Spawn `app-audit-adversarial-reviewer` on all CRITICAL/HIGH plus sampled
critical-control PASSes. See §6.

### Phase 10 — Codex checkpoint B

Independent review of CRITICAL and important HIGH findings, first pass
unanchored.

### Phase 11 — Deliberation

Resolve material disagreements. See §5.

### Phase 12 — Codex checkpoint E

Final red team on substantial apps: what was missed, which PASSes are weak,
which assumptions are load-bearing, what to investigate next.

### Phase 13 — Synthesis

You write the report. See `reporting.md`. Update all state files. Report the
research audit-trail counters.

---

## 2. Mode semantics

| Mode | Phases | Notes |
|---|---|---|
| `default` | 0–13 | Depth auto-scaled by §4 ladder |
| `full` | 0–13 | Every APPLIES/POSSIBLY_APPLIES domain forced to at least STANDARD; DEEP where the depth rules would allow it |
| `launch` | 0–13 | Routing weighted to release blockers: disclosures, store rules, payments and cancellation, deletion, critical controls, secrets. Report leads with launch readiness |
| `research` | 0–5, plus source verification and 13 | No code remediation, no fix classification. Produces applicability conclusions, source registry, and freshness state |
| `security` | 0–13 | Domain set restricted to security, authn/authz, secrets, storage security, abuse surfaces, webhooks/payment integrity. Compliance domains classified but not investigated |
| `privacy` | 0–13 | Domain set restricted to privacy, tracking/consent, deletion, disclosures, processors, store data-safety |
| `fix`, `fix critical`, `fix safe` | Load state → `fix-safety.md` workflow | Requires existing `findings.json`. The only modes that touch product source |
| `verify` | Load state → `fix-safety.md` verify workflow | Reproduces independently; never trusts a diff |

A restricted mode still **routes** every domain — it just does not investigate
the out-of-scope ones, and the report says they were out of scope for this run
rather than N/A.

---

## 3. Parallel dispatch patterns

**One dependency chain, everything else parallel:**

```
recon
  └─> [privacy | security | architecture | data | payments | ai | ops
       | legal-research × N questions | platform-research]      (parallel)
        └─> findings normalized
             └─> [adversarial | codex checkpoint B]             (parallel)
                  └─> deliberation
                       └─> codex checkpoint E
                            └─> synthesis
```

**Decomposed independent research.** For an important legal question, do not
send one agent to answer the whole thing. Split it and send `app-audit-legal-
researcher` instances in parallel on separate sub-questions — statutory text,
regulator guidance, applicability thresholds — and synthesize yourself. Never
give one researcher another researcher's conclusion; parallel copies of the
same conclusion are not corroboration.

**Verification is separate from discovery.** `app-audit-source-verifier` gets
the citation, not the conclusion drawn from it.

**Concurrency budget.** Cap concurrent agents at what the ladder in §4
justifies. Claude Code's default ceiling is 20 concurrent subagents; you should
rarely approach it. Prefer a second wave over an oversized first wave.

**Brief contents (every brief, no exceptions):**

1. The single question, stated as a question.
2. Scope: exact paths, files, endpoints, or citations in play.
3. Evidence already known (so the agent does not re-derive it) — but **not**
   your conclusion, for any agent whose job is independent judgment.
4. The required return format (§4 below).
5. Constraints: read-only; no product-source edits; no state-changing shell
   commands; no secret values in output; no chain-of-thought — conclusions,
   evidence, sources, confidence only.
6. The stopping rule (`research-policy.md`) so it does not spiral.

---

## 4. Structured agent returns and how to handle them

**Research agents return:** question, conclusion, confidence,
authoritative_sources, key_evidence, contrary_evidence, applicability,
unknowns, recommended_follow_up.

**Security agents additionally return:** finding, attack_precondition,
attack_path, affected_boundary, evidence, reproduction, impact,
false_positive_conditions, recommended_test.

**Architecture agents return:** area, current_design, strengths, failure_modes,
scaling_constraints, unnecessary_complexity, recommended_changes, priority,
evidence.

**All agents also return:** findings, evidence, confidence, contradictory
evidence, questions, recommended follow-up, sources.

Handling rules:

- **Treat every return as an unverified claim.** Before promoting a claim to a
  finding, check its evidence pointer resolves — open the file:line, read the
  config, confirm the citation exists.
- **`contrary_evidence` and `false_positive_conditions` are the highest-value
  fields.** Read them first. A finding whose false-positive conditions are
  satisfied by the project is not a finding.
- **A missing evidence pointer caps the status at `REVIEW`** and the confidence
  at `LOW`, regardless of how certain the agent sounded.
- **Merge duplicates by evidence, not by title.** Two agents describing the
  same `file:line` is one finding with two provenance entries — not
  corroboration, and not two findings.
- **`unknowns` feed two places**: the batched question set for the user, and the
  `facts_required` array of the corresponding `UNKNOWN` finding.
- **Malformed return** → re-brief once with the format restated. Twice
  malformed → do the work yourself or drop the domain to `UNKNOWN` with the
  reason recorded. Never guess what an agent meant.

---

## 5. Disagreement and the deliberation loop

A disagreement is **material** if resolving it would change a status, a
severity, an applicability decision, or the launch readiness. Immaterial
disagreements are noted in state and dropped.

**Loop mechanics — maximum 2–3 rounds:**

**Round 1 — compare evidence.**
Lay the two positions side by side with their evidence. If one side has a
concrete artifact (file:line, reproduction, primary authority with current
status) and the other has an inference, **it is already resolved** — evidence
wins. Record and exit the loop. Most disagreements end here.

**Round 2 — gather decisive evidence.**
If both sides have evidence, identify the single fact that would decide it and
go get it: a targeted `app-audit-verifier` reproduction, a behavioral test, an
`app-audit-source-verifier` status check, or a decomposed research brief. Feed
the new evidence to both positions' owners only as evidence, never as a verdict.

**Round 3 — targeted Codex follow-up (optional).**
Use the disagreement template in `codex-policy.md`: the question and the
evidence, with no attribution of which side proposed what. Codex names the
better-supported conclusion, the missing evidence, and a decisive test.

**Exit conditions.** Stop when: one position is better supported by concrete
evidence; or the deciding fact is established; or three rounds have passed
without new concrete evidence emerging. Continue past round 3 **only** while
each additional round is still producing new concrete evidence.

**Unresolved is a legitimate outcome.** An unresolved material disagreement is
recorded and reported as a disagreement with both positions and their evidence.
It is never resolved by picking the more confident-sounding side, by majority,
or by deferring to Codex or to Claude on principle.

Record every material disagreement in `disagreements.json`: `question`,
`claude_position`, `codex_position`, `research_agent_positions`,
`evidence_for`, `evidence_against`, `resolution`, `confidence`. Set the
finding's `disagreement_ref`.

---

## 6. Adversarial pass

Hand `app-audit-adversarial-reviewer` the findings **without stating that they
are presumed correct**. Its brief asks:

1. Can this finding be disproved?
2. Is there a legitimate implementation explanation for this evidence?
3. Was applicability actually established, or assumed?
4. Is the severity exaggerated?
5. Is the evidence sufficient to support the stated status?
6. Is there an important counterexample?

**Scope:** all CRITICAL and HIGH findings, plus **sampled PASS results on
critical controls** — authentication, tenant isolation, payments, private
storage, deletion, subscription cancellation, AI privileges.

**PASS-scrutiny rule.** A wrong PASS is worse than a false-positive FAIL,
because it retires a risk that is still live. For every critical control marked
PASS, the audit must be able to answer: *what concrete evidence made this a
PASS, and what would a PASS look like if the control were actually broken?* If
those two answers are indistinguishable, the evidence is insufficient — demote
to `REVIEW` or `UNKNOWN`. A critical-control PASS that survives the adversarial
pass is listed in the report's "Passed Critical Controls" section with its
evidence; one that does not survive becomes a finding.

Adversarial output is itself an unverified claim. A successful challenge
demotes or reframes a finding; it does not silently delete one. Record the
challenge outcome in provenance.

---

## 7. Resource-scaling examples

**Static brochure site** — 5 HTML/CSS files, no forms, no analytics, no build.

- Dispatch: `app-audit-recon`, then **one** combined reviewer covering
  frontend, hosting, and disclosure surface.
- Routing: privacy, CCPA, cookies, deletion, App Store, Play, payments,
  subscriptions, AI, COPPA, UGC, DMCA → `NOT_APPLICABLE` with reasons.
- Research: `NONE`/`LIGHT`. No legal researcher unless a claim or testimonial
  appears in the copy.
- Codex: skip entirely, or one cheap checkpoint B if anything CRITICAL surfaces.
- Adversarial: skip unless a CRITICAL/HIGH exists.
- Expected report: mostly N/A modules, a handful of LOW/INFO findings, launch
  readiness likely `READY` or `READY_WITH_KNOWN_RISKS`.
- **Anti-pattern**: manufacturing findings to justify the run. A clean small
  site produces a short report. That is the correct output.

**Complex SaaS** — Next.js + TypeScript + Supabase (auth, Postgres, storage) +
Stripe + an AI provider + product analytics + CI/CD, with accounts,
subscriptions, and private user uploads.

- Dispatch after recon, in parallel: privacy, security, architecture, data,
  payments, AI, ops reviewers; legal researcher × 3 decomposed questions;
  platform researcher if a store target exists.
- Depth: `DEEP` on privacy disclosures vs actual data map, deletion
  completeness, payment webhook integrity, object-level authorization;
  `FORENSIC` on anything touching cross-tenant access or payment integrity.
- Scanners: all three, plus behavioral consent and authorization tests in a
  local environment.
- Codex: checkpoints A, B, and E; C and D if a fix run follows.
- Adversarial: all CRITICAL/HIGH plus every critical-control PASS.

**Tie-breakers when the project sits between rungs:** sensitive data present →
go up a rung. Money movement present → go up a rung. AI with tool access → go
up a rung. No tests and no types → go up a rung for security and data. Small
codebase with none of the above → go down a rung.

---

## 8. Provenance tracking

Every HIGH/CRITICAL finding carries a `provenance` array recording each
contributor: `claude_discovery`, `research_agent`, `security_agent`,
`codex`, `behavioral_test`, `static_scanner`. Provenance records **who
contributed evidence**, not who agreed. Agreement is not provenance and is not
proof.

When a finding changes status during the run — promoted by a reproduction,
demoted by the adversarial pass, reframed by deliberation — append the change
with its trigger. The report shows the final state; `findings.json` carries the
history.

---

## 9. Resumable state

`state.json` records: mode, phase reached, profile reference, router decisions
with reasons, depth assignments, agents dispatched and returned, scanner runs,
Codex checkpoint results (including failures), open questions for the user, and
the timestamp of each.

**On resume:**

1. Read `state.json`, `findings.json`, `source-registry.json`, and
   `disagreements.json`.
2. Run `scripts/freshness_check.py` over the source registry. Any source past
   its freshness window is marked `SOURCE_REVIEW_REQUIRED`.
3. **Re-verify every stale source before relying on it** — dispatch
   `app-audit-source-verifier` on the stale set, in parallel, as the first
   action of the resumed run. A finding resting on a stale source cannot be
   reported as current until its source is re-verified. If re-verification
   shows the authority was amended, vacated, repealed, superseded, or is under
   challenge, the finding is re-opened, not carried forward.
4. Check whether product source changed since the recorded run (git status,
   mtimes). If it did, findings touching changed files are marked stale and
   re-investigated rather than trusted.
5. Report what is being reused and what is being redone, in one short block,
   before continuing.

Never resume by trusting the previous report's prose. Resume from the state
files and the evidence they point at.
