# Security & Secrets Playbook

Every rule here traces to a real finding in shipped projects — including live production
exposure. Security passes are one of the few places where spending extra model budget is
always justified.

## 1. Secrets hygiene

- **Secrets never live in code or committed files.** Proven patterns: a git-ignored
  secrets file with a committed `*.example` twin; CI repository secrets; environment
  variables for local runs.
- **Keys don't belong in cloud-synced project folders.** Signing keys (`.p8`),
  license-key files, and API keys sitting loose in a synced folder are one share or
  laptop loss away from exposure. When encountered (e.g. `AuthKey_*.p8`,
  `LICENSE_KEYS.txt` at a project root): flag it to the user with a recommended move
  (OS keychain, a private `~/.keys/` directory, or a password manager) — don't move
  credentials yourself without confirmation.
- **Client apps get publishable/anon keys only.** Service-role or admin keys never ship
  in any client, ever. If a flow seems to need one client-side, the design is wrong.
- **Grep before commit/handoff**: scan the diff for key-shaped strings (`sk-`, `eyJ`,
  `-----BEGIN`, `AKIA`, URLs with embedded tokens) before committing or pasting into
  docs. Handoffs are long-lived — no secrets in them, reference by name.

## 2. Backend security (Supabase / any hosted DB)

- **RLS on every table, isolating by `auth.uid()`** where real auth exists. Where it
  doesn't yet (anon-key sync designs), enumerate exactly which operations stay open,
  write the residual risk into the handoff as a deliberate decision with a future
  work item — never leave it undocumented.
- **Run the security advisors after every schema change** — production once had
  unrestricted anonymous DELETE on user tables and nobody noticed until an advisor run.
- **Re-verify fixes stuck.** A privilege revoke silently failed to apply once; the
  advisor re-run caught it. A fix isn't applied until the advisor confirms it.
- **Test destructive/privacy flows end-to-end against the live backend**: an app's
  "delete my account" flow was silently deleting nothing server-side (missing DELETE
  policy, no error raised).
- **Check policy completeness, not just presence**: a table with RLS enabled but a
  missing policy fails silently in whichever direction you didn't test.
- **Cloudflare (Workers/KV/R2/DNS) work has its own cost-safety playbook** —
  `cloudflare-cost-safety.md`. Read it before creating or modifying anything on
  Cloudflare: spend ceilings are plan settings, not code, and two of its rules are
  one-way doors.

## 3. Permission & privacy boundaries (client apps)

- **Never trigger an OS permission prompt the user didn't ask for.** Prompts fire only
  from an explicit user action (a review agent once caught an unsolicited health-data
  prompt pre-release). Suggested settings (reminders, sync) are surfaced, never
  auto-enabled.
- **AI features: on-device or clearly disclosed.** State what leaves the device; keep
  privacy-questionnaire/store-declaration deltas in the release checklist. On-device
  models get "not medical/financial advice" framing where relevant.
- **Local tools that read sensitive stores** (a mail client's data, a finance workbook)
  are read-only by default; write capability is a separately-gated opt-in that degrades
  honestly when prerequisites are missing. Enumerate what the tool can NEVER do (e.g.
  "can never send, delete, move, or modify email") and enforce it server-side, not just
  in the UI.
- **Workspace confinement for autonomous tools**: explicit roots the tool may touch,
  protected extensions/directories refused server-side, unknown binary types protected
  until whitelisted.

## 4. Security review pass — when and what

Run a dedicated security pass (agent or focused conductor pass, mid/strong model) when:
touching auth, keys, RLS/policies, payment or personal data, any new endpoint that
writes, or before any release. (The `security-pass` skill packages this.)

Checklist:
- [ ] Advisors run on touched backends; findings fixed; **re-run confirms fixes applied**
- [ ] No secrets in code, diffs, docs, or handoffs; example/secret file pairs intact
- [ ] Client contains publishable keys only
- [ ] Every new/changed endpoint: authz checked, rejection paths tested (not just happy path)
- [ ] Destructive flows verified end-to-end against the real backend
- [ ] No new unsolicited permission prompts; permission-gated features degrade honestly
- [ ] Runtime resource-exhaustion hardening applied where applicable (§5)
- [ ] Residual risks written down as decisions, with owner and revisit condition

## 5. Runtime resource-exhaustion hardening (fork bombs, PID/memory floods)

A fork bomb (`:(){ :|:& };:`) and its cousins (spawn-per-request loops, unbounded
concurrency, a tight retry loop on `EAGAIN`/`ENOMEM`) are pure denial-of-service: they
abuse the legitimate `fork()`/spawn path until the kernel's PID/memory ceiling is hit
and the host can't start anything — including the shell you'd use to fix it. Nothing is
"hacked"; the box just has no capacity left. **The defense is a kernel/OS-enforced cap,
not application logic** — by the time your code runs, the machine is already gone. This
is proactive doctrine rather than a shipped-bug story.

**Applicability gate — check FIRST, and SKIP the majority of projects.** Harden only
when the project has at least one of:
- a container/compose/k8s surface (`Dockerfile`, `Containerfile`, `docker-compose*.yml`,
  k8s/helm manifests with `kind: Deployment|Pod`);
- a long-running service or daemon (systemd `*.service`, launchd plist, a server that
  accepts unbounded concurrent work);
- code that spawns OS processes — `subprocess`/`os.fork`/`multiprocessing`,
  `child_process.spawn|exec|fork`, `os/exec`, `Runtime.exec`, `Process()`, or any
  shell-out — especially **per request** or in a loop;
- it runs untrusted / user-supplied code or commands (CI runner, plugin host, sandbox,
  "run this snippet").

Static sites, single-file scripts with no spawning, pure libraries, and plain client
apps → **SKIP and say so.** Don't manufacture hardening a project can't use.

**Repo-local additive guards — safe to apply (new caps, not behavior changes), but a
deploy/infra file that is outward-facing or production-touching still gets a confirm
before the edit:**
- **Docker/compose**: `pids_limit`, `mem_limit` (+ `memswap_limit`), sane `restart:`
  (not `always` for batch jobs). CLI: `--pids-limit=N --memory=… --memory-swap=…`.
  Swarm stacks (`docker stack deploy`) **silently ignore** `pids_limit`/`mem_limit` —
  use `deploy.resources.limits.{memory,pids}` there instead.
- **Kubernetes**: `resources.requests` + `resources.limits` (`cpu`, `memory`) on every
  container.
- **systemd unit**: `TasksMax=` (per-unit cgroup `pids.max` — the reliable cap) and
  `MemoryMax=`. `LimitNPROC=` is per-UID RLIMIT_NPROC — ineffective alone on a
  shared/privileged uid; only adds value with a dedicated `User=`.
- **App level**: a **bounded** worker pool / semaphore around every spawn — never
  spawn-per-request; treat spawn failure / `EAGAIN` / `ENOMEM` as backpressure with
  bounded backoff, **never a tight retry loop** (that loop is itself a fork bomb);
  timeouts that kill the child *tree*; reap zombies.
- **Untrusted code**: isolate in its own uid + cgroup with `pids.max`, plus
  seccomp / gVisor / Firecracker / a `--pids-limit` container — never in the main
  process's namespace.
- **Windows** (no `fork()`): the equivalent runaway is unbounded `CreateProcess` —
  contain via a **Job Object** with `ActiveProcessLimit`
  (`JOB_OBJECT_LIMIT_ACTIVE_PROCESS`); WSL2 dev inherits cgroups via `.wslconfig`
  (`memory=`, `processors=`).

**Recommend-only — never auto-write (host/machine config, not per-repo, or could OOM a
working service):**
- `/etc/security/limits.conf` / PAM `nproc`, `/etc/systemd/system.conf`
  `DefaultTasksMax`, kubelet `--pod-max-pids` — machine-wide; surface the exact change
  and let the user apply it.
- **Lowering** limits on an already-running service, or setting any limit that shrinks a
  live deploy's envelope — propose the number, confirm, don't guess it into an OOM-kill.

**Record the decision.** When applicable-but-deferred (e.g. limits are set at the
orchestrator/host and not in-repo), write that in the handoff as a deliberate choice
with where the cap actually lives — so the next session doesn't re-flag it.
