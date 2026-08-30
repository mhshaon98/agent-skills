---
name: spawn-agent
description: Use BEFORE spawning any subagent (research, implementation, review, debugging) or choosing a model for delegated work. Gate, brief-writing procedure, and model-tier routing; usage limits are a real budget.
---

# Spawning Agents & Choosing Model Tiers

Default answer: **don't spawn.** One focused conductor pass with the right model
beats a swarm. Most successful sessions used zero subagents.

## The gate — spawn only when at least one is true

- **Independent parallel workstreams** exist (e.g. three unrelated subsystems).
- **Fresh eyes matter** — review/QA of your own large diff.
- **Context isolation matters** — a broad sweep would pollute the main context with
  file dumps you only need the conclusion from.
- **The task is huge and separable** — and merging results beats doing it serially.

Never spawn for: tasks under ~30 minutes of focused work, sequential work where each
step depends on the last, or thoroughness theater. Budget check: "what does this
agent produce that I can't get with one search or one focused hour?" Vague answer →
don't spawn.

## Model-tier routing

**HARD RULE:** research, web scraping, data collection, and codebase exploration never
run on your most expensive reasoning tier — use the most token-efficient model that can
do the job. Reserve the top tier for orchestration, hard architecture decisions, and
code that really matters.

Think in four tiers rather than in specific model names, and route down aggressively:
anything above the cheapest capable tier is a call you should be able to justify in one
sentence.

| Tier | Use for |
|---|---|
| **Frontier** (your strongest general executor, medium effort) — the DEFAULT for delegated work | Anything carrying judgment or ambiguity: design, implementation in unfamiliar code, code review (default reviewer tier), debugging, security-sensitive surfaces, high-blast-radius migrations, research needing judgment, dense-document reasoning |
| **Workhorse** (a slightly cheaper frontier-family model) — work already specified | Execution where the plan is decided: implementing an agreed spec, mechanical-but-nontrivial refactors, verification passes, careful sweeps, multi-step tool work, doc work needing care |
| **Mid** (Sonnet-class) — genuinely simple tasks only | Short text/copy generation, web scraping, simple multi-step sweeps, classification |
| **Fast** (Haiku-class) — the most mechanical tasks | Boilerplate, mechanical edits, formatting, icons/asset drudgery, repetitive file sweeps, straightforward tests, doc updates |

Judgment work starts at the frontier tier; **drop a tier** when the task is already
specified and bounded, and **drop further** to Sonnet/Haiku only when it is genuinely
simple (copy, icons, scraping, mechanical sweeps, formatting, classification). Raise an
agent's reasoning effort (or reconsider the plan) when two attempts failed or the change
touches shipped user data. Reviewers and security agents get the frontier tier — review
is judgment work.

**The alias trap — pin the tier you mean.** The Agent tool's `model` parameter takes
aliases, and a family alias resolves to the *newest* model in that family. Pass one and
your whole subagent fleet silently moves to a different model the day a new one ships —
changing cost and behavior with no diff anywhere. If you care which model runs a spawn,
define a subagent type whose frontmatter pins the exact model id and spawn via
`subagent_type`, not via the alias. Keep one such definition per tier you actually use
(a frontier executor and a workhorse executor is usually enough).

**Pre-filter with code, not AI:** before any model call, ask whether a regex, SQL
query, or plain computation can shrink the job so the model only judges/narrates a
shortlist. Cache model outputs keyed by data-state.

## The brief (agents start cold — a vague brief wastes the whole run)

```
ROLE: <Investigator / Implementer / Reviewer / Debugger / Docs — ONE role>
MODEL TIER: <frontier / workhorse / mid / fast — spawn via a subagent type that pins
the model, never via a bare family alias.>
CONTEXT (assume you know nothing else):
- Project: <name + one-liner + root path>
- Relevant state: <the 3–6 facts this task depends on>
- Read first: <specific files, in order — not "explore the repo">
TASK: <one bounded objective — if tempted to write "and also…", split or don't spawn>
OWNERSHIP / BOUNDARIES:
- May modify: <exact files/dirs — disjoint from every other agent's set>
- Do NOT touch: <files, data stores, config, anything live/production>
- Do NOT: install packages / change schemas / commit / <task-specific bans>
DEFINITION OF DONE: <observable criteria, not "improve" or "look into">
REPORT BACK: 1) conclusions first  2) evidence (commands + output + file:line)
3) NOT verified list  4) surprises (report, don't fix)
```

## Orchestration rules

- Non-overlapping ownership; two agents needing the same file → serialize.
- **Bug-fix briefs: fix the CLASS, then grep for siblings.** A reviewer reports
  instances; the brief must order the agent to search the codebase for every other
  occurrence of the same pattern and fix or report those too. (Real escape: a
  capture-loss guard was applied to the 2 reported drag handlers while 4 siblings —
  2 of them in the same file — kept the identical bug for a full release.)
- **Bound every brief.** A task should finish in ≤~100 tool calls; bigger phases become
  successive agents, each briefed from the previous one's checkpoint. No "read first:
  <the whole design system>" — name the sections needed. An agent past ~30 min of
  wall-time is re-sending a huge cached context every single turn, which is how a
  delegation budget disappears without anything visibly going wrong. Consider a
  `PreToolUse` hook that warns and then denies past a call/context threshold, so a
  runaway agent returns a checkpoint instead of grinding.
- The conductor keeps: goal ownership, architecture, sequencing, merging findings,
  all user communication, the final verification verdict.
- Conductor merges all reports into ONE coherent plan — never let agents negotiate
  with each other through you.
- **Verify agent work like user-reported claims**: no evidence → unverified;
  spot-check diffs and re-run key commands yourself. An agent's "done" is an input,
  not a verdict.
