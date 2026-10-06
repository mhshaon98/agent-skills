---
name: security-pass
description: Use when touching auth, API keys, secrets, RLS/policies, payment or personal data, any new endpoint that writes, or live backends — and before any release. Security and secrets checklist; every rule traces to a real production finding.
---

# Security Pass

Security passes are one of the few places where spending extra model budget is always
justified. Run as a focused pass on your default judgment tier (pinned via a subagent
type if delegated, see `spawn-agent`); raise reasoning effort when the diff touches data
migration, auth, or payment/personal data.

## Secrets hygiene

- **Secrets never live in code or committed files.** Use git-ignored secret files
  with a committed `*.example` twin, CI repository secrets, or environment variables.
- **Grep the diff before every commit/handoff** for key-shaped strings:
  `sk-`, `eyJ`, `-----BEGIN`, `AKIA`, URLs with embedded tokens. Handoffs are synced
  and long-lived — reference keys by name, never by value.
- **Keys don't belong in cloud-synced folders.** Loose `.p8`/license/API-key files in
  a synced folder are one sync-share away from exposure — flag them with a
  recommended move (OS keychain, `~/.keys/`, password manager); don't move credentials
  yourself without confirmation.
- **Clients get publishable/anon keys only.** If a flow seems to need a service-role
  key client-side, the design is wrong.

## Backend security (Supabase / any hosted DB)

- **RLS on every table**, isolating by `auth.uid()` where real auth exists. Where it
  doesn't yet, enumerate exactly which operations stay open and write the residual
  risk down as a deliberate decision with an owner and revisit condition.
- **Run the security advisors after EVERY schema change** — production once had
  unrestricted anonymous DELETE on user tables and nothing errored.
- **Re-run advisors to confirm fixes stuck** — a privilege revoke silently failed to
  apply once. A fix isn't applied until the advisor confirms it.
- **Check policy completeness, not just presence** — RLS enabled with a missing
  policy fails silently in whichever direction you didn't test. A "delete my
  account" flow once deleted nothing server-side with no error raised.
- **Test destructive/privacy flows end-to-end against the live backend.**

## Permission & privacy boundaries (client apps)

- **Never trigger an OS permission prompt the user didn't ask for** — prompts fire
  only from an explicit user action. Suggested settings are surfaced, never
  auto-enabled.
- AI features: on-device or clearly disclosed; state what leaves the device.
- Tools reading sensitive stores (email, finance files) are **read-only by default**;
  write capability is a separately gated opt-in that degrades honestly. Enumerate
  what the tool can NEVER do and enforce it server-side, not just in the UI.
- Autonomous tools get workspace confinement: explicit allowed roots, protected
  extensions/directories refused at the enforcement layer.

## Runtime resource-exhaustion hardening (fork bombs, PID/memory floods)

A fork bomb (`:(){ :|:& };:`), spawn-per-request loops, unbounded concurrency, or a
tight retry loop on `EAGAIN`/`ENOMEM` exhaust the host's PID/memory ceiling until it
can't start anything — including the shell to fix it. **The defense is a kernel/OS cap,
not app logic.**

- **Applicability gate — check first, SKIP most projects.** Harden only if the project
  has a container/compose/k8s surface, a long-running service/daemon, code that spawns
  OS processes (`subprocess`/`fork`/`child_process`/`os/exec`/shell-out, esp.
  per-request), or runs untrusted/user-supplied code. Static sites, single-file scripts
  with no spawning, pure libraries, plain client apps → skip and say so.
- **Apply the additive, repo-local guards** (new caps, not behavior changes) —
  confirming before editing any outward-facing/production deploy file: Docker
  `pids_limit`/`mem_limit`, k8s `resources.limits`, systemd `TasksMax`/`MemoryMax`,
  a **bounded** worker pool around spawns with backoff (never a tight retry loop),
  child-tree timeouts; untrusted code isolated in its own uid+cgroup `pids.max`/sandbox;
  Windows → Job Object `ActiveProcessLimit`.
- **Recommend-only, never auto-write**: host config (`limits.conf`, kubelet
  `--pod-max-pids`) and any change that lowers a live service's envelope — surface the
  exact edit and let the user apply it.

## Checklist

- [ ] Advisors run on touched backends; findings fixed; **re-run confirms applied**
- [ ] No secrets in code, diffs, docs, or handoffs; example/secret file pairs intact
- [ ] Client contains publishable keys only
- [ ] Every new/changed endpoint: authz checked; rejection paths tested, not just happy path
- [ ] Destructive flows verified end-to-end against the real backend
- [ ] No new unsolicited permission prompts; gated features degrade honestly
- [ ] Runtime resource-exhaustion hardening applied where applicable (see above)
- [ ] Residual risks written down as decisions, with owner and revisit condition
