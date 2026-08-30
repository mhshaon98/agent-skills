# /app-audit

An automated **technical and disclosure compliance-assistance** audit for a
project you are working in. One command profiles the app, works out which
domains actually apply, investigates them with read-only specialist subagents,
does fresh authoritative research, optionally gets an independent non-Claude
peer review, and writes one consolidated report.

> **Disclaimer.** This is an automated technical and disclosure
> compliance-assistance system. It is **not legal advice**, and it does not
> certify that a project is legally compliant, secure, hack-proof, or
> production guaranteed. Its output is evidence and risk assessment for a human
> to act on. Legal wording, business-fact questions, and contract decisions are
> routed to human review by design.

---

## Normal usage

```
/app-audit
```

That is the whole thing. No arguments, no flags, no configuration. Plain
`/app-audit` runs the **full intelligent audit** and adapts its own depth to
the project.

Run it from inside the project you want audited.

---

## What happens automatically

You do not choose agents, domains, or depth — the orchestrator does.

1. **Profiling** — reads manifests, lockfiles, infrastructure, CI, database
   schemas and migrations, API routes, storage, auth, webhooks, background
   jobs, frontend routes and forms, analytics, payments, AI providers, email
   and SMS. Environment variable **names** only; values are never read into the
   report.
2. **Modeling** — builds an application profile, a per-data-type flow model
   (source → client → API → processing → storage → third parties → retention →
   deletion), and a trust-boundary map.
3. **Processor discovery** — finds third-party processors dynamically from
   dependencies, imports, SDK initialization, network calls, and config, rather
   than from a fixed list.
4. **Domain routing** — every compliance, production, and AI domain is
   classified `APPLIES`, `POSSIBLY_APPLIES`, `NOT_APPLICABLE`, or
   `INSUFFICIENT_EVIDENCE`. Only the first two are investigated deeply; the
   report lists what was skipped and why.
5. **Resource scaling** — a five-file static site gets a couple of lightweight
   passes and mostly N/A modules. A payments-plus-AI-plus-private-files SaaS
   gets the full fleet. It will not throw thirty agents at a brochure site.
6. **Parallel investigation** — read-only specialist subagents (privacy,
   security, architecture, data, payments, AI, ops) run concurrently.
7. **Fresh research** — legal and platform researchers check current
   authoritative sources with an authority order (statute → regulator →
   government guidance → platform policy → courts → other primary → secondary
   for context only), and adversarially check whether a rule has been amended,
   vacated, repealed, superseded, or challenged. Bundled reference material is
   a starting point, never the answer.
8. **Independent peer review** *(optional)* — if you have the OpenAI Codex CLI
   (or the `codex` plugin for Claude Code) installed and authenticated, a pinned
   Codex model is run read-only as a skeptic and false-positive detector. Its
   first pass never sees Claude's conclusions, so it cannot simply agree. If
   Codex is not installed or is unavailable, the checkpoints are skipped and the
   report says so; the review is never faked and the model is never silently
   downgraded.
9. **Adversarial challenge** — a dedicated reviewer attacks the audit's own
   findings, including selected **PASS** results on critical controls (auth,
   tenant isolation, payments, private storage, deletion, subscription
   cancellation, AI privileges), because a wrong PASS is worse than a
   false-positive failure.
10. **Deliberation** — where analyses materially disagree, targeted evidence is
    gathered and the disagreement is resolved on evidence, not on who said it.
    Unresolved disagreements are reported as disagreements.
11. **One report** — no transcript dumps, no reasoning dumps.

Uncertainty never becomes a pass. If a fact genuinely cannot be determined from
the repository, the finding stays `UNKNOWN` with the exact facts that would
resolve it.

### Questions it may ask you

Only for material business facts that cannot be derived from code — revenue or
user-count thresholds, testimonial authenticity, offline contracts, off-repo
backups, production processes, retention intent. They arrive **batched as one
list**, not one at a time.

---

## Modes

All optional. Plain `/app-audit` is the intended default.

| Command | What it does |
|---|---|
| `/app-audit` | Full intelligent audit, depth auto-scaled to the project |
| `/app-audit full` | Same pipeline, forced to maximum depth on every applicable domain |
| `/app-audit launch` | Launch-readiness focus: blockers, disclosures, store rules, payments, deletion, critical controls |
| `/app-audit fix` | Remediates technical failures from the last audit, honoring safety classes |
| `/app-audit fix critical` | Remediation limited to CRITICAL findings |
| `/app-audit fix safe` | Remediation limited to findings classified SAFE_AUTOFIX |
| `/app-audit verify` | Independently reproduces prior findings and claimed fixes — never trusts a diff |
| `/app-audit research` | Research only: applicability, authoritative sources, freshness. No remediation |
| `/app-audit security` | Security, auth/authorization, secrets, and abuse-surface domains only |
| `/app-audit privacy` | Privacy, tracking and consent, deletion, disclosures, and processors only |

**Only the `fix*` modes ever modify product source.** Every other mode is
read-only on your code; the only thing written is the audit's own state
directory. Fixes are classified before they are applied:

- `SAFE_AUTOFIX` — applied, then tested and independently verified
- `PLAN_REQUIRED` — planned and reviewed before anything changes
- `HUMAN_REVIEW` — surfaced for you (legal wording, business facts, retention
  policy, contract decisions)
- `PROHIBITED_AUTOFIX` — never done silently: arbitration or class-waiver
  clauses, indemnity, governing-law changes, deleting production data,
  charging cards, cancelling customers, rotating production credentials,
  deploying, publishing store changes

---

## Outputs

Written into the audited project:

| Path | What it is |
|---|---|
| `APP-AUDIT.md` | The human report — executive summary, launch readiness, profile, findings by severity, per-domain sections, disputed findings, unknown facts needed, fix order, source freshness, limitations |
| `APP-AUDIT.json` | The same audit, machine-readable |
| `.app-audit/state.json` | Resumable run state — mode, phase, routing decisions, agents run |
| `.app-audit/findings.json` | All findings, schema-valid |
| `.app-audit/source-registry.json` | Every authority relied on, with verification and effective dates |
| `.app-audit/disagreements.json` | Recorded disagreements and how they resolved |

`.app-audit/` is never committed for you — adding it to `.gitignore` is
recommended. State makes `fix` and `verify` resumable; on resume, sources past
their freshness window are re-verified before they are relied on again.

**Launch readiness** is reported as one of `BLOCKED`, `HIGH_RISK`,
`CONDITIONAL`, `READY_WITH_KNOWN_RISKS`, or `READY` — always accompanied by the
statement that `READY` means no blockers were found by this audit, not that the
project is legally compliant or secure.

---

## Requirements and optional pieces

**Required**

- Claude Code, with the 15 `app-audit-*` subagent definitions from this skill's
  `agents/` directory available to it as subagents.

**Optional**

- The OpenAI Codex CLI (or the `codex` plugin for Claude Code), for the
  independent non-Claude peer-review leg. If it is missing or the pinned model
  is unavailable, the audit still completes and the report records that Codex
  review was not performed.

**Not required**

- **Agent teams are not used.** Claude Code's agent-teams feature is
  experimental, off by default, and unavailable in headless (`claude -p`)
  runs. This system deliberately does not depend on it — it uses parallel
  independent subagents with the orchestrator running structured debate in the
  main thread. If you enable teams later, nothing here breaks and nothing here
  needs them.
- No settings.json changes, no hooks, no permissions edits.

---

## Layout

```
app-audit/
  SKILL.md                     # the orchestrator
  README.md                    # this file
  agents/                      # the 15 app-audit-* subagent definitions
  references/
    orchestration.md           # pipeline, modes, dispatch, deliberation, resumption
    research-policy.md         # depth model, authority order, freshness, stopping rule
    codex-policy.md            # checkpoints A–E, prompt templates, failure handling
    fix-safety.md              # safety classes, fix and verify workflows
    reporting.md               # report sections, JSON shape, audit trail, disclaimers
    discovery.md               # profile, data flows, trust boundaries, router inputs
    domains-compliance.md      # compliance module catalog + false-positive principles
    domains-production.md      # engineering module catalog
    domains-ai.md              # AI production and safety module catalog
  schemas/                     # finding, application profile, source registry, state
  scripts/                     # read-only validators and scanners, codex_review.sh
  fixtures/                    # test projects used to validate the audit itself
```
