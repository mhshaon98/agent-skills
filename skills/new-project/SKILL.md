---
name: new-project
description: Bootstrap a brand-new project with proven architecture defaults and continuity scaffolding. Use when starting a new project from scratch, or when touching a legacy project that has no handoff/git/structure yet.
---

# New Project Bootstrap

Set up a new project so any future cold-start session can continue it from the
handoff alone.

## Scaffolding (every project)

1. **`git init`** for any code project (recommend and proceed if approved). Commit at
   natural checkpoints; never push/publish without asking.
2. **First `HANDOFF-YYYY-MM-DD-HHMM.md`** at the project root before the first
   session ends (use the `update-handoff` skill).
3. **Project `CLAUDE.md`** with: one-line purpose, how to run, the session ritual
   pointer (newest handoff → `BUG_LIST.md` → goal), and any project-specific rules.
4. **No build artifacts in cloud-synced folders**: venvs at `~/.toolname/venv`, build
   caches and IDE derived data outside the synced tree, `node_modules`/`.next`
   gitignored. Source inside a synced folder is fine — git remains the source of truth.
5. Decide architecture **with the next session in mind**: could a cold-start Claude
   continue from the handoff alone? If not, the structure is wrong.

## Requirements interview: one question at a time

Gather the spec by asking **exactly one question, then waiting** — never a questionnaire
wall. Pair each question with your current best-guess hypothesis so the user can correct
a wrong guess faster than answer an open one; let later questions pivot on earlier
answers. Build the product definition below from the confirmed answers — "sounds good"
is not confirmation; restate intent in the user's words and get an explicit yes.
(adapted from addyosmani/agent-skills, MIT)

## Vertical-slice plan (`tasks/plan.md`, before implementation)

For any multi-session build, write a `tasks/plan.md`: study specs read-only first → map
dependencies → break work into **thin end-to-end slices** (one feature path data→API→UI,
not all-DB-then-all-API-then-all-UI), each with testable acceptance criteria, a
verification step, affected files, and a size (XS/S/M/L; XL = split further). Order so
each slice leaves the system working and risky work surfaces early. Never overwrite an
incomplete plan without asking — unchecked items may be mid-session work.
(adapted from addyosmani/agent-skills, MIT)

## Substantial projects: product + invariants source of truth (before heavy implementation)

For anything beyond a script or small tool — an app, a backend, anything expected to
span many sessions — capture TWO short documents before major implementation, and keep
them current as decisions land:

1. **Product definition** (`PRD.md` at the root, or a `## Product` section in the
   project `CLAUDE.md` for mid-size projects): what is being built, for whom, in-scope /
   out-of-scope features, key user journeys, acceptance criteria, platforms, and the
   non-functional requirements that shape architecture (offline? multi-device? privacy
   posture?). This is what implementation sessions build against — not vibes.
2. **Architectural invariants** (≤1 screen, IN the project `CLAUDE.md` — the
   per-project always-loaded layer, so every future session and agent sees them):
   declarative one-liners covering canonical data ownership, forbidden dependency
   directions, trust boundaries, where business logic lives, how data may be mutated,
   which system is authoritative. These are the rules agents most often violate when
   they're buried in a long architecture doc. Review diffs against them
   (`pre-release-review` checks them); changing one is a decision recorded in the
   handoff, never a side effect.

Proportionality rule: scripts and trivial tools skip both — the ladder and defaults
below are enough. Don't impose ceremony the project doesn't earn.

## Architecture defaults by project type

- **Small scripts/automation**: one file, constants at top as the config surface,
  state in a small JSON file, README with setup. Scheduling via GitHub Actions cron
  (no machine needed) or OS scheduler. Notify via webhook; always post something per
  run so silence means broken.
- **Local desktop tools/dashboards**: Python server + single-page HTML UI;
  double-click launchers per OS → shared `bootstrap.py` (Python check → venv outside
  the synced folder → pip install → `health_check.py` → launch); port-conflict probe
  opens the running instance instead of erroring; one documented config file.
- **Web apps / hosted backend**: a managed Postgres-with-auth-and-row-level-security
  platform (e.g. Supabase) is a good default; anon/publishable key only in clients;
  run the platform's security advisors after every schema change and re-verify the
  fixes stuck.
- **Native Apple apps**: SwiftUI + SwiftData; prefer Swift package + thin app shell
  so `swift build`/`swift test` work from CLI; platform code in `#if os(...)`;
  OS-version APIs behind `@available` + a deterministic fallback that never throws
  to the UI.
- **Finance/data tools**: user's ground-truth data read-only by default; separate
  audited write path as opt-in; verify totals against the source's own rollups on
  every parse, shipped as a permanent health check.

## Universal principles

- **Layered even when small**: models → services → views; views never touch business
  logic. This is what makes testing and future rewrites possible.
- **Local-first, cloud optional**: fully works offline/signed-out; sync is additive
  with per-row state.
- **Deterministic core, AI garnish**: compute facts in code; models narrate/filter
  ("quote, don't compute").
- **Successor, not rewrite-in-place**: replace a working system by building V2 in a
  new folder, keep V1 running, one-time importer, cut over at proven parity.
- **Evidence over preference**: when a storage/write approach is uncertain, test the
  candidates destructively on a copy first and record the results.
- **Cap runtime resources from day one** if the project spawns OS processes, runs a
  service/daemon, ships a container, or runs untrusted code: bounded worker pools (never
  spawn-per-request; no tight retry loop on spawn failure), and PID/memory limits in the
  deploy surface (Docker `pids_limit`/`mem_limit`, k8s `resources.limits`, systemd
  `TasksMax`/`MemoryMax`). Prevents fork-bomb / resource-flood DoS the app layer can't
  defend against. Details: the `security-pass` skill.

## Storage decision table

| Situation | Default |
|---|---|
| Script state / seen-lists | JSON file next to the script |
| Local tool with queries/relations | SQLite |
| Native Apple app | SwiftData with sync-ready conventions |
| Multi-device / multi-user | Managed Postgres + row-level security |
| User already owns the data in a file | **Don't migrate it** — read-only + write-through-owning-app with backup + audit |
