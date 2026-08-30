---
name: cowork-relay
description: Coordinate work split between Claude Cowork and Claude Code on the same project — Cowork does the maximum possible, sandbox-blocked steps go to Claude Code, and each side ends by writing a copy-paste relay prompt for the other.
---

# Cowork ↔ Claude Code Relay

The user moves work between Claude Cowork and Claude Code on the same project. The
contract: **each environment does everything it can, and ends by writing a relay
prompt the user copy-pastes into the other** — so the receiving session knows exactly
what to do with zero re-explanation.

## Division of labor

**Cowork does as much as possible.** A Cowork session is not limited to its Linux
sandbox — it also has desktop shell access to the host machine (build, run a local
server, curl-verify routes) and Chrome tools for browser checks when the extension is
connected. Proven flow: implement + typecheck in the sandbox → build + serve +
HTTP/HTML-verify via the desktop shell → hand over only the true remainder.

**Left for Claude Code** (the tail end):
- `git commit` / `git push` / anything the sandbox blocks in this project
  (**never push from anywhere without asking the user — push = deploy**)
- Visual/interactive browser verification if the Chrome extension was down
- The mandatory pre-release review-agent pass (see `pre-release-review`)
- Anything touching live/production systems
- OS-native steps the sandbox can't reach (simulators, device builds, installers)

Before handing something over, **try it here first** — the relay prompt must contain
only what genuinely failed or is genuinely unavailable, not a repeat of the session.

## Ending a session — write the relay prompt (required)

At the end of EVERY session in either environment, output a fenced block the user can
copy-paste verbatim into the other tool's chat. Also update `HANDOFF-*.md` as usual —
the relay prompt is the baton, the handoff is the full state.

```
RELAY: <Cowork → Claude Code | Claude Code → Cowork> — <project name>
Project root: <absolute path on the target machine>
Read first: <newest HANDOFF-*.md filename; BUG_LIST.md if relevant>

DONE (do not redo): <completed work, with verification evidence in one line each —
"built clean", "all routes curl-verified", "committed as <hash>">

YOUR TASKS (in order):
1. <exact remaining step, with commands/paths — executable cold>
2. ...

VERIFY BY: <observable criteria per task>
DO NOT: <push without asking / touch X / redo Y — binding constraints>
CONTEXT THAT WON'T BE OBVIOUS: <the 2–5 facts that will save the other session
from rediscovery: decisions made, dead ends hit, quirks found>
```

## Receiving a relay prompt

1. Trust "DONE" only as far as its evidence — spot-check one claim before building
   on it (the relay is an agent report, not a verdict).
2. Run the `session-start` ritual (newest handoff, bug ledger) — the relay
   supplements it, never replaces it.
3. Execute the tasks; anything you cannot do in THIS environment goes into your own
   relay prompt back, with what you tried.
4. End with your own relay prompt (or, if the goal is fully achieved, a completion
   report and updated handoff instead).

## Rules for both sides

- One source of truth for state: the newest handoff. Relay prompts never contradict
  it — update the handoff first, then write the relay.
- No secrets in relay prompts (they pass through chat and clipboards).
- Convert relative dates/paths to absolute; the other machine may differ — state the
  project path as the target machine knows it, or relative to a root both sides share.
