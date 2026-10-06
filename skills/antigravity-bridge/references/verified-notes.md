# antigravity-bridge: verified notes and history

Read when installing `agy` on a machine or debugging the bridge itself.

## Issue #76 (from §1)

Issue #76 (`agy -p` emitting nothing on a pipe) did **NOT** reproduce on v1.1.26 — piped
output works. The pty fallback via `script` stays in as a safety net; if it ever fires it
prints a warning to stderr. Git Bash on Windows has no `script`, so if #76 ever bites
there the bridge is simply unavailable on that machine — say so, don't fake it.

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
