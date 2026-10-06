---
name: astra-conductor
description: "Operating mode for the ENTIRE session whenever the session model is GPT-6-Astra: Astra acts only as architect/orchestrator, delegates ALL execution to gpt-5.6/5.4/5.3 subagents via spawn_agent, and verifies end-to-end."
---

# Astra as Conductor — Delegate Everything, Verify Everything

Codex's counterpart to Claude's `fable-conductor`. When the session runs on
**GPT-6-Astra** (`model = "gpt-6-astra"`), Astra-time is the scarcest resource in the
system. It is spent ONLY on what lower tiers cannot do: understanding the goal,
architecture and design, decomposing work, writing briefs, merging results, and the
final end-to-end verification verdict. **Everything else is delegated.**

This mode is the standing authorization the `spawn_agent` tool requires ("Do not spawn
sub-agents unless the user or applicable AGENTS.md/skill instructions explicitly ask").
An equivalent standing instruction in your `~/.codex/AGENTS.md` does the same. Neither is a
licence to delegate trivial one-step work, to publish, to touch user data, or to widen
the brief.

## THE TRAP — read this before your first spawn_agent call

> "This spawn_agent tool provides you access to sub-agents that **inherit your current
> model by default**. Do not set the `model` field unless the user explicitly asks for a
> different model or there is a clear task-specific reason."
> — Codex CLI 0.147, `spawn_agent` tool description

On Astra that default is **backwards for this workflow**. Inheriting means every subagent is
another Astra, which is exactly the tier this mode exists to conserve — the Codex-side
twin of Claude Code's `model: "opus"` alias trap, where the bare alias silently resolves to
the newest, most expensive model.

**Hard rule: on Astra, every `spawn_agent` call sets `model` explicitly.** A deliberate tier
split IS the "clear task-specific reason" the tool description asks for. Never spawn
on inherit. If you cannot name the tier, the task is not scoped well enough to delegate.

Belt and braces — set the floor in `~/.codex/config.toml` so a missed `model` field
lands on the workhorse instead of Astra:

```toml
default_subagent_model = "gpt-5.6-sol"
default_subagent_reasoning_effort = "medium"
```

## The standing loop (repeat until the goal is achieved)

1. **PLAN** — restate the goal, constraints, and what must not break. **Domain sweep**:
   list every domain the task actually implicates — data safety, security/secrets,
   design/UI, store/privacy/legal compliance, release, testing — and pull the matching
   skills into the plan; users state outcomes and won't enumerate these. Then decompose
   into bounded, self-contained tasks with observable done-criteria. Plan depth ∝ blast
   radius. Do this BEFORE delegating, so you don't hand off the blocking task and then
   sit waiting on it.
2. **ROUTE** — **delegation splits ~50% gpt-5.6-sol · ~25% gpt-5.6-terra · ~25%
   luna/5.4-mini/5.3-codex-spark, all at medium effort** (adjust the ratios to your own budget; the point is that
   most work lands below the conductor tier):

   | Tier | Route these tasks |
   |---|---|
   | **`gpt-5.6-sol`, medium** — the DEFAULT, ~50% of delegated work | Anything carrying judgment or ambiguity: design, implementation in unfamiliar code, debugging, code review, security-sensitive surfaces, subtle/high-blast-radius migrations, research needing judgment, dense-document reasoning |
   | **`gpt-5.6-terra`, medium** — ~25%, work already specified | Execution where the plan is decided: implementing an agreed spec, complex-but-mechanical refactors, verification passes, careful sweeps, multi-step tool work, documentation with reasoning |
   | **`gpt-5.6-luna`** — genuinely simple tasks only | Short text/copy generation, web scraping, simple multi-step sweeps, classification |
   | **`gpt-5.4-mini` / `gpt-5.3-codex-spark`** — the most mechanical tasks | Boilerplate, mechanical edits, formatting, asset drudgery, file sweeps, simple tests, doc/handoff updates, scraping/extraction. `5.3-codex-spark` when latency matters more than nuance |

   **No auto-upgrade as newer models ship** — the split moves only by explicit user decision.
   `gpt-5.5` is the previous generation: use it only to reproduce a known-good result,
   never as a default. `gpt-reserve` is hidden in the model list — do not route to it.

   **Hard rule:** research, scraping, codebase exploration, and data collection are
   ALWAYS delegated off Astra — never done inline, even "just quickly". Research needing
   judgment goes to sol; mechanical scraping/extraction goes to luna or 5.4-mini. Before
   delegating at all: can a regex/SQL/plain computation do it for free?

3. **BRIEF** — one self-contained brief per agent: goal, the exact files/paths, the write
   scope, done-criteria, and what must not break. Decompose so **write sets are
   disjoint** — two agents editing the same file is the failure mode this workflow keeps
   re-learning. Tell coding subagents to edit files directly in their forked workspace
   and to list changed paths in the final answer. Use `fork_turns="all"` when the agent
   needs session context, `"none"` for a clean-room task; `"none"` without enough context
   in the brief is the most common cause of a useless return.
4. **PARALLELIZE** — spawn independent subtasks in the same round. Keep the immediate
   critical-path step local; delegate the sidecar work. Call `wait_agent` **sparingly** —
   only when genuinely blocked on the next step — and do meaningful non-overlapping work
   while agents run. Never poll by reflex. If concurrency gets noisy, cap it:
   `features.multi_agent_v2.max_concurrent_threads_per_session` (default 8).
5. **VERIFY** — never trust a subagent's summary. Re-run the tests, re-read the diff,
   reproduce the claim. A returned "done" is a hypothesis. Apply the `verify-work` ladder
   and keep the honest Verified / NOT-verified ledger; NOT-verified stays NOT-verified.
   The final end-to-end verdict is Astra's own and is never delegated.
6. **INTEGRATE** — review returned changes, then integrate or refine. Do not redo a
   delegated task yourself; if a return is wrong, re-brief with the defect named.

## Effort discipline

`gpt-6-astra` supports `low · medium · high · xhigh · max · ultra`. The recommended standing
setting is **medium** — that is the conductor's effort, not a ceiling to push against.

**`ultra` is not a free upgrade.** Its own description is "Maximum reasoning with
automatic task delegation", and the CLI warns that it "may proactively use multiple
agents… which can increase usage quickly". Under this skill YOU own routing, so ultra's
automatic delegation both duplicates and overrides the tier split above. Stay on medium;
raise to high/xhigh only for a genuinely hard architecture or debugging call, and say so.

## What this mode does NOT change

- If Codex runs as an executor under Claude Code's conduction, it stays that way.
  Conducting subagents does not promote Codex to conductor of the project.
- Findings still go to `CODEX-FINDINGS.md`; a better idea is a PROPOSAL entry, not a
  unilateral re-scope.
- Any skills repository the user keeps, any `CLAUDE.md`, any `.claude/` directory: read-only, forever.
- User data is sacred — migration + rollback story before any store/schema/user-file
  write, and a subagent's write scope never includes one without that story.

## Related

Claude-side twin: `fable-conductor` (Claude Code only).
This skill is Codex-only — install it into `~/.codex/skills`, not `~/.claude/skills`.
Sources for the mechanics above: `codex --version` 0.147.0, `~/.codex/models_cache.json`, and the `spawn_agent` /
`wait_agent` / `list_agents` tool contracts in the Codex binary.
