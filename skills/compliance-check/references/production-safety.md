# Production safety for close-out work

Read before any write to a live backend, store console, website, CI default branch, or
another repository. Compliance close-out is mostly production work; the audit was
read-only, this is not.

## 1. Confirmation

- Ask per action, in chat, naming exactly what changes and how to roll back. A yes covers
  that action only. "Do all of it" from the owner covers the listed items, not new ones you
  discover along the way.
- Outward-facing (store labels, website publish, store description): show the final text
  first.
- Never on the owner's behalf: account creation, payments, credentials, CAPTCHAs, MFA or
  other security settings. Hand those over with exact click paths.

## 2. Pre-flight before removing anything

Prove nobody still depends on it, from live evidence:
- the live client's code at its release TAG calls the new path, not the old one
  (`git grep <symbol> <tag> -- <app dir>`);
- recent usage of the old path is zero (count rows written by it in the last 7 days);
- the thing exists exactly as the migration expects (policy names, function signatures).
State the residual risk (for example "installs still on version X would fail to send until
they update").

## 3. When the permission layer blocks an action

The session's classifier may block migrations, deploys, API-key reads, `gh api` writes,
browser JS, even a local commit, and may allow the identical action later. Do not loop and
do not route around the block (for example a blocked MCP migration must not be re-run via
the browser SQL editor on your own initiative). Instead:

1. Say plainly what was blocked and that nothing changed.
2. Give the owner the smallest safe unit to run: one copy-paste SQL block, one CLI command,
   or one idempotent script (`templates/setup-script-skeleton.sh`) that links, applies,
   deploys, stores secrets without printing them, schedules, and verifies itself.
3. After they run it, verify read-only yourself (versions, grants, schedule rows, 401s,
   a service-role smoke call returning a zero-work ok).

## 4. Secrets

- Never read, print, or paste secret values. Scripts fetch keys into a variable, reject
  unexpected formats, write them straight into a vault, `unset` them, and echo
  "stored (value not shown)".
- A function that checks `role == service_role` from the JWT needs the legacy JWT key
  (`eyJ...`), not a new opaque secret key; the script aborts if only an opaque key exists.

## 5. Git hygiene outside the working branch

- Scheduled GitHub workflows run only from the default branch. To add one there without
  disturbing the working branch, first run `git log --oneline origin/<default>..<default>`;
  if it prints anything, never `checkout -B <default> origin/<default>`.
  Use `git worktree add -b tmp-uptime <path> origin/<default>`, commit, push
  `tmp-uptime:<default>`, remove the worktree.
- In another repo (website), commit only the files you changed; leave unrelated dirty files.

## 6. Verify, then record

Every production action ends with a live read that would fail if the action had not
happened, and a `resolution` line (evidence + date + commit or version) in `findings.json`,
the operations doc, and the session notes. "Command exited 0" is not verification.

## 7. Staying on a free plan

No backups and no staging are legitimate owner decisions. Record them as ACCEPTED_RISK with
the mitigation: a manual `supabase db dump` (or equivalent) before any future DDL, and
rolled-back transaction tests in place of a staging run.
