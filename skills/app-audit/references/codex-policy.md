# Codex Policy — independent peer review

Reference for `/app-audit`. Loaded on demand by SKILL.md whenever a Codex checkpoint
is reached, a disagreement must be arbitrated, or the Codex handshake fails.

**This whole leg is optional.** It requires the OpenAI Codex CLI — or the `codex`
plugin for Claude Code — to be installed and authenticated. If you do not have it,
skip every Codex checkpoint, record `codex_review.performed = false`, note the
absence in the report's *Audit Limitations*, and run the audit without it. Do not
simulate a Codex review with a Claude subagent and label it Codex.

`/app-audit` is **an automated technical and disclosure compliance-assistance
system**. Nothing in this file — including a Codex agreement — may be reported as a
guarantee of legal compliance or security.

---

## 1. Role — peer reviewer, never orchestrator

Codex (GPT-5.6 Sol) participates as an **independent peer reviewer**. Claude
orchestrates the audit and performs final synthesis; Codex never does.

Codex is used as:

| Function | What it means here |
|---|---|
| Independent peer reviewer | Reads the code/context itself, forms its own conclusions |
| Skeptic | Refuses to inherit Claude's framing of a finding |
| Counterexample generator | Produces the legitimate-implementation explanation Claude missed |
| Implementation reviewer | Judges whether a fix actually solves the issue |
| False-positive detector | Argues a flagged item is not in fact a defect |

**Codex never:**

- decides the audit plan, the module routing, or the depth assignment;
- writes the report, or any part of it, in its own voice;
- resolves a disagreement by authority — only by evidence Claude can re-check;
- **writes, creates, edits, moves, or deletes any file, anywhere.** Every audit-time
  prompt is review-only. This is absolute for the skill's own files and it holds for
  the audited project too — product source is modified only by
  `app-audit-implementer`, only in explicit fix mode.
- runs in a writable sandbox. All audit-time calls are read-only.

Claude keeps the pen. Codex supplies an adversarial second read.

---

## 2. Model requirement — `gpt-5.6-sol`, effort `medium`

**Both halves are mandatory and both must be passed explicitly on every call.**

- **Model:** `gpt-5.6-sol` (GPT-5.6 Sol). Confirm it is present in your Codex model
  list before relying on it (`~/.codex/models_cache.json`); if you pin a different
  reasoning-grade model, change it here and in `scripts/codex_review.sh` together so
  the wrapper and this policy never disagree.
- **Reasoning effort:** `medium`.

**Why effort must be stated explicitly:** *Sol's default reasoning effort is LOW.* A
call that omits the effort flag silently runs a low-effort review. A low-effort pass
produces shallow agreement — it tends to confirm whatever it is shown rather than
generate counterexamples — which destroys the entire value of the checkpoint while
still populating `codex_review.performed = true`. A silently-low review is worse than
no review, because it manufactures false assurance in the audit trail.

**Never downgrade.** If the pinned model is unavailable, that is a **reported failure**,
not a cue to fall back to another model. Do not substitute a different Codex model,
do not drop to effort low, do not "approximate" the review with a Claude subagent and
label it Codex.

**Never edit `~/.codex/config.toml`.** The pin travels on the command line.

---

## 3. Canonical invocation — `scripts/codex_review.sh`

All audit-time Codex calls go through the wrapper. Do not hand-roll the command.

```
scripts/codex_review.sh PROMPT_FILE [WORKDIR]
```

- `PROMPT_FILE` — path to a file containing the full prompt (prompts are long and
  contain quotes and code; a file avoids shell-quoting corruption).
- `WORKDIR` — optional; the wrapper `cd`s there first so Codex reads the audited
  project rather than the skill directory.

Behavior contract:

| Outcome | Wrapper does |
|---|---|
| Success | Prints Codex's output on stdout, exits **0** |
| Companion route fails | Silently tries the `codex exec` fallback |
| Both routes fail | Prints `CODEX_UNAVAILABLE: <reason>`, exits **2** |

The wrapper **never fabricates output** and **never downgrades the model** — a
wrong or unavailable model is a reported failure.

### 3.1 Underlying command lines

**Primary route — codex companion `task` (read-only):**

```
node <companion> task --model gpt-5.6-sol --effort medium "<prompt>"
```

`<companion>` is `scripts/codex-companion.mjs` from the OpenAI codex plugin
(v1.0.6, driving `codex app-server` over JSON-RPC). `$CLAUDE_PLUGIN_ROOT` is **UNSET**
outside the plugin, so the wrapper locates the companion by globbing and taking the
newest version:

```
~/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs
```

Never pass `--write` during an audit.

**Fallback route — `codex exec` (proven shape):**

```
codex exec --skip-git-repo-check -s read-only -c model="gpt-5.6-sol" -c model_reasoning_effort="medium" "<prompt>" </dev/null
```

The trailing `</dev/null` is **mandatory** — without it the call hangs for roughly
eight minutes waiting on stdin.

**Alternative main-thread route** (when the orchestrator is dispatching through the
Agent tool rather than Bash): `subagent_type: codex:codex-rescue`, forwarding
`--model gpt-5.6-sol --effort medium <brief>`. Same model/effort pin, same read-only
and never-write rules.

---

## 4. Failure handling — `CODEX_UNAVAILABLE`

When the wrapper exits 2 with `CODEX_UNAVAILABLE: <reason>`:

1. **Report it clearly** to the user, in the run output and in the report's *Codex Review
   Summary* and *Audit Limitations* sections, including the reason string.
2. **Mark every affected finding** `codex_review.performed = false`, with
   `agreement: null` and a `summary` naming the failure (e.g.
   `"CODEX_UNAVAILABLE: model gpt-5.6-sol not found"`).
3. **Continue the Claude analysis.** A Codex outage degrades corroboration; it does
   not cancel the audit.
4. **Lower confidence where corroboration was load-bearing.** A CRITICAL finding that
   was to be confirmed at checkpoint B and was not cannot carry VERY_HIGH confidence
   on Claude's read alone.
5. **Never silently downgrade** — no other model, no reduced effort, no quiet retry
   that changes the pin.
6. **Never fabricate a review.** Do not write a plausible "Codex would say…" summary.
   Do not relabel a Claude adversarial pass as a Codex review. An empty Codex column
   is an honest audit; an invented one is a corrupted audit.

Retry once for transient causes (timeout, transport error). Do not retry a model-not-
found or auth failure — those are configuration facts, and the user needs to see them.

---

## 5. Anchoring rules

**First-pass prompts NEVER reveal Claude's conclusions.** No finding titles, no
severities, no statuses, no "we suspect", no hint of which files Claude considers
guilty beyond the scope needed to read them. An anchored Codex is a mirror, not a
reviewer.

Sequence, always in this order:

1. **Unanchored pass.** Codex inspects the material independently and reports what it
   finds.
2. **Comparison.** Claude — not Codex — diffs the two independent reads.
3. **Targeted second pass, only if there is material disagreement.** Only here may
   both positions be shown, and only through the disagreement template, which strips
   attribution.

### 5.1 Peer-review prompt template (verbatim base)

Use as-is; append only the scope/context block ("Review the following files: …") and
never a conclusion.

> You are acting as an independent peer reviewer. Do not assume Claude's findings
> are correct. Review the provided code/context independently. Tasks: 1 identify
> material issues; 2 look for false positives; 3 look for issues Claude may have
> missed; 4 challenge applicability assumptions; 5 evaluate severity; 6 cite
> concrete code/config evidence; 7 suggest tests that would resolve uncertainty;
> 8 do not modify files unless explicitly asked. Return concise structured
> findings.

Note item 8 is a floor, not a licence: in `/app-audit` Codex is **never** explicitly
asked to modify files.

### 5.2 Disagreement prompt template (verbatim base)

Used only in a second pass, after an unanchored first pass produced a material
conflict. Present both positions **without saying which is Claude's and which is
Codex's** — the template's own instruction depends on that anonymity.

> Two analyses disagree about the following question: QUESTION … Here is relevant
> concrete evidence … Independently determine which conclusion is better supported.
> Do not choose based on who proposed the conclusion. Identify: strongest evidence,
> missing evidence, likely answer, confidence, recommended decisive test.

---

## 6. Checkpoints A–E

| ID | Checkpoint | Ask Codex for | Mandatory when |
|---|---|---|---|
| **A** | Architecture understanding | Independent summary of architecture, data flows, trust boundaries, dependencies, risk areas | Substantial projects (real backend, auth, data, or money). Skip for a static brochure site. |
| **B** | Finding review | Reproduce the issue, counterevidence, its own confidence, missed exploit paths, false-positive possibility | **Every CRITICAL** finding and every important **HIGH** finding |
| **C** | Remediation-plan review | Regressions, security holes, migration hazards, missing edge cases, simpler alternatives | Before any large or consequential change — schema/auth/storage/queue work, anything in PLAN_REQUIRED |
| **D** | Post-fix diff review | Does the diff solve the issue? Does it introduce new problems? Are the tests sufficient? | HIGH/CRITICAL remediation, and any fix touching a trust boundary |
| **E** | Final red team | What was missed, weak PASSes, unstated assumptions, next investigations worth running | Substantial apps, before completing the audit |

**A is run unanchored by construction** — Codex has not yet been told anything about
Claude's read. **B and E first passes are unanchored too.**

### 6.1 Strategic use — do not spend Codex on trivia

Codex checkpoints cost real time and budget. Send Codex work where an independent
read can actually change the answer:

- **Do send:** CRITICAL/HIGH findings, ambiguous applicability, security boundaries,
  payments/idempotency, deletion completeness, tenant isolation, AI privilege, weak
  PASSes on critical controls, plans with migration risk.
- **Do not send:** a committed secret that is plainly a secret, a broken link, a
  missing `alt` attribute, a lint-level style point, a stable technical check with
  NONE research depth, or any finding whose evidence is a single unambiguous line.
- **Batch** related findings into one checkpoint-B prompt rather than one call per
  finding, as long as batching does not leak Claude's conclusions.
- On a tiny project, checkpoints A and E may both be skipped; B still applies if a
  CRITICAL surfaces.

---

## 7. Deliberation loop (max 2–3 rounds)

Triggered only by **material** disagreement — one that would change a finding's
status, severity, or applicability. A wording difference is not a disagreement.

```
        ┌─────────────────────────────────────────────┐
        │ Claude finding (independent)                │
        │ Codex review    (independent, unanchored)   │
        └──────────────────────┬──────────────────────┘
                               ▼
                  ┌────────────────────────┐
                  │ 1. COMPARE EVIDENCE    │
                  │ material conflict?     │
                  └───────┬────────────┬───┘
                       no │            │ yes
                          ▼            ▼
                    ┌──────────┐   ┌───────────────────────────────┐
                    │ record & │   │ 2. SPAWN TARGETED WORK        │
                    │ move on  │   │ research agent / behavioral   │
                    └──────────┘   │ test / source verification    │
                                   └───────────────┬───────────────┘
                                                   ▼
                                   ┌───────────────────────────────┐
                                   │ 3. RECONSIDER on new evidence │
                                   │ (Claude may concede outright) │
                                   └───────────────┬───────────────┘
                                                   ▼
                                   ┌───────────────────────────────┐
                                   │ 4. OPTIONAL targeted Codex     │
                                   │ follow-up — disagreement       │
                                   │ template, positions anonymized │
                                   └───────────────┬───────────────┘
                                                   ▼
                                   ┌───────────────────────────────┐
                                   │ 5. SYNTHESIZE                  │
                                   │ resolved → finalize finding    │
                                   │ unresolved → REVIEW/UNKNOWN +  │
                                   │ disagreement record            │
                                   └───────────────┬───────────────┘
                                                   │
                        round < 3 and NEW concrete evidence emerged?
                                   ├── yes ──► back to step 2
                                   └── no  ──► stop, document
```

**Cap: 2–3 rounds.** Exceed it only while *new concrete evidence* keeps emerging —
never to keep re-arguing the same evidence. On exit without resolution the finding
becomes **REVIEW** (or **UNKNOWN** if the blocker is a missing business fact), with
`disagreement_ref` set. It never becomes PASS.

**Evidence wins, never model votes.** "Claude and two subagents agree" is not proof;
one reproduction is. Codex conceding is not proof either — Claude re-checks the
evidence Codex cited before adopting its position.

---

## 8. Disagreement record

Written to `<project>/.app-audit/disagreements.json`. Each finding involved carries
`disagreement_ref` pointing at the record `id`.

```json
{
  "id": "DIS-001",
  "question": "",
  "claude_position": "",
  "codex_position": "",
  "research_agent_positions": [],
  "evidence_for": [],
  "evidence_against": [],
  "resolution": "",
  "confidence": ""
}
```

- `question` — the single decidable question, not a topic.
- `claude_position` / `codex_position` — conclusion plus the evidence each relied on.
- `research_agent_positions` — independent positions from any agents spawned in
  step 2 of the loop.
- `evidence_for` / `evidence_against` — concrete artifacts (file:line, config,
  request/response, test result), not arguments.
- `resolution` — how it ended: which position the evidence supported, or
  `UNRESOLVED` plus the decisive test that was not runnable.
- `confidence` — confidence in the resolution, on the standard VERY_HIGH..LOW scale.

Disagreements appear in APP-AUDIT.md's *Disputed / Ambiguous Findings* section
**only when materially decision-relevant**. Do not dump the deliberation transcript,
and do not include chain-of-thought from either side — conclusions, evidence,
sources, confidence, and test results only.
