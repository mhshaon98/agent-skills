---
name: codex-bridge
description: Delegate tasks to OpenAI Codex or get a cross-provider second review from inside Claude Code via the official codex plugin. Use when the user says "ask codex", "have codex review/check this", "send to codex", or before a release when a non-Claude reviewer adds value.
---

# Codex Bridge — delegate to, and get reviewed by, a non-Claude model

**Requires the OpenAI Codex CLI and the official `codex` companion plugin for Claude
Code** (`openai/codex-plugin-cc`), which exposes the Codex CLI as `/codex:*` slash
commands. Without both installed this skill does nothing. Its value is **provider
independence**: a reviewer that does not share Claude's blind spots.

## 0. Prerequisite check — do this FIRST, every time

Confirm the `/codex:*` commands actually exist in this session before promising
anything. **If they are unavailable, STOP** — do not improvise a substitute, and do not
shell out to `codex` directly. Tell the user the plugin isn't installed in this session,
that installing it requires the Codex CLI plus `/plugin` installation of the codex
plugin, and that a session started before the plugin was installed won't see
`/codex:*` until it is restarted. Then wait.

The Codex login browser flow belongs to the user (ChatGPT subscription or API key) —
never enter credentials on their behalf. Plugin registration is per-machine and does
**not** arrive with a `git pull` of your skills repo: a machine that has never installed
it has no bridge, regardless of what other machines have, and a machine where the user
deliberately declined it has none either.

## 0.5 `codex exec` gotchas

- **Backgrounded `codex exec` MUST get `</dev/null`.** With an open non-TTY stdin it
  prints "Reading additional input from stdin..." and hangs forever before doing ANY
  work, with zero output — silently, for as long as you let it. Foreground runs are
  unaffected.
- **The default sandbox cannot reach the iOS Simulator** (or any XPC service):
  `simctl` fails with `CoreSimulatorService ... Code=61 "Connection refused"`. Getting
  past this needs a Codex profile with a relaxed sandbox mode, which only the user
  should create and authorize — and only for simulator capture/verification tasks,
  never for general coding. Note that Codex profiles live in per-name config files, not
  as `[profiles.*]` tables inside `config.toml`.
- **Approval prompts do not exist in `codex exec`.** "Have Codex ask permission" is
  only possible in interactive Codex (TUI / desktop app); the headless bridge either
  has the access or it doesn't.
- **Codex cannot inject simulator taps** (`simctl` has no tap command; System Events
  needs accessibility grants it may not have). The division that works: Claude drives
  the UI with its simulator tools, Codex captures and reviews.

## 0.6 Image generation via the CLI

The CLI's `image_generation` feature (ChatGPT-token auth, no API key, needs a paid
ChatGPT plan) generates images headlessly and saves them into the workspace:

```bash
codex exec --skip-git-repo-check -s workspace-write \
  -c model="<image-capable model>" -c model_reasoning_effort="medium" \
  "<brief: exact paths+filenames, exact pixel size, 'verify each with sips', content rules>"
```

- Pass model and effort as `-c` flags per invocation; never edit the user's
  `~/.codex/config.toml` yourself.
- Multi-image briefs loop on their own (roughly 60-90s per image). A workspace image
  named as a reference holds identity and framing across a series (e.g. staged
  before/after pairs).
- Generated images come out **letterless** — do brand typography and compositing in
  your own committed generators. Verify dimensions on disk yourself.

## 1. Command inventory

| Command | What it does | Key flags |
|---|---|---|
| `/codex:rescue` | Delegate a task to Codex — the main entry point | `--background` / `--wait`, `--resume` / `--fresh`, `--model`, `--effort` |
| `/codex:review` | Review uncommitted changes, or a branch against a base | `--base <ref>` |
| `/codex:adversarial-review` | Steerable challenge review — you supply the angle to attack | (prompt-steered) |
| `/codex:transfer` | Convert the current session into a resumable Codex thread | — |
| `/codex:status` | Progress of a running background task | — |
| `/codex:result` | Fetch a finished task's output | — |
| `/codex:cancel` | Kill a running task | — |

Anything long-running goes out with `--background`, then `/codex:status` →
`/codex:result`. A foreground Codex task blocks the session for its whole duration.
Use `--fresh` when the previous thread's context would mislead it; `--resume` only
when continuity is the point.

## 2. The collaboration contract

If you use Codex regularly, write its standing contract down somewhere Codex reads
(an `AGENTS.md`) rather than re-explaining it per task. A contract that works:

- **Claude is the conductor**: all scope, architecture, phasing, and release decisions;
  briefs out, verification and merge back in. Codex executes briefs and gives
  second-opinion reviews — it never re-scopes or decides.
- **Codex never writes to Claude's surfaces**: any `CLAUDE.md`, any `.claude/`
  directory, any skills folder. If Codex output ever shows up there, treat it as a
  contract breach — tell the user and revert via git.
- **Codex gets its own voice, in its own file** — e.g. `CODEX-FINDINGS.md` at the
  target project's root, dated entries newest first. Read it before briefing Codex on
  a project (context it already has) and after any Codex task (its questions and
  proposals land there). Its findings are unverified claims until you check the
  evidence.
- **Mirror your effort budget**: workhorse model by default, top-tier effort only when
  the brief says the task warrants it. Set `--model`/`--effort` per brief so
  hard-problem effort doesn't leak onto mechanical work.

## 3. Usage doctrine

- **A Codex review is a SECOND opinion. It never replaces `pre-release-review`.**
  That skill's independent Claude reviewer is still mandatory before any release,
  submission, or deploy. Codex runs *in addition*, where a non-Claude perspective is
  worth the spend — security-sensitive diffs, a bug two Claude passes failed to find,
  a design decision worth challenging from outside.
- **Verify its findings like any agent's.** Codex's output is an unverified claim,
  same as a subagent's: file:line evidence or it did not happen. It does not know your
  conventions or the project's history, so expect confident findings that are wrong
  *for this repo*.
- **Beware review-gate ping-pong.** Feeding Codex's findings back to Claude, then
  Claude's rebuttal back to Codex, burns both providers' usage limits fast and
  converges on nothing. One pass out, one merge by the conductor, done. If the two
  disagree, the conductor decides and records why — never relay them at each other.
- **The model budget still applies.** Delegating to Codex does not make a task free;
  it moves the cost to a different meter. Do not route work to Codex just to dodge a
  Claude limit.
- **Never send secrets.** Anything handed to Codex leaves Anthropic's boundary — the
  same rule as for any external tool (see `security-pass`).

## 4. Windows

Validate the bridge on one Windows machine before trusting it on another; the plugin
has had Windows-specific install and app-server startup bugs. If one bites, say so
plainly and fall back to a Claude reviewer rather than retrying blind.
