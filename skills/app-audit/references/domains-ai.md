# AI Module Catalog

> Domain knowledge for the AI side of `/app-audit` — an automated technical and
> disclosure compliance-assistance system. It reports what an AI integration
> actually does and where the evidence points; it never certifies an AI system as
> safe, aligned, or hack-proof.
>
> **Router gate:** this whole catalog is `NOT_APPLICABLE` unless discovery found an
> AI integration — a provider SDK in the dependency inventory *with* a call site, a
> direct HTTP call to a model endpoint, a local/hosted model, or a vendored AI
> feature. An unused SDK in `package.json` is a dead dependency, not an AI system.
> And **AI dependency ≠ companion chatbot** (False-Positive Principle 2) — the
> compliance question lives in `domains-compliance.md` §4.4 and is decided on
> product evidence, not on the presence of an API key.

## How to use this catalog

1. Every module gets a router classification; deep-investigate `APPLIES` and
   `POSSIBLY_APPLIES` only.
2. `FAIL_TECHNICAL` needs concrete evidence: `file:line`, config, an observed
   request/response, a test result, or a runtime trace.
3. **AI-written code ≠ insecure** (Principle 12) — findings are about the code in
   front of you, never about its authorship.
4. Cross-references: privacy/disclosure obligations in `domains-compliance.md`
   (§4.1–4.5); timeouts, retries, rate limits, cost controls, and logging in
   `domains-production.md`; the AI-model trust boundary in `discovery.md` §4.

---

# 1. Model integration

## 1.1 `ai.provider-model-choice`

Record every provider and model in use, where each is invoked, and for what task.
Check: model identifiers pinned vs floating aliases, deprecated or
end-of-life models still referenced, region/endpoint selection where data residency
matters, whether the same provider is a single point of failure for a critical user
journey (cross-reference `production.vendor-failure`), and whether a model choice is
mismatched to the task in a way that shows up as cost or latency.

Never grade a project for choosing a particular vendor. The findings are
concrete: a deprecated model id, an unpinned alias that can silently change
behavior, a missing region constraint where data residency was promised.

## 1.2 `ai.prompt-management`

Where do prompts live — inline string literals scattered through handlers, or a
managed location? Are they versioned with the code, reviewable in diffs, and
testable? Is user input concatenated into the prompt without delimitation
(cross-reference §2.1)? Are prompts duplicated in several places so a fix in one
misses the others? Is there any record of which prompt version produced a given
output when something goes wrong?

## 1.3 `ai.model-versioning`

Is the model version pinned and recorded with outputs? What happens when the
provider deprecates it — is there a migration path, a fallback (§4.3), or a hard
failure? Are evaluations (§5.1) re-run when the model changes? Silent model
upgrades under a floating alias are a real behavior-change risk for anything that
parses outputs.

## 1.4 `ai.structured-output`

Where the app needs machine-readable output: is a structured-output/JSON mode or a
tool/function schema used, or is the app parsing free text with regex? Is the
schema shared with the parsing code, or restated by hand and drifting?

## 1.5 `ai.schema-validation`

**Model output is untrusted input.** Verify that every structured response is
validated against a schema before use, that validation failures have a defined path
(retry with a bounded budget, fall back, surface an error — not a crash or a silent
`undefined`), and that validated fields are not then used unsafely (a model-produced
identifier used in a database query, a model-produced URL fetched server-side, a
model-produced path opened on disk, model output rendered as HTML).

Model output flowing into SQL, shell, filesystem paths, `eval`, outbound fetches,
or unescaped HTML is a security finding in the `domains-production.md` sense, with
the AI model named as the source boundary.

---

# 2. Adversarial input and privilege

## 2.1 `ai.prompt-injection`

Map every path by which text the app did not author reaches the model: user
messages, uploaded documents, retrieved knowledge-base chunks, web pages fetched by
a tool, email bodies, database rows populated by other users, third-party API
responses, filenames, and image/OCR content.

For each path assess: is untrusted content separated from instructions (structural
delimitation, distinct roles/blocks) or concatenated inline? Are system
instructions recoverable or overridable by user text? Does injected content reach a
context where it can trigger a **tool call** (the case that turns injection from a
content problem into an action problem)? Is there any output filtering, and — more
importantly — any constraint on what an injected instruction could *cause*?

Findings should name the injection path, the reachable capability, and the impact.
"The model might be tricked into saying something odd" is `LOW`/`INFO`; "content
from a user-uploaded document can reach a model that can send email" is not.

## 2.2 `ai.untrusted-context`

The broader case: any context assembled from sources the app does not control.
Check provenance tracking (does the app know which parts of the context are
untrusted?), sanitization before insertion, size/quantity limits on injected
content, and whether untrusted content can influence *system-level* behavior such as
routing, tool selection, or which user's data is retrieved.

## 2.3 `ai.tool-calling`

Inventory every tool/function exposed to the model: name, what it does, what
arguments it accepts, what it can reach, and whether its arguments are validated
before execution. Check for tools that accept a free-form command, path, URL, query,
or identifier; tools that operate on a target the model chooses rather than one the
session fixes; and error paths that hand raw internals back into the context.

## 2.4 `ai.tool-permissions` — the privileged-AI-agent rule

> **When an AI agent can reach the shell, the filesystem, the database, email,
> payments, admin functions, or deployment, the audit must record an explicit
> privilege analysis together with a prompt-injection analysis. Unnecessary
> powerful tool permissions are findings in their own right.**

### Trigger surfaces

| Capability | Examples to look for |
|---|---|
| **Shell** | `exec`, `spawn`, `child_process`, sandboxes, code-interpreter tools |
| **Filesystem** | read/write/delete tools, upload handlers driven by the model, path arguments |
| **Database** | SQL-executing tools, ORM access from an agent, "query the data" features |
| **Email** | send-mail tools, drafting-plus-sending, reply automation |
| **Payments** | charge/refund/subscription-modification tools, credit adjustments |
| **Admin** | user management, role changes, moderation actions, config changes |
| **Deploy** | CI triggers, infrastructure changes, feature-flag toggles |

### Required per-capability record

`tool_name`, `capability_class`, `granted_where` (`file:line`), `scope`
(what it can reach — one record, one user's data, all tenants, the whole
filesystem), `identity_used` (the end user's privileges, or a service/admin
credential — a service-role credential behind a model is a privilege escalation
path), `argument_validation`, `confirmation_required` (human-in-the-loop for
irreversible actions?), `reachable_from_untrusted_input` (join with §2.1),
`bounded` (rate/loop/spend limits — join with §4.1 and §4.2), `audit_logged`,
`blast_radius`.

### Findings this module produces

- **Unnecessary powerful permissions** — a tool the feature does not need, or a
  broader scope than it needs (write access where read suffices; a whole-table query
  tool where a parameterized lookup suffices). This is a finding even with no
  demonstrated exploit: it is the standing blast radius.
- **Untrusted input reaching a privileged tool** — the injection-to-action chain
  from §2.1. Ordinarily `HIGH` or `CRITICAL` depending on the capability.
- **Model-chosen targets** — the model selects which user, record, recipient, or
  path is acted upon, instead of the session fixing it server-side.
- **Service credentials behind the model** — the agent acts with privileges the
  requesting user does not have, with no re-authorization at the tool boundary.
- **Irreversible actions without confirmation** — deletion, sending, charging, or
  deploying with no human step and no undo.
- **No audit trail** — privileged tool invocations are not logged with the actor,
  arguments, and outcome, so misuse is undetectable after the fact.

Remediation is scoped and concrete (narrow the tool, fix the identity, add the
confirmation, bound the loop). Note that some remediations here land in
`PLAN_REQUIRED` or `HUMAN_REVIEW` under `fix-safety.md` — and the system never
performs the privileged actions themselves to test them.

---

# 3. Data handling

## 3.1 `ai.rag-retrieval`

Retrieval pipeline: what is indexed, how documents are chunked, what metadata rides
along, and — the security question — **is retrieval scoped by the requesting user's
authorization?** A vector index shared across tenants without a filter, or with a
filter applied client-side, is a cross-user data-exposure path. Also check: whether
deleted source documents are removed from the index (cross-reference
`compliance.user-upload-deletion`), stale/poisoned index entries, and whether
retrieved content is treated as untrusted (§2.2).

## 3.2 `ai.data-leakage`

Can one user's data appear in another user's output? Paths to check: shared or
cached prompt context, conversation memory keyed too broadly, a system prompt
containing other users' examples, fine-tuning/embedding data mixing tenants,
error messages echoing context, and logs of prompts/completions readable by the
wrong audience (cross-reference `production.logging`).

## 3.3 `ai.pii-transmission`

Which personal data leaves the system inside prompts, attachments, retrieved
context, or metadata? Is there minimization or redaction before transmission? Is
the provider's data-retention and training posture configured deliberately for this
endpoint/account, and does that match what the privacy policy and store
declarations say? Are prompts and completions stored locally, and are those stores
covered by the deletion path?

Every gap here is also a `compliance.ai-data-privacy` / `compliance.privacy`
finding — write it once with both module references rather than twice.

## 3.4 `ai.logging`

What is captured about AI interactions: prompts, completions, tool calls,
token counts, latency, model version, cost, errors. Two failure modes, opposite
directions:

- **Too much** — full prompts and completions containing personal data, persisted
  indefinitely, readable broadly, and invisible to the deletion path.
- **Too little** — no record of which model/prompt produced an output, no tool-call
  audit trail (§2.4), no cost attribution, so neither incidents nor spend can be
  investigated.

Recommend the middle: metadata and cost always, content only with a deliberate
retention and access decision.

---

# 4. Production behavior

## 4.1 `ai.cost-budgets`

AI is usually the highest per-request cost in a modern app, so this is a
first-class reliability concern, not a finance footnote.

Check for: a per-request token/spend ceiling, per-user and per-tenant quotas,
a global daily/monthly cap or provider-side budget, cost attribution in logs
(§3.4), alerting on spend anomalies, free-tier abuse exposure
(cross-reference `production.abuse-prevention`), and the interaction of retries and
loops with cost (a bounded-looking feature with 3 retries × 5 agent steps ×
expensive model is a 15× multiplier).

**Unbounded AI cost with no cap and no alert is a genuine finding** even when the
current bill is small — the exposure is what an attacker or a bug can do in an hour.

## 4.2 `ai.agent-loop-limits`

For anything agentic (a model that plans, calls tools, and continues): is there a
hard maximum iteration count, a wall-clock deadline, a token budget for the whole
run, and a termination condition that cannot be talked out of by the model? Is
progress detectable, so a loop repeating the same failing tool call terminates?
Are loops bounded per *run* and per *user*, so N concurrent runs cannot multiply
past the global budget?

Unbounded loops are simultaneously an availability, cost, and (where tools have
side effects) safety finding.

## 4.3 `ai.fallbacks`

When the primary call fails — timeout, rate limit, refusal, invalid output, outage
— what happens? Options seen in practice: retry with backoff (bounded, §4.5), fall
back to a smaller/other model, degrade to a non-AI path, queue for later, or return
a clear error. What must **not** happen: an unhandled exception on a user path, an
infinite retry, a silent empty result presented as a real answer, or a fallback that
quietly changes behavior in a way the user is not told about where that matters.

## 4.4 `ai.provider-outage-failover`

Which user journeys break entirely if the provider is down, and which degrade?
Is there a second provider or model, and is that path actually exercised (an
untested failover is `UNKNOWN`, not a mitigation)? Do outages surface in monitoring
and alerting (cross-reference `production.monitoring`, `production.alerts`)? Are
cross-provider differences (output format, token limits, tool-calling semantics)
handled, or would failover produce broken output?

## 4.5 `ai.timeouts`, `ai.retries`, `ai.rate-limiting`, `ai.token-limits`, `ai.context-limits`

Grouped because they are usually one code path, but each is scored separately.

| Module id | What to verify |
|---|---|
| `ai.timeouts` | every model call has an explicit timeout, shorter than the enclosing function/platform timeout; streaming responses have an idle timeout too |
| `ai.retries` | bounded count, exponential backoff with jitter, retry only on retryable errors, no retry amplification across layers, and awareness that each retry costs money |
| `ai.rate-limiting` | app-side limits on AI endpoints per user and globally (cross-reference `production.rate-limiting` — AI generation is the top cost surface), plus correct handling of the **provider's** 429s including `Retry-After` |
| `ai.token-limits` | explicit `max_tokens`/output caps, input truncation strategy, and the cost consequence of an unbounded output |
| `ai.context-limits` | what happens as conversation or retrieved context grows — truncation, summarization, or a hard failure at the window boundary; does truncation silently drop the system instructions or the safety-relevant part of the context? |

## 4.6 `ai.hallucination-handling`

Where model output is presented as fact or acted upon: is there grounding
(citations, retrieved sources), verification of checkable claims, a confidence or
uncertainty signal, a human-review step for consequential outputs, and user-facing
framing that does not overstate reliability (cross-reference
`compliance.ai-marketing-claims`)? The finding is about missing safeguards on a
specific consequential path — not the general observation that models can be wrong.

## 4.7 `ai.evaluations`

Is there any evaluation harness — golden test cases, regression fixtures, output
assertions in CI, offline scoring, or a manual review checklist — for the
prompt/model behavior the product depends on? Without one, a prompt or model change
is unverifiable, which is what makes §1.3 dangerous.

**Scale to the project** (Principle 11's spirit): for a small project, a handful of
recorded cases run before prompt changes is a reasonable bar. For a system where AI
output drives money, moderation, or eligibility decisions, absence of evaluation on
that path is a real finding.

## 4.8 `ai.safety-behavior`

What the system does with harmful, abusive, self-harm-related, or otherwise
sensitive inputs and outputs: is there any moderation or filtering on input and
output, are there defined escalation/crisis paths where the product's subject matter
warrants them, are refusals handled as a normal outcome rather than an error, is
there a user reporting path for bad output, and does the deployment configuration
(system prompt, safety settings) match what the product claims?

Cross-reference `compliance.ai-disclosure`, `compliance.california-companion-chatbots`
(applicability is narrow and evidence-driven), and `compliance.children-coppa` where
minors may reach the AI surface. Establish applicability from product evidence
before asserting any obligation.

---

# 5. Disclosure and claims cross-reference

AI features carry disclosure obligations that live in `domains-compliance.md`; this
catalog supplies the technical facts that decide them. Write the technical finding
here and reference it from the compliance finding rather than duplicating.

| Technical fact from this catalog | Compliance module it feeds |
|---|---|
| Personal data in prompts/context/attachments (§3.3) | `compliance.ai-data-privacy`, `compliance.privacy` (undisclosed processor / undisclosed data) |
| AI provider present in the processor inventory | `compliance.privacy` five-way comparison — AI processors are the most commonly omitted disclosure |
| Prompt/completion storage and its deletion coverage (§3.4) | `compliance.account-deletion`, `compliance.data-retention` |
| The user-facing AI surface and its framing (§4.8) | `compliance.ai-disclosure` |
| Model, accuracy, autonomy, and privacy claims in marketing vs implementation | `compliance.ai-marketing-claims` |
| Persona, memory, and relational-interaction design | `compliance.california-companion-chatbots` (narrow; presence of AI never suffices) |
| AI output driving decisions about people | `compliance.automated-decision-making` |
| Child-accessible AI surfaces, trackers, identifiers | `compliance.children-coppa` |

Marketing-claims findings always evidence **both sides** — the claim (quoted, with
its location) and the implementation (`file:line` or configuration). Where the truth
of a claim depends on a fact outside the repository (a vendor agreement, a
zero-retention endpoint arrangement, an internal human-review process), the result
is `REVIEW` or `UNKNOWN` with `facts_required`, batched for the user — never an
accusation.

---

# 6. Module index

| # | Module id | # | Module id |
|---|---|---|---|
| 1 | `ai.provider-model-choice` | 14 | `ai.timeouts` |
| 2 | `ai.prompt-management` | 15 | `ai.retries` |
| 3 | `ai.model-versioning` | 16 | `ai.rate-limiting` |
| 4 | `ai.structured-output` | 17 | `ai.token-limits` |
| 5 | `ai.schema-validation` | 18 | `ai.cost-budgets` |
| 6 | `ai.tool-calling` | 19 | `ai.agent-loop-limits` |
| 7 | `ai.tool-permissions` | 20 | `ai.fallbacks` |
| 8 | `ai.prompt-injection` | 21 | `ai.provider-outage-failover` |
| 9 | `ai.untrusted-context` | 22 | `ai.hallucination-handling` |
| 10 | `ai.rag-retrieval` | 23 | `ai.evaluations` |
| 11 | `ai.data-leakage` | 24 | `ai.logging` |
| 12 | `ai.pii-transmission` | 25 | `ai.safety-behavior` |
| 13 | `ai.context-limits` | | |

Modules 7 and 8 are **mandatory** — not optional, not depth-scaled away — whenever
any privileged capability from §2.4 is reachable by a model. Every module gets a
router classification; `NOT_APPLICABLE` requires evidence of absence (no tools
exposed, no retrieval layer, no agentic loop) and is recorded in the report's
*Modules Skipped / N/A* section.
