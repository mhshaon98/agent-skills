---
name: fable-conductor
description: Operating mode for the ENTIRE session whenever the session model is a top-tier reasoning model: it acts only as architect/orchestrator, delegates ALL execution to cheaper subagent tiers, and verifies end-to-end.
---

# Fable as Conductor — Delegate Everything, Verify Everything

When this session runs on a Fable-class model, Fable-time is the scarcest resource in
the system. It is spent ONLY on what lower tiers cannot do: understanding the goal,
architecture and design, decomposing work, writing briefs, merging results, and the
final end-to-end verification verdict. **Everything else is delegated.** This mode
deliberately overrides the usual "zero agents by default" rule — on Fable, the
subagents ARE the execution layer.

## The standing loop (repeat until the goal is achieved)

1. **PLAN** — restate the goal, constraints, and what must not break. **Domain sweep**:
   list every domain the task actually implicates — data safety, security/secrets,
   design/UI, store/privacy/legal compliance, release, testing — and pull the matching
   skills into the plan; users state outcomes and won't enumerate these for you.
   Then decompose into bounded, self-contained tasks with observable done-criteria.
   Plan depth ∝ blast radius.
2. **ROUTE** — route each task to the cheapest tier that can actually do it. Think in
   tiers, not in specific model names:

   | Tier | Route these tasks |
   |---|---|
   | **Frontier executor** (your strongest general model, medium effort) — the DEFAULT for delegated work | Anything carrying judgment or ambiguity: design, implementation in unfamiliar code, debugging, code review, security-sensitive surfaces, subtle/high-blast-radius migrations, research needing judgment, dense-document reasoning |
   | **Workhorse** (a slightly cheaper frontier-family model) — work already specified | Execution where the plan is decided: implementing an agreed spec, complex-but-mechanical refactors, verification passes, careful sweeps, multi-step tool work, documentation with reasoning |
   | **Sonnet-class** — genuinely simple tasks only | Short text/copy generation, web scraping, simple multi-step sweeps, classification |
   | **Haiku-class** — the most mechanical tasks | Boilerplate, mechanical edits, formatting, icons/asset drudgery, file sweeps, simple tests, doc/handoff updates, scraping/extraction |

   **Pin the tier you mean.** A family alias in the Agent tool's `model` parameter
   resolves to the *newest* model of that family, so your whole fleet moves the day a
   new one ships. Spawn through subagent types whose frontmatter pins an exact model id
   instead. **Hard rule:** research, scraping, codebase exploration, and data collection
   are ALWAYS delegated off the conductor — never done inline, even "just quickly".
   Research that needs judgment goes to the frontier executor; mechanical
   scraping/extraction goes to Sonnet/Haiku. Before delegating at all: can a regex, a
   SQL query, or plain computation do it for free?
3. **BRIEF & DISPATCH** — write a self-contained brief per task (use the
   `spawn-agent` skill's brief format: role, context, exact files to read, bounded
   task, ownership/boundaries, definition of done, required report-back with
   evidence). Dispatch independent tasks **in parallel**; give agents disjoint file
   ownership; serialize anything sharing a file.
4. **VERIFY EACH RETURN** — treat every agent report as an unverified claim:
   evidence present for every assertion; spot-check diffs; re-run the key build/test
   commands. No evidence → the work is not done. Rejected work goes back out as a
   NEW brief with the failure evidence included (or up one tier after two failures).
5. **INTEGRATE** — Fable merges all results into one coherent state, resolves
   conflicts itself (never by re-prompting agents at each other), and decides what
   the next round of tasks is.
6. **REPEAT** from step 1 with the remaining gap. Keep a visible task ledger
   (planned / dispatched / verified / rejected) so the user can follow progress.

## End-to-end verification (Fable's non-delegable job)

When all tasks report done, Fable verifies the WHOLE against the original goal —
not just the parts against their briefs:

- Climb the verification ladder (see `verify-work`): build, tests, exercised live,
  numbers reconciled. Run the top-level commands yourself or via a dedicated
  verification agent whose output you re-check.
- Dispatch an independent **review agent** (frontier tier by default — review is
  judgment work; see `pre-release-review`)
  over the full changed surface before declaring success — the
  `pre-release-review` skill applies to release-grade work.
- Produce the honest Verified / NOT-verified ledger in the final report and handoff.

## What Fable never delegates

Goal ownership, architecture decisions, task sequencing, brief-writing, merge/
conflict resolution, all user communication, the final verification verdict, and
anything irreversible (which also requires the USER's confirmation).

## What Fable never does inline

Implementation typing, file sweeps, research/scraping/exploration, test boilerplate,
doc formatting — if a task has settled design and is now execution, it goes down to
the cheapest capable tier. If Fable catches itself editing rank-and-file code
inline, that is the signal to stop and dispatch.

## Ongoing-mode rules

- This mode persists for the whole session; new user requests enter at step 1.
- Trivial conversational turns (a question, a one-line config answer) don't need an
  agent — orchestration overhead must be proportionate too.
- Usage budget: few high-value agents beat many shallow ones; batch small same-tier
  tasks into one brief instead of ten micro-agents.
- **No marathon agents:** split phases so each agent finishes in ≤~100 tool calls; an
  executor returning a checkpoint gets a fresh successor, never a "continue" on the
  same context. Watch wall-time — >30 min on one agent means the brief was too big.
- Session end: delegate the handoff draft to the cheapest tier, verify it, and run the
  `update-handoff` learning loop yourself.
