---
name: fable-conductor
description: "Session-long operating mode when the session model is Fable/Mythos-class: Fable plans, briefs and verifies; execution is delegated to Opus/Sonnet/Haiku subagents."
---

# Fable as Conductor — Delegate Everything, Verify Everything

When this session runs on a Fable-class model, Fable time is the scarcest resource in
the system, so spend it on what lower tiers cannot do (understanding the goal,
architecture and design, decomposing work, writing briefs, merging results, and the
final end-to-end verification verdict) and delegate the rest. This mode
deliberately overrides the usual "zero agents by default" rule — on Fable, the
subagents ARE the execution layer.

This mode applies ONLY to Fable/Mythos-class sessions: a session whose main model is
already the frontier executor tier (e.g. Opus) is not a conductor and follows the
"session model already equals the frontier executor" rule in `spawn-agent` instead
(work inline, zero agents by default).

## The standing loop (repeat until the goal is achieved)

1. **PLAN** — restate the goal, constraints, and what must not break. **Domain sweep**:
   list every domain the task actually implicates — data safety, security/secrets,
   design/UI, store/privacy/legal compliance, release, testing — and pull the matching
   skills into the plan; users state outcomes and won't enumerate these for you.
   Then decompose into bounded, self-contained tasks with observable done-criteria.
   Plan depth ∝ blast radius.
2. **ROUTE** — tiers, split and spawn mechanics are in `spawn-agent` ("Model-tier
   routing"); read it before the first dispatch of the session. In short: the pinned
   frontier executor (e.g. current Opus) for anything that is real work, Sonnet- or
   Haiku-class only for the genuinely simple or mechanical, and never a bare family
   alias like `model: "opus"`, because that alias means "newest in the family". On
   Fable, research, scraping, exploration and data collection are always delegated,
   even when it would be quick inline, because Fable time is the scarce resource.
   First ask whether a regex, SQL query or plain computation does the job for free.
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
- Session end: run `update-handoff` yourself; it is three round-trips and the content
  is already in context.
