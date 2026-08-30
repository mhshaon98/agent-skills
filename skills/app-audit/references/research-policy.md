# Research Policy — depth, authority, freshness, stopping

Reference for `/app-audit`. Loaded on demand by SKILL.md when assigning research
depth, dispatching research agents, or judging whether a cited source can still be
relied on.

`/app-audit` is **an automated technical and disclosure compliance-assistance
system**. Research produces cited, dated, status-checked material — never a
guarantee of legal compliance.

---

## 1. Depth model

Claude assigns a depth **per domain**, not once per audit. A single run routinely
mixes NONE and DEEP.

| Depth | Meaning | Triggers |
|---|---|---|
| **NONE** | No external research; the check is a stable technical fact | Stable technical check, e.g. a committed password |
| **LIGHT** | Confirm one current spec or policy page | Verify one current spec/policy |
| **STANDARD** | Multiple authoritative sources, cross-checked | Ordinary compliance questions with settled law and clear applicability |
| **DEEP** | Decomposed independent research; primary text plus regulator guidance plus applicability, checked separately | Unclear legal applicability, recent law change, conflicting platform rules, large financial or security exposure, AI regulation, minors, privacy-sensitive data |
| **FORENSIC** | Exhaustive: primary text, status history, enforcement posture, counterarguments, decisive tests | Critical vuln, possible data exposure, cross-tenant compromise, payment integrity, high-impact legal ambiguity, conflicting authoritative sources, strong Claude/Codex disagreement |

Depth escalates during a run. A STANDARD question that surfaces two authorities in
conflict becomes FORENSIC by trigger, not by discretion. Depth never quietly
de-escalates — record the reason if it does.

Depth also scales the fleet: a five-file static brochure site earns NONE/LIGHT
almost everywhere and two or three lightweight analyses total. Never spend thirty
agents on it.

---

## 2. Fresh research is mandatory for time-sensitive compliance

**Bundled reference packs are starting points only.** Anything shipped inside this
skill — module notes, remembered thresholds, prior audits' source registries, this
file's own examples — is a lead, never a citation.

Fresh research is **mandatory** before relying on any time-sensitive compliance
finding: platform store policies, subscription and auto-renewal rules, AI-specific
regulation, privacy thresholds and deadlines, anything with a compliance date, and
anything whose enforceability has been litigated.

The concrete failure mode this prevents: citing a rule that has been vacated,
enjoined, superseded, or has not yet taken effect. Verify the current status of a
rule **before** citing it — the FTC click-to-cancel rule is the standing example of
a rule whose status must be re-checked, never assumed. Never apply vacated or
outdated rules.

A finding that rests on an unverified remembered rule is not a finding. Downgrade it
to `UNKNOWN` with the research step named, or do the research.

---

## 3. Authority order

For compliance research, prefer sources in this order. Cite the highest tier that
actually settles the question, and say which tier each citation is.

1. **Statutory / regulatory text** — the law itself, by section.
2. **Regulator / enforcement agency** material — the body that enforces it.
3. **Official government guidance** — advisories, FAQs, rulemaking notices.
4. **Official platform policy** — the platform's own published rules.
5. **Court decisions** — including orders that vacate, stay, or enjoin.
6. **Other authoritative primary material.**
7. **Secondary analysis** — law-firm posts, news, blogs. **Context only.** A
   secondary source may point you to a primary source; it may never be the sole
   support for a finding.

**Minimum authorities**, consulted where relevant to the domain:

- **FTC** — advertising, endorsements/testimonials, subscriptions, negative option.
- **California Legislature** — statutory text for California obligations.
- **CPPA** — California Privacy Protection Agency regulations and guidance.
- **U.S. Copyright Office** — copyright, registration, AI-authorship questions.
- **Apple Developer** — App Store Review Guidelines, privacy/nutrition-label rules.
- **Google Play Developer** — Play policy, Data safety requirements.

Jurisdiction is part of the citation. A rule that applies in California is not a
finding about a user in another state until applicability is established.

---

## 4. Adversarial source checking

Required for every **consequential** finding — anything CRITICAL or HIGH, anything
that would block a launch, and anything whose remediation costs real work.

For each governing authority:

1. **Locate the governing primary authority** — the actual text, not a summary of it.
2. **Verify the section** — the specific subsection you are relying on, quoted or
   pinpointed.
3. **Verify the current status** — see the status enum in §6.
4. **Verify the effective date** — in force today, or upcoming?
5. **Verify applicability** — to this business, this data, this platform, this
   jurisdiction, at this scale.
6. **Run the change sweep.** Search explicitly for each of:
   **amended** · **vacated** · **repealed** · **superseded** · **effective** ·
   **compliance deadline** · **injunction** · **court challenge** ·
   **new regulation** · **updated policy**
7. **Compare regulator guidance against platform guidance.** They diverge often —
   a platform may demand more than the law, or lag behind it.
8. **Record conflicts** rather than resolving them by preference. A documented
   conflict between two authorities is a legitimate result and usually raises depth
   to FORENSIC.

A sweep that returns nothing is itself a recorded result ("no amending action found
as of `<date>`"), with the date, so the next run knows what was checked and when.

---

## 5. Decomposed independent research

For important legal questions, do **not** ask one agent for the whole answer.
Decompose into separate questions given to **separate agents**, each of which must
not see the others' conclusions:

| Agent | Question |
|---|---|
| Statutory text | What does the primary text actually say, by section? |
| Regulator guidance | How does the enforcing body interpret and apply it? |
| Applicability | Do this project's facts bring it within scope, and what facts are missing? |

The orchestrator synthesizes. Agents must **never be copies of each other's
conclusions** — an applicability agent told "the statute clearly applies" has been
anchored and its independence is gone.

Add further decomposition where the question warrants: platform policy as its own
agent, status/vacatur history as its own agent (`app-audit-source-verifier`),
effective-date timeline as its own agent. Independent agreement between decomposed
agents is meaningful; agreement between anchored agents is not.

**Evidence wins, never model votes.** Three agents agreeing is not proof.

---

## 6. Source registry

Every rule relied on is recorded in `<project>/.app-audit/source-registry.json`,
validated against `schemas/source-registry.schema.json`.

Per rule:

| Field | Notes |
|---|---|
| `rule_id` | Stable identifier used by findings' `authoritative_sources` |
| `jurisdiction` | US-CA, US-federal, platform, etc. |
| `authority_type` | Tier from §3 (statute, regulator, guidance, platform, court, primary, secondary) |
| `authority_name` | FTC, California Legislature, CPPA, U.S. Copyright Office, Apple Developer, Google Play Developer, … |
| `citation_or_section` | Pinpoint section — not just a document title |
| `source` | URL |
| `last_verified` | Absolute date of the last verification |
| `effective_date` | When it takes / took effect |
| `compliance_deadline` | If any |
| `status` | Enum below |
| `confidence` | VERY_HIGH · HIGH · MEDIUM · LOW |
| `notes` | Conflicts found, sweep results, scope caveats |

**Status enum:** `CURRENT` · `UPCOMING` · `SUPERSEDED` · `VACATED` · `REPEALED` ·
`UNDER_CHALLENGE` · `UNKNOWN`

`UNDER_CHALLENGE` and `UPCOMING` are reportable states in their own right — a rule
that takes effect next quarter belongs in the report as an upcoming obligation, not
as a current violation.

### 6.1 Freshness windows

Configurable defaults. `scripts/freshness_check.py` flags breaches.

| Source class | Window |
|---|---|
| Fast-changing platform policies (Apple, Google Play) | **30 days** |
| Active or newly enacted regulation | **30 days** |
| Stable statute | **90 days** |
| Engineering references (framework docs, provider APIs) | Longer — judged by release cadence |

Past the window → mark **`SOURCE_REVIEW_REQUIRED`** → **re-research before relying on
it.** A stale source may not support a FAIL_TECHNICAL finding; the finding waits for
re-verification or is reported with the staleness stated.

Resuming a prior audit (`fix` / `verify`) re-runs the freshness check on every
time-sensitive source before any of it is reused.

---

## 7. Stopping rule

Stop researching a question when **all** of these hold:

- applicability is clear (or the missing facts are named precisely);
- primary evidence has been found — the actual text, not a description of it;
- the behavior has been reproduced, where the question is behavioral;
- credible counterarguments have been checked, not merely imagined;
- any Codex disagreement is resolved or documented;
- further research is unlikely to change the finding.

If applicability turns on a business fact the repo cannot supply (revenue, California
user counts, testimonial provenance, offline contracts, retention intent), stop and
emit **UNKNOWN** with the exact `facts_required` listed. Batch those questions for
the user; never ask one at a time, and never guess a threshold into a PASS or a FAIL.

Uncertainty never becomes PASS.

---

## 8. Research-agent output format

Research agents return exactly these fields:

```
question
conclusion
confidence
authoritative_sources
key_evidence
contrary_evidence
applicability
unknowns
recommended_follow_up
```

All agents additionally return: findings, evidence, confidence, contradictory
evidence, questions, recommended follow-up, sources.

Companion formats for reference (full catalog in the domain files):

- **Security agents** add: `finding`, `attack_precondition`, `attack_path`,
  `affected_boundary`, `evidence`, `reproduction`, `impact`,
  `false_positive_conditions`, `recommended_test`.
- **Architecture agents** return: `area`, `current_design`, `strengths`,
  `failure_modes`, `scaling_constraints`, `unnecessary_complexity`,
  `recommended_changes`, `priority`, `evidence`.

`contrary_evidence` is not optional. An agent that found none says so explicitly —
an empty contrary-evidence field with no statement reads as an unperformed check.

---

## 9. No chain-of-thought

**No chain-of-thought anywhere** — not in agent returns, not in the source registry
notes, not in APP-AUDIT.md, not in APP-AUDIT.json, not in the audit trail.

Return only: **conclusions, evidence, sources, confidence, disagreement, test
results.** No deliberation narrative, no "first I thought… then I realized…", no
agent transcripts dumped into the report, no hidden reasoning appendix.

Research agents also carry the standing non-negotiables: read-only, no product-source
edits ever, environment variable **names** only and never secret values, and no
secrets of any kind reproduced in output.
