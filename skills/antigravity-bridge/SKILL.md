---
name: antigravity-bridge
description: Delegate bounded work to Google's Antigravity CLI (agy, Gemini models) from inside Claude Code, and get a third-provider second opinion. Use when the user says "ask antigravity", "ask gemini", "send this to agy", when Claude and Codex disagree and a tie-breaker is needed, or when cheap bounded research/sweeps would otherwise burn Claude subagent budget.
---

# Antigravity Bridge — the third provider tier

`agy` is Google's Antigravity CLI (notes below were verified against v1.1.26, installed at
`~/.local/bin/agy`, on a Google AI Pro subscription). **Requires the Antigravity CLI to be
installed and signed in; without it this skill does nothing.** Unlike `codex-bridge` this is **not a plugin** — there are no
`/antigravity:*` slash commands. Claude calls it through one wrapper and nothing else.

**Its value is a third, non-Claude, non-OpenAI opinion on a budget that is genuinely
small.** It is the LIGHT tier — not where the big workload goes.

Everything below was verified on macOS unless marked otherwise. CLI behavior churns; re-check
anything that surprises you.

## 0. Prerequisite check — every time, before promising anything

```bash
<skills-dir>/antigravity-bridge/scripts/agy-run.sh --timeout 60 -- "reply with exactly: ready"
```

Exit codes tell you what to say, then **STOP** — never improvise a substitute, never
shell out to a bare `agy`:

| rc | Meaning | What to tell the user |
|---|---|---|
| 125 | not installed on this machine | `curl -fsSL https://antigravity.google/cli/install.sh \| bash` |
| 126 | not signed in | "Run `agy` in your terminal once and complete the Google login." Sign-in belongs to the user — never enter credentials on their behalf. |
| 4 | tool calls denied → workspace not trusted | see §3 |
| 3 | agy returned a JSON `status:ERROR` envelope | read the `error` field; usually a bad flag combination |
| 124 | timed out | report it; don't retry blindly, it costs quota either way |
| 127 | ran but emitted nothing even under a pty | report; treat the bridge as down |

Install and auth are **per-machine**: a machine that has never installed and signed in has
no bridge, regardless of what other machines have. **Sign-in is never automated**: `agy` has
no `login` subcommand, so the user runs `agy` once interactively rather than anything
launching a full-screen TUI unattended. On Windows the CLI lives in `%LOCALAPPDATA%\agy\bin`;
Windows behavior is unverified here.

## 1. The wrapper is the only entry point

```bash
agy-run.sh [--model SLUG] [--timeout 600] [--format text|json|stream-json]
           [--schema FILE] [--dir PATH] [--write]
           [--continue|--conversation ID] -- "<prompt>"
```

It exists because five things bite otherwise, all confirmed by hitting them:

- **`-p` takes its prompt as a flag VALUE, not a positional.** `agy -p --effort medium "text"`
  silently swallows `--effort` as the prompt. The wrapper always emits `--print="$PROMPT"` last.
- **`~/.local/bin` is not on the Bash tool's PATH.** The wrapper prepends it.
- **An open non-TTY stdin makes agent CLIs wait forever** (the `codex exec` lesson —
  it hangs silently with zero output). The wrapper always closes stdin.
- **`agy` exits 0 even when its JSON envelope says `status:ERROR`, and even when every
  tool call was denied.** Both are caught and turned into real exit codes (3 and 4).
- **No hard timeout = a hung session.** Always set (default 600s).

Issue #76 (`agy -p` emitting nothing on a pipe) did **NOT** reproduce on v1.1.26 — piped
output works. The pty fallback via `script` stays in as a safety net; if it ever fires it
prints a warning to stderr. Git Bash on Windows has no `script`, so if #76 ever bites
there the bridge is simply unavailable on that machine — say so, don't fake it.

Long jobs go out with `run_in_background`, never foreground — a foreground call blocks
the session for its whole duration.

## 2. Model policy (binding)

**Claude picks the model — not the CLI's default.** Effort rules: **high is allowed on Flash models** (the cheap tier); everything
else is **medium or low, never high, never max**. The wrapper enforces this — a non-Flash
`-high` slug or any `claude-*` slug exits 2 before spending a token.

`agy` **bakes reasoning effort into the model slug**, so `--model` and `--effort` are
mutually exclusive — passing both is a hard error. The wrapper drops `--effort` whenever
a model is pinned.

Slugs verified present at time of writing (`agy models` — re-check, they churn):

| Slug | Use it for |
|---|---|
| `gemini-3.8-flash-medium` | **default** — newest Flash, the right pick for routine work |
| `gemini-3.8-flash-high` | escalate here when the analysis is genuinely hard; high is permitted on Flash |
| `gemini-3.7-flash-medium` / `gemini-3.6-flash-medium` | only to reproduce or compare against an older run |
| `gemini-3.1-pro-low` | when Pro's depth genuinely matters — **Pro has no medium tier**, only high and low, and high is banned outside Flash, so Pro is available at `-low` only |
| `gpt-oss-120b-medium` | an open-weights third voice; rarely the best pick |
| `claude-sonnet-4-6`, `claude-opus-4-6-thinking` | **BANNED.** Paying Google quota for Claude's own blind spots defeats the entire bridge. |

## 3. Workspace trust and denied actions

`agy` only lets the agent touch files inside a **trusted workspace**. Verified:

- **Trust IS inherited by subdirectories.** If the home directory is trusted, every project
  under it is covered. One grant at the home directory is enough per machine; a new machine
  still needs its own grant.
- Trust is granted interactively: the user runs `agy` once inside the directory and accepts.
  It lands in `~/.gemini/antigravity-cli/settings.json` → `trustedWorkspaces`.
- **Claude does not edit that file** — it is an app permission setting. Ask.

**`denied_actions` in the response is usually NOT an error.** In read-only mode (no
`--write`) `RunCommand` is denied by design, and the run normally still succeeds through
file reads. Judge by the `response` field, not the denial:

| Symptom | Meaning |
|---|---|
| `denied_actions` present, `response` non-empty | Normal. The wrapper notes it on stderr and returns the answer. |
| `denied_actions` present, `response` **empty** | Real failure (wrapper exits 4): the task needed shell access (re-run with `--write`, ask the user first), or the directory is outside every trusted workspace. |

Never report an empty response as if it were the model's opinion.

**Prompt shape matters in read-only mode.** Asked to
"read these two files and review them", `gemini-3.8-flash-high` reached for `RunCommand`
(`cat`/`grep`), was denied, and returned an empty response in 12s. It does not fall back
to its file-reading tool on its own. Open any read-only brief with:

> IMPORTANT: you are in read-only mode. Shell/terminal commands are DENIED and will fail.
> Use ONLY your file-reading tool. Do not attempt cat, ls, grep, sed or any RunCommand.

With that line the same brief succeeded in 2 turns. Without it, expect exit 4.

## 4. Write access — ask first, every time

`--write` passes `--dangerously-skip-permissions`: agy auto-approves every tool call,
including file writes and shell commands. **There are no approval prompts in headless
mode** — the run either has access or it doesn't (same as `codex exec`).

- Default is **read-only**; reviews, research and analysis never need `--write`.
- `--write` needs the user's explicit yes for that specific task, and a **clean git tree** so
  the diff is reviewable and revertible.
- Scope with `--dir`; never hand it a directory wider than the task.
- `--sandbox` exists but is untested here — don't claim it as a safety net until proven.

## 5. Quota is the real constraint — route accordingly

Google AI Pro is roughly **250 units / 5h plus a ~2,800 weekly baseline, shared with the
Antigravity IDE**. Google does not publish exact figures; treat these as approximate and
check the account when it matters. That is a few dozen substantial delegations a week —
an order of magnitude below the Codex and Claude-subagent budgets.

| Work | Goes to | Why |
|---|---|---|
| Scope, architecture, phasing, release calls | **Claude (me)** | Conductor. Never delegated. |
| Implementation needing judgment, debugging unfamiliar code | Claude subagent, frontier model | Frontier tier |
| Specified, bounded, mechanical-but-nontrivial work | Claude subagent, workhorse model | Workhorse |
| Substantial delegated coding, deep root-cause, adversarial review | **Codex** | Bigger budget, proven bridge |
| Tie-breaker when Claude and Codex disagree | **Antigravity** | Third provider family |
| Cheap bounded research, doc lookups, mechanical sweeps | **Antigravity** | Preserves Claude subagent budget |
| Anything long-running, open-ended, or high-stakes | **NOT Antigravity** | Quota won't survive it |

Before an obviously expensive run, say what it costs in quota terms and let the user decide.
Don't discover the limit by hitting it.

## 6. The collaboration contract

Same shape as `codex-bridge`, so the three-agent setup stays coherent:

- **Claude conducts.** Antigravity executes briefs and gives second opinions. It never
  re-scopes and never decides.
- **Antigravity never writes to Claude's surfaces:** any `CLAUDE.md`, any `.claude/`, any
  `skills/`, or the user's skills repository. Output appearing there is a contract breach —
  tell the user, revert via git.
- **Its voice is `ANTIGRAVITY-FINDINGS.md`** at the target project's root (dated entries,
  newest first). Check it before briefing it on a project and after any task. **Its
  findings are unverified claims until Claude checks the evidence** — same standing as
  Codex's.
- **Prefer `--format json` with `--schema`** for anything you will parse. Schema-enforced
  structured returns are the one capability the Codex bridge lacks — use it for findings
  lists, inventories and verdicts instead of parsing prose.

## 7. Other verified notes

- Unauthenticated `agy models` / `agy -p` fail **cleanly** with a clear message — they do
  NOT hang, contrary to the docs' warning. Trust the exit code.
- `agy`'s own error messages are unusually good (they name the fix). Read them before
  guessing.
- The `curl | bash` installer appends `~/.local/bin` to `.zshrc`, `.zprofile` AND
  `.profile`; the `ERROR: logging before google.Init` lines it prints are glog noise on
  the success path, not failures.
- `--continue` / `--conversation ID` resume real threads. Default to fresh context; use
  continuity only when it is the point.
- Slash commands and `/usage` are unavailable inside streaming sessions.
- Subcommands worth knowing: `agy models`, `agy mcp`, `agy plugin`, `agy update`.
  `agy agents` returned empty when tested.
