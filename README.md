<p align="center">
  <a href="https://mhshaon98.github.io/agent-skills/">
    <img src="assets/banner.svg" alt="Agent Skills Catalog — animated terminal installing skills" width="100%">
  </a>
</p>

<p align="center">
  <a href="https://mhshaon98.github.io/agent-skills/"><b>🔍 Browse the catalog GUI →</b></a>
  &nbsp;·&nbsp;
  <a href="AGENTS.md">For agents: AGENTS.md</a>
  &nbsp;·&nbsp;
  <a href="skills.json">skills.json</a>
</p>

<p align="center"><sub>Last updated: 2026-09-13 · 22 skills · 11 playbooks</sub></p>

# Agent Skills Catalog

A catalog of battle-tested [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
skills in the `SKILL.md` format — small, load-on-demand instruction packs that give a
coding agent hard-won engineering discipline: session continuity, verification,
data safety, release review, delegation, formatting, and auditing. The same folders are
auto-discovered by [OpenAI Codex CLI](https://github.com/openai/codex) from
`$CODEX_HOME/skills`, so one source of truth serves both tools. Every skill here was
distilled from real project work, not written to look good in a README.

## Point your agent here

The fastest way in: paste this repo's URL to any capable agent and say

> **"List the skills in this repo and help me install some."**

The agent should read [`AGENTS.md`](AGENTS.md), fetch the [`skills.json`](skills.json)
manifest, show you the catalog grouped by category, and install **only** the ones you
pick into `~/.claude/skills/` (or `~/.codex/skills/`). It will not preinstall anything —
selection is your call.

### Or install it yourself (humans)

```bash
git clone --depth 1 https://github.com/mhshaon98/agent-skills
cd agent-skills

./install.sh                 # interactive: lists the catalog, install what you pick
./install.sh verify-work spawn-agent   # install named skills
./install.sh --all           # install everything
./install.sh --codex         # install into ~/.codex/skills instead of ~/.claude/skills
```

On Windows use `install.ps1` (`.\install.ps1`, `.\install.ps1 -All`, `.\install.ps1 -Codex`).
New skills load on your agent's next session start.

## Catalog

The tables below are generated from [`skills.json`](skills.json) — the manifest is the
source of truth. Each skill links to its `SKILL.md`.

### Workflow

| Skill | What it does |
| --- | --- |
| [bug-ledger](skills/bug-ledger/SKILL.md) | Use whenever a bug is reported, discovered, fixed, or reopened, or before working in a historically bug-prone area. Maintains the cumulative bug ledger (BUG_LIST.md) — many "new" bugs are old ones recurring or a fix that regressed, so check it BEFORE debugging. |
| [call-handoff](skills/call-handoff/SKILL.md) | Cold-start a session from the project's newest handoff in a strict token budget. Use at session start or when the user says "call handoff", "catch up", or "where did we leave off" — reads the newest HANDOFF-*.md, open bugs, and project docs, reports a briefing, fixes generic session titles, and stops. |
| [new-project](skills/new-project/SKILL.md) | Bootstrap a brand-new project with proven architecture defaults and continuity scaffolding. Use when starting a new project from scratch, or when touching a legacy project that has no handoff/git/structure yet. |
| [session-start](skills/session-start/SKILL.md) | Use at the start of ANY work session on a project — before reading code or making changes — and when joining an unfamiliar or legacy project. Runs the startup ritual — newest handoff, bug ledger, project docs — then restates the goal. |
| [update-handoff](skills/update-handoff/SKILL.md) | End-of-session wrap-up in one efficient pass — updates the handoff, memory, changelog, and bug ledger as needed, and writes NEXT-SESSION-PROMPT.md so the next session starts instantly. Use when the user says "update handoff", "wrap up", "end the session", or before context runs out. |

### Safety

| Skill | What it does |
| --- | --- |
| [app-audit](skills/app-audit/SKILL.md) | Runs an automated technical and disclosure compliance-assistance audit of a project — profiling, domain routing, read-only specialist subagents, fresh authoritative research, optional independent peer review, and one consolidated report. It also runs the `compliance-check` skill in embedded mode to verify what is actually live (store labels, published policies, deployed backend, retention jobs). Plain `/app-audit` with no arguments runs the full intelligent audit; the optional modes are full, launch, fix, fix critical, fix safe, verify, research, security, and privacy. |
| [compliance-check](skills/compliance-check/SKILL.md) | Live compliance close-out for an app or website - verifies what is ACTUALLY live (store listing and privacy labels, published policy pages, deployed backend, retention jobs, deletion, consent notices, ops floor) against the code and the published words, reconciles audit finding statuses against current code, then works the remediation runbook item by item with production-safe patterns. Use on `/compliance-check`, "what's left on compliance", "close out the audit", before a store submission, or when app-audit calls it. Modes: check (default, read-only), closeout, store, retention, health-data, reconcile, embedded. |
| [pre-release-review](skills/pre-release-review/SKILL.md) | Use when the user says "ship it", "release", "submit", "deploy", "push to production", before any production push, or after any large diff. Mandatory independent review pass — never skip because "the diff looks fine". |
| [safe-data-write](skills/safe-data-write/SKILL.md) | Use BEFORE any write, migration, or deletion touching precious user data — data stores, schemas, user-owned files (Excel workbooks, databases, documents). User data is sacred; these rules were learned from shipped data-loss bugs. |
| [security-pass](skills/security-pass/SKILL.md) | Use when touching auth, API keys, secrets, RLS/policies, payment or personal data, any new endpoint that writes, or live backends — and before any release. Security and secrets checklist; every rule traces to a real production finding. |
| [verify-work](skills/verify-work/SKILL.md) | Use BEFORE claiming work is "done", "complete", "working", or "fixed", and before writing a handoff or completion summary. Verification ladder plus the honest Verified/NOT-verified ledger — "verified" is a claim about evidence, not confidence. |

### Delegation

| Skill | What it does |
| --- | --- |
| [antigravity-bridge](skills/antigravity-bridge/SKILL.md) | Delegate bounded work to Google's Antigravity CLI (agy, Gemini models) from inside Claude Code, and get a third-provider second opinion. Use when the user says "ask antigravity", "ask gemini", "send this to agy", when Claude and Codex disagree and a tie-breaker is needed, or when cheap bounded research/sweeps would otherwise burn Claude subagent budget. |
| [astra-conductor](skills/astra-conductor/SKILL.md) | Operating mode for the ENTIRE session whenever the session model is GPT-6-Astra: Astra acts only as architect/orchestrator, delegates ALL execution to gpt-5.6/5.4/5.3 subagents via spawn_agent, and verifies end-to-end. |
| [codex-bridge](skills/codex-bridge/SKILL.md) | Delegate tasks to OpenAI Codex or get a cross-provider second review from inside Claude Code via the official codex plugin. Use when the user says "ask codex", "have codex review/check this", "send to codex", or before a release when a non-Claude reviewer adds value. |
| [cowork-relay](skills/cowork-relay/SKILL.md) | Coordinate work split between Claude Cowork and Claude Code on the same project — Cowork does the maximum possible, sandbox-blocked steps go to Claude Code, and each side ends by writing a copy-paste relay prompt for the other. |
| [fable-conductor](skills/fable-conductor/SKILL.md) | Operating mode for the ENTIRE session whenever the session model is a top-tier reasoning model: it acts only as architect/orchestrator, delegates ALL execution to cheaper subagent tiers, and verifies end-to-end. |
| [spawn-agent](skills/spawn-agent/SKILL.md) | Use BEFORE spawning any subagent (research, implementation, review, debugging) or choosing a model for delegated work. Gate, brief-writing procedure, and model-tier routing; usage limits are a real budget. |

### Formatting

| Skill | What it does |
| --- | --- |
| [apply-richformat](skills/apply-richformat/SKILL.md) | Rich formatting for any text-bearing surface — app screens, documents, reports, READMEs, chat answers, terminal output, data tables. Use on walls of undifferentiated text, when building or reviewing such a surface, or when the user says "rich formatting", "text vomit", "needs better structure", "make this readable". |
| [slop-clean](skills/slop-clean/SKILL.md) | Deep-dive sweep of the current project for AI slop, in design and in copy. Only runs when the user explicitly invokes /slop-clean; never self-trigger. |

### Tooling

| Skill | What it does |
| --- | --- |
| [client-cms](skills/client-cms/SKILL.md) | Analyze the current website project and intelligently add a secure, client-facing content-management/admin system so authorized nontechnical users can update approved website content without editing source code. Use when the user invokes /client-cms, asks to add an admin panel/dashboard for site content, or wants website content editable by a client/business owner. |
| [commissioning-logger](skills/commissioning-logger/SKILL.md) | Use ONLY when explicitly asked to log/document/track a multi-step hands-on process (commissioning, wiring, network bring-up, setup, troubleshooting, runbooks) — "log this", "start a commissioning log", "write it up as we go". Keeps a log.md plus a Word doc with annotated screenshots. |
| [usage-here](skills/usage-here/SKILL.md) | Report what THIS session has cost — tokens and dollars by model, share of the 5-hour and weekly limits, and the three most expensive prompts. Use whenever the user says "usage here", "what did this session cost", "how much have I burned", "token usage", or asks about limits mid-session. |

## Playbooks

[`playbooks/`](playbooks/README.md) holds the longer reference docs the skills lean on —
architecture defaults, verification, security, model/agent strategy, token efficiency,
Cloudflare cost safety, and Remotion video recipes. Agents read the relevant one on
demand; they are not installed. See the [playbooks index](playbooks/README.md).

## What a skill is

A skill is a directory with a `SKILL.md` at its root. The file starts with YAML
front-matter (a `name` and a `description` that tells the agent *when* to reach for it),
followed by the instructions themselves. Some skills carry extra files — scripts,
templates, references — alongside the `SKILL.md`.

- **Loads on demand.** The agent reads a skill's body only when the task matches its
  description, so a large catalog costs almost nothing until it is actually needed.
- **Installing is just copying the folder.** Drop `skills/<name>/` into
  `~/.claude/skills/<name>/` (Claude Code) or `~/.codex/skills/<name>/` (Codex CLI).
  There is no build step and nothing to register — the agent discovers it next session.

## Related upstream skills

These third-party skills are not vendored here — they live in their own repos and pair
well with this catalog. Follow the links to install from source.

- [remotion-dev/skills](https://github.com/remotion-dev/skills) — the recommended video framework: programmatic React video, captions, rendering (`npx skills add remotion-dev/skills`). Chosen over HyperFrames after a head-to-head on output quality.
- [last30days](https://github.com/mvanhorn/last30days-skill) — broad multi-source social-sentiment research over the last 30 days.
- [defuddle skill](https://github.com/kepano/obsidian-skills) — extract clean markdown from web pages, token-efficiently.
- [agent-browser](https://github.com/vercel-labs/agent-browser) — browser-automation CLI built for AI agents.
- [impeccable](https://github.com/pbakaus/impeccable) — design-system craft skill for frontend UI work.
- [taste-skill](https://github.com/Leonxlnx/taste-skill) — elite UX/UI and motion-engineering taste.
- [design-motion-principles](https://github.com/kylezantos/design-motion-principles) — build or audit UI motion with intent.

## License

[MIT](LICENSE). Use, copy, and adapt freely.
