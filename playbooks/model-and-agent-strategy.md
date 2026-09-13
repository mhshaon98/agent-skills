# Model & Agent Strategy

Goal: the **minimum model/agent setup that can still do the job safely and well**.
Usage limits are a real budget. Quality is bought with focus, not with tokens.

Model names below are tier roles, not endorsements of a specific version — map them to
whatever your provider currently offers.

---

## 0. Hard rules

### 0a. Research and scraping never run on the top tier

The most expensive (above-flagship) models are never used for research, web scraping,
data collection, codebase exploration, or other information-gathering. Those tasks run on
the frontier/workhorse tier when they need judgment, and on mid/fast tiers when they are
simple extraction.

Top-tier models are reserved for:
- Conductor/orchestration work (the main session managing a project)
- Hard architecture decisions
- Highly important or security-sensitive code

If the conductor itself runs on a top-tier model, it must **delegate** research/scraping
to subagents on lower tiers rather than doing that work inline.

### 0b. Subagents INHERIT the session model — an explicit tier is mandatory

Omitting the model on a subagent spawn is not "use the default tier" — it means "use
whatever the main session is running". A review workflow launched with no model set on
a top-tier session silently runs every agent on the top tier.

- Every agent spawn (including agents inside workflow scripts) **must** state its tier
  explicitly. A spawn that names no tier is a bug, like a missing schema. Grep workflow
  scripts for agent calls and check before running.

### 0c. Pin models explicitly — aliases can auto-upgrade

Aliases like `opus` resolve to "the newest model in that family", so they silently move
the tier the day a new one ships. If your policy pins a specific version, express the pin
where it actually holds — e.g. custom agent definitions whose frontmatter names the exact
model ID and effort — and spawn through those definitions, never through a bare alias.
Verify the pin with real usage data; don't assume.

### 0d. State the agent count before launching a fleet

A review designed as 6 finders × a verifier per finding can balloon to dozens of agents
without anyone doing the arithmetic. In a real case, a 2-agent pass found the
release-blocking bug in one round — the fan-out would have bought nothing.

- Compute the total agent count (including per-item verifiers), and state it with the
  model tier, **before** launching. Get a go-ahead for anything beyond a handful.
- Prefer "few agents, each self-refuting its own findings" over "many finders + a
  separate verification wave": confirmation inside one context is far cheaper and
  usually just as effective.
- Scope the fleet to the *surface being reviewed*, not to how important the work
  feels. Two well-briefed reviewers over ~10 files each beat a swarm.
- **"Stop" means stop** — never stop one fleet and immediately launch a replacement.

## 1. Model tiers

All delegated work at **medium reasoning effort** by default; raise effort only when two
attempts failed or the change touches shipped user data.

| Tier | Use for | Examples |
|---|---|---|
| **Frontier** (current flagship, medium effort) — the default for judgment | System/feature design, implementation in unfamiliar code, debugging, code review, security-sensitive surfaces, high-blast-radius migrations, research needing judgment, dense-document reasoning | Designing a sync/conflict model; the pre-release review that must not miss anything; root-causing a data-loss bug |
| **Workhorse** (previous flagship or equivalent, medium effort) — work already specified | Implementing an agreed spec, mechanical-but-nontrivial refactors, verification passes, careful sweeps, second-pass cleanup, doc work needing care | Feature sessions once the idiom was agreed; applying a reviewed fix list across a codebase |
| **Mid** (Sonnet-class) — genuinely simple tasks | Short copy generation, web scraping, simple multi-step sweeps, classification/filtering, summarizing already-gathered facts | Follow-up phrasing/summarization; briefing distillation |
| **Fast** (Haiku-class) — the most mechanical tasks | Boilerplate, simple edits, formatting, file cleanup, asset drudgery, repetitive sweeps, straightforward tests, doc typo fixes | Feedback distillation; writing a handoff from a session record |

Start judgment work on the frontier tier; **drop to workhorse** when the task is already
specified and bounded, and **drop further** only when it is genuinely simple. New model
releases do not move the default automatically — changing the pin is a deliberate
decision.

## 1b. The burn model

Burn ≈ fixed context × round-trips: every tool round-trip re-reads the session's
entire fixed context, so batching independent calls and one gathering script beat
serial exploration every time.

## 2. Pre-filter with code, not AI (the biggest quota saver)

Before spending any model call, ask: *can a regex, SQL query, or plain computation shrink
this?* Proven patterns:

- **Candidate gathering**: an SQL/regex pre-pass finds candidates → ONE mid-tier call
  filters/phrases them. Not one call per item.
- **AI insights**: all statistics computed in plain code; the model is handed a fact
  sheet and only *narrates* it ("quote, don't compute"). This is also the
  anti-hallucination guard.
- Deterministic where determinism matters: health checks, timelines, and candidate
  gathering use **no AI at all**.

Also: **cache model outputs keyed by data-state** so the model runs at most once per
meaningful change.

## 3. When to use agents at all

Default answer: **don't**. One focused conductor pass with the right model beats a swarm.
Most sessions need zero subagents to ship verified work.

Use agents when at least one of these is true:
- **Independent parallel workstreams** exist (e.g. investigate three unrelated subsystems).
- **Fresh eyes matter** — review/QA of your own large diff (you are blind to your own bugs).
- **Context isolation matters** — a broad codebase sweep would pollute the main context
  with file dumps you only need the conclusion from (use an explore-type agent).
- **The task is huge and separable** — and merging results is cheaper than doing it serially.

Never use agents for: tasks under ~30 minutes of focused work, sequential work where each
step depends on the last, or "thoroughness theater."

## 4. The agent roster (pick dynamically, almost never all of them)

The conductor (the main session) always keeps: goal ownership, architecture decisions,
task sequencing, merging findings, all user communication, and the final verification
verdict. Agents get bounded, self-contained briefs.

| Agent | When it earns its cost | Responsibility |
|---|---|---|
| **Codebase Investigator** (read-only) | Unfamiliar/large codebase, "where does X happen" across many files | Locate + summarize; returns conclusions, not file dumps |
| **Implementation Agent** | Well-specified, separable chunk of build work | Build exactly the brief; report what was done + what wasn't verified |
| **Review/QA Agent** | **Always before a release/submission**; after any large diff | Independent pass over the full changed surface, hunting real bugs. Routinely catches shipping bugs; skipping it is the most common regret |
| **Debugging Agent** | A reproducible bug resists two conductor attempts | Isolate root cause; propose minimal fix; no drive-by refactors |
| **Docs/Handoff Agent** | End of a long session, cheap model is fine | Update the handoff from the session record |
| **UI/UX Agent** | Only for large visual surfaces; visual taste is iterative — expect the conductor to do final rounds with the user directly | Implement to the exact idiom spec, screenshot evidence |
| **Data/DB Agent** | Schema design, migration scripts, RLS policies | Additive migrations, rollback story, run security advisors |
| **Security/Privacy Agent** | Live backend, auth, keys, anything user-data-exposed | Advisor runs, key hygiene, permission-prompt boundaries |

Model per agent follows §0 and §1: investigator/research/scraping agents never run on the
top tier — mechanical extraction on fast/mid tiers, research needing judgment on the
frontier tier; docs/handoff agents on fast models; implementation, review, security, and
debugging agents on the frontier tier by default (review is judgment work), dropping to
workhorse when the work is already specified and bounded.

## 5. Orchestration rules

- **Non-overlapping ownership**: each agent gets disjoint files/areas. If two agents must
  touch the same file, serialize them.
- **Self-contained briefs**: an agent prompt must carry everything it needs (paths, the
  goal, constraints, what "done" means, what NOT to touch). Agents start cold.
- **Structured report-back**: require each agent to return (1) what it did/found,
  (2) evidence (commands run, output, line refs), (3) explicit "not verified" list,
  (4) surprises. No evidence → treat the claim as unverified.
- **Conductor merges**: read all reports, resolve conflicts yourself, produce ONE
  coherent plan/diff. Never let agents negotiate with each other through you.
- **Verify agent work like user-reported claims**: spot-check diffs, run the build/tests
  yourself before accepting. An agent's "done" is an input, not a verdict.
- **Budget check before spawning**: ask "what does this agent produce that I can't get
  with one search or one focused hour?" If the answer is vague, don't spawn.
- **Bounded workers**: give each agent a context/tool-call budget; when it runs long it
  writes a checkpoint (done / remaining / files touched / how to verify) and returns, and
  the conductor spawns a successor from it.

## 6. Cost heuristics summary

- Don't over-research: read the newest handoff + the files you'll touch, not the whole repo.
- Don't over-plan: plan depth ∝ blast radius, not task size.
- Don't over-agent: 0 agents is the default; 1 reviewer before release is the norm;
  2–3 agents is a big session; more needs justification.
- Don't re-derive: handoffs + memory exist so history is read, not recomputed.
- Do spend on: pre-release review, data-migration design, security passes. These are the
  places where cheap turns out expensive.
