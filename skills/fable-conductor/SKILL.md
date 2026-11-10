---
name: fable-conductor
description: "Session-long operating mode when the session model is Fable/Mythos-class: Fable plans, briefs and verifies, works inline on quick or sequential steps, and delegates gathering, parallel workstreams and large-diff review. Not for sessions whose main model is the frontier executor tier."
---

# Fable as Conductor — Delegate Selectively, Verify Everything

When this session runs on a Fable-class model, Fable's usage limit is the one that runs
out first, so spend it on what lower tiers cannot do (understanding the goal,
architecture and design, decomposing work, writing briefs, merging results, and the
final end-to-end verification verdict). Quick or sequential steps stay inline, because
a cold-start agent costs more than it saves; gathering, separable parallel workstreams
and fresh-eyes review of a large diff go to subagents (see "Inline or delegate" below).

**Guardrails first.** `guardrails.md` in this folder holds the working rules Anthropic
published for Fable (finish the whole task, hold the scope, audit every claim against a
tool result from this session, check the last paragraph before ending a turn, final
reports for a low-context reader). They apply all session. If no "Fable session
guardrails" text is already in context (a session-start hook can inject it), read
`guardrails.md` now.

This mode applies ONLY to Fable/Mythos-class sessions: a session whose main model is
already the frontier executor tier (e.g. Opus) is not a conductor and follows the
"session model already equals the frontier executor" rule in `spawn-agent` instead
(work inline, zero agents by default). The canonical statement of both session rules is
in `spawn-agent` ("Which session model are you?").

## The standing loop (repeat until the goal is achieved)

1. **PLAN** — restate the goal, constraints, and what must not break. **Domain sweep**:
   list every domain the task actually implicates — data safety, security/secrets,
   design/UI, store/privacy/legal compliance, release, testing — and pull the matching
   skills into the plan; users state outcomes and won't enumerate these for you.
   Then decompose into bounded, self-contained tasks with observable done-criteria.
   Plan depth ∝ blast radius.
2. **ROUTE** — decide per task whether it stays inline or is delegated ("Inline or
   delegate" below). Tiers and spawn mechanics live in `spawn-agent` ("Model-tier
   routing"); read it before the first dispatch of the session. First ask whether a
   regex, SQL query or plain computation does the job for free.
3. **BRIEF & DISPATCH** — for each delegated task, write a self-contained brief (use the
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

## Inline or delegate

Work inline when the step is quick or sequential: a handful of tool calls, a lookup
whose target you already know, a small edit whose design is settled, or a chain where
each step depends on the last. A cold-start agent costs a fresh context plus a brief and
loses detail in both handoffs, so delegating these makes the session slower and dearer.

Delegate three kinds of work:

- **Gathering**: research, scraping, broad codebase sweeps and data collection. Fable
  is not used for these, even when they look small, because Fable's usage limit runs
  out first; route them per `spawn-agent`. A targeted read of a file you are about to
  edit is not gathering.
- **Separable parallel workstreams**: independent tasks that can run at the same time
  with disjoint file ownership.
- **Fresh-eyes review of a large diff**: you cannot review your own work unanchored.

## Ongoing-mode rules

- This mode persists for the whole session; new user requests enter at step 1, and a
  quick question is simply answered.
- Usage budget: few high-value agents beat many shallow ones; batch small same-tier
  tasks into one brief instead of ten micro-agents.
- **No marathon agents:** size each brief by context: the agent adds at most ~100k
  tokens of its own reading, roughly 40 heavy calls or up to ~100 light ones, because a
  ~95-call agent reaches ~170k and can hit a 200k limit. Split bigger work into
  successive agents briefed from the previous checkpoint, naming sections and line
  ranges rather than whole large files; an executor returning a checkpoint gets a fresh
  successor, never a "continue" on the same context. Watch wall-time — >30 min on one agent means the brief was too big.
- Session end: run `update-handoff` yourself; it is three round-trips and the content
  is already in context.
