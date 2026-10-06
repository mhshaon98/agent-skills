# codex-bridge: running `codex exec` yourself

Read before running `codex exec` directly (background runs, iOS Simulator access, approvals).

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
