---
name: codex-bridge
description: Delegate a task to OpenAI Codex or get a non-Claude second review via the codex plugin. Use on "ask codex", "have codex review/check this", "send to codex", or before a release when a second provider is worth it.
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

## 0.5 Before these specific jobs, read the reference

- Running `codex exec` yourself (background runs, iOS Simulator access, approvals):
  `references/exec-gotchas.md`. The one rule to keep in mind always: a backgrounded
  `codex exec` needs `</dev/null` or it waits on stdin forever, silently.
- Image generation: `references/image-generation.md`, then
  https://github.com/mhshaon98/agent-skills/blob/main/playbooks/codex-image-pipeline.md for the full doctrine (pass model and effort as
  `-c` flags, keep effort at most medium, never edit `~/.codex/config.toml`).
- First use on a Windows PC: `references/windows.md`.

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

**Review direction matters.** One published test found Claude reviewing a Codex draft
raised correctness (about 72% → 90%) while Codex reviewing a Claude draft lowered it
(about 91% → 83%); small LeetCode-style set, reviewers could not run tests, so treat it
as a caution, not a law. Consequences: a Codex review of Claude's work is a list of
**leads**, never a patch list. Reproduce or trace each finding before changing
anything, and do not "fix" what you cannot confirm. Where the work can be split, the
stronger arrangement is Codex drafts the bounded piece and Claude reviews it.

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
