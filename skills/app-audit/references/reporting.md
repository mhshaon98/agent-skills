# reporting.md — report structure, JSON shape, audit trail, disclaimers

Read this at synthesis (phase 13), and before writing any state file.

Outputs, all inside the audited project:

| Path | Purpose |
|---|---|
| `APP-AUDIT.md` | The human report |
| `APP-AUDIT.json` | The same audit, machine-readable |
| `.app-audit/state.json` | Resumable run state |
| `.app-audit/findings.json` | All findings, schema-valid |
| `.app-audit/source-registry.json` | Every authority relied on |
| `.app-audit/disagreements.json` | Material disagreements and resolutions |

State enables resumable `fix` and `verify`. On resume, sources past their
freshness window are re-verified before being relied on again
(`orchestration.md` §9).

---

## 1. APP-AUDIT.md — section list

These sections, with these names, **in this order**. Every section appears even
when its content is "no applicable findings" — omission hides scope.

1. Executive Summary
2. Launch Readiness
3. Application Profile
4. Architecture & Data Flows
5. Research Performed
6. Agents Used
7. Codex Review Summary
8. Modules Automatically Activated
9. Modules Skipped / N/A
10. Critical Findings
11. High Findings
12. Medium Findings
13. Low Findings
14. Disputed / Ambiguous Findings
15. Compliance Review Queue
16. Unknown Facts Needed
17. Privacy & Data
18. Security
19. Authentication & Authorization
20. Payments & Subscriptions
21. Database & Storage
22. Architecture
23. Backend/API
24. Frontend
25. Infrastructure & CI/CD
26. Observability & Reliability
27. Performance & Scaling
28. AI
29. Testing
30. Passed Critical Controls
31. Recommended Fix Order
32. Rule/Source Freshness
33. Audit Limitations

### What belongs in each

- **Executive Summary** — what the project is, what was audited, the shape of
  the result in a few lines. No new findings introduced here.
- **Launch Readiness** — the status (§3) with the mandatory disclaimer, plus
  the specific items driving it.
- **Application Profile** — the machine-derived profile in readable form:
  type, maturity, platforms, stack, data stores, auth model, payments,
  subscriptions, AI, analytics, uploads, UGC, sensitive data, hosting, CI/CD.
- **Architecture & Data Flows** — components, trust boundaries, and each data
  category's path from collection through retention to deletion.
- **Research Performed** — the counters in §4 plus what was researched and why.
- **Agents Used** — which specialists ran, on what, and any model escalation.
- **Codex Review Summary** — which checkpoints ran, agreements, disagreements,
  and any failure (§5).
- **Modules Automatically Activated** / **Modules Skipped / N/A** — every
  domain with its classification and one-line reason. `INSUFFICIENT_EVIDENCE`
  domains appear in the activated list, resolving to UNKNOWN findings.
- **Findings by severity (10–13)** — one entry per finding: title, status,
  severity, confidence, evidence with `file:line` or config or reproduction,
  risk, recommended remediation, verification steps, safety class, and sources
  for compliance findings.
- **Disputed / Ambiguous Findings** — see §6.
- **Compliance Review Queue** — items requiring human legal judgment: contract
  terms, legal wording, testimonial authenticity, retention policy decisions.
- **Unknown Facts Needed** — the batched question list, each with the finding
  it would resolve and the `facts_required` fields.
- **Domain sections (17–29)** — per-domain narrative and the findings assigned
  there. A domain that is N/A says so in one line.
- **Passed Critical Controls** — each critical control marked PASS, with the
  concrete evidence that produced the PASS and confirmation it survived the
  adversarial pass (`orchestration.md` §6).
- **Recommended Fix Order** — ordered by risk reduction per unit of effort and
  by dependency, with each item's safety class.
- **Rule/Source Freshness** — every authority relied on: citation, status
  (`CURRENT` / `UPCOMING` / `SUPERSEDED` / `VACATED` / `REPEALED` /
  `UNDER_CHALLENGE` / `UNKNOWN`), `last_verified`, `effective_date`, any
  compliance deadline, and anything flagged `SOURCE_REVIEW_REQUIRED`.
- **Audit Limitations** — what was not examined and why: no production access,
  no runtime environment, no test credentials, business facts unavailable,
  off-repo infrastructure, Codex unavailable, time-boxed depth. This section is
  never empty; every audit has limits and hiding them overstates the result.

---

## 2. APP-AUDIT.json — shape

```json
{
  "schema_version": "1",
  "generated_at": "",
  "mode": "",
  "project": { "path": "", "name": "", "vcs_head": "" },
  "application_profile": {},
  "data_flows": [],
  "trust_boundaries": [],
  "third_party_processors": [],
  "router": [
    { "module": "", "classification": "", "reason": "", "research_depth": "" }
  ],
  "findings": [],
  "passed_critical_controls": [
    { "control": "", "evidence": [], "adversarially_challenged": true }
  ],
  "disagreements": [],
  "unknown_facts_needed": [
    { "question": "", "blocks_finding_ids": [], "facts_required": [] }
  ],
  "source_registry": [],
  "codex_review": {
    "model": "gpt-5.6-sol",
    "effort": "medium",
    "checkpoints": [
      { "checkpoint": "", "performed": false, "outcome": "", "failure_reason": null }
    ]
  },
  "research_audit_trail": {},
  "launch_readiness": { "status": "", "drivers": [], "disclaimer": "" },
  "recommended_fix_order": [],
  "audit_limitations": []
}
```

`findings[]` entries conform to `schemas/finding.schema.json`:

```json
{
  "id": "", "module": "", "title": "",
  "status": "", "severity": "", "confidence": "",
  "applicability": { "result": null, "reason": "", "facts_required": [] },
  "evidence": [], "behavioral_evidence": [], "authoritative_sources": [],
  "research_summary": "",
  "codex_review": { "performed": false, "agreement": null, "summary": "" },
  "risk": "", "recommended_remediation": [],
  "safe_to_autofix": false, "human_review_required": false,
  "verification_steps": [],
  "provenance": [], "disagreement_ref": null
}
```

`source_registry[]` entries carry: `rule_id`, `jurisdiction`, `authority_type`,
`authority_name`, `citation_or_section`, `source`, `last_verified`,
`effective_date`, `compliance_deadline`, `status`, `confidence`, `notes`.

Validate before writing: `scripts/validate_finding.py`,
`scripts/validate_registry.py`. Do not write invalid state; fix the record
instead. `APP-AUDIT.md` and `APP-AUDIT.json` must never disagree — the Markdown
is a rendering of the JSON, not a separate account.

---

## 3. Launch readiness

| Status | Meaning |
|---|---|
| `BLOCKED` | One or more CRITICAL findings with concrete evidence, or a critical control that could not be established |
| `HIGH_RISK` | No CRITICAL, but HIGH findings in critical controls or disclosure surfaces |
| `CONDITIONAL` | Ready once specified named items are resolved; the items are listed |
| `READY_WITH_KNOWN_RISKS` | No blockers found; accepted risks are enumerated |
| `READY` | No blockers found by this audit |

**Mandatory disclaimer.** Reproduce this immediately under the status, verbatim,
in every report regardless of status:

> This is an automated technical and disclosure compliance-assistance
> assessment. A readiness status of READY means this audit found no blocking
> issues in what it examined. It is **not** a determination that the project is
> legally compliant, secure, hack-proof, or production guaranteed, and it is
> not legal advice. Unknown facts, areas outside this audit's access, and items
> in the Compliance Review Queue require human judgment.

Never write "compliant", "legally compliant", "secure", "fully secure",
"hack-proof", "production guaranteed", or "certified" as a claim about the
project anywhere in the report. Describe evidence and residual risk instead.

An `UNKNOWN` finding never upgrades readiness. If a critical control's status
is unknown, readiness cannot exceed `CONDITIONAL`.

---

## 4. Research audit trail

Report these counters in **Research Performed**, and mirror them into
`research_audit_trail` in the JSON:

| Counter | Definition |
|---|---|
| `research_agents_used` | Count of research/specialist subagents dispatched |
| `independent_codex_reviews` | Count of Codex checkpoints actually performed |
| `current_authoritative_sources_checked` | Sources verified `CURRENT` at their authority level |
| `behavioral_tests_run` | Tests exercising real behavior (consent, authorization, deletion, webhooks) |
| `static_checks_run` | Deterministic scanner and validator runs |
| `critical_findings_independently_challenged` | `n/n` — challenged over total CRITICAL findings |

The last one is reported as a fraction, and if it is not `n/n`, say which
findings were not challenged and why. Counters are counts of work performed —
never inflate them, and never count a failed Codex call as a review.

---

## 5. Codex review reporting

State the model (`gpt-5.6-sol`), the effort (`medium`), and each checkpoint's
outcome. Where Codex agreed, say so plainly; where it dissented, the dissent
belongs in the finding and, if material, in Disputed / Ambiguous Findings.

**Failure is reported, never faked.** If the CLI failed or the pinned model was
unavailable, `codex_review.performed` is `false`, `failure_reason` carries the
reported reason, and the report says the independent peer-review leg did not
run for those checkpoints. Never substitute another model, never downgrade the
pinned model, never write a review Codex did not produce.

---

## 6. Disagreement exposure

Disagreements are recorded in `disagreements.json` for **every** material
disagreement. They are **exposed in the report only when materially
decision-relevant** — that is, when the outcome would change a status, a
severity, an applicability decision, the fix order, or launch readiness.

- Materially decision-relevant and **unresolved** → Disputed / Ambiguous
  Findings, with both positions, the evidence on each side, what would resolve
  it, and the recommended decisive test.
- Materially decision-relevant and **resolved** → the finding states the
  resolution and the evidence that decided it, in one line. The full record
  stays in state.
- Not decision-relevant → state only. Do not clutter the report.

Never present a disagreement as resolved by consensus, by confidence, or by
which system said it. Only evidence resolves.

---

## 7. Output hygiene

- **No transcript dumping.** Never paste agent output, Codex output, tool
  output, or scanner output wholesale. Extract the conclusion and the evidence
  pointer; cite where it came from.
- **No chain-of-thought.** Reports carry conclusions, evidence, sources,
  confidence, disagreements, and test results only. No reasoning narration, no
  "I first considered…", no deliberation replay — neither yours nor an agent's.
- **No secret values.** Environment variable names only. A committed secret is
  reported by location and type, never by value, in the report and in state.
  Redact anything credential-shaped before it is written anywhere.
- **Evidence over adjectives.** "Missing signature verification at
  `app/api/webhook/route.ts:24`" beats "webhook handling is weak".
- **Structure over prose.** Tables for findings and modules, numbered lists for
  ordered remediation, headings exactly as in §1. A wall of undifferentiated
  paragraphs is a defect in the report.
- **Length scales with the project.** A clean five-file site gets a short
  report. Padding a thin audit to look thorough misrepresents it.
