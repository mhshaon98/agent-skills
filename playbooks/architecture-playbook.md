# Architecture Playbook

How to choose an architecture per project type. These are defaults with proven track
records across real projects — start here, deviate when the project gives you a reason,
and record the reason in the project's handoff notes.

## Universal principles

1. **Layered even when small**: read layer / write layer / UI-server layer, or
   models → services → views. Views never touch business logic. This is what makes
   testing and an eventual V2 rewrite possible.
2. **Local-first, cloud optional**: the app must fully work offline/signed-out; sync is
   an additive layer with per-row state (`pending`/`synced`/`conflict`/`error`) and the
   pending rows ARE the queue (no separate outbox to drift).
3. **Deterministic core, AI garnish**: compute facts in code; let models narrate/filter.
4. **Safety layers around precious data**: backup → write-through-the-owning-app →
   audit log. Health checks that continuously validate parsed data against ground truth.
5. **Evidence over preference**: when a storage/write approach is uncertain, *test the
   candidates destructively on a copy first* (several failed spreadsheet-write
   experiments once justified an entire external-dashboard architecture).
6. **Additive schema changes**: new fields optional/defaulted; soft deletes (`deletedAt`)
   over hard deletes; UUID ids + `createdAt`/`updatedAt` on anything that might sync.
7. **Successor, not rewrite-in-place**: when replacing a working system, build V2 in a
   new folder, keep V1 running untouched, plan a one-time importer, cut over only at
   proven parity.

## Per-project architectural invariants (drift protection)

AI sessions locally optimize each change and can slowly damage the global design —
conflicting patterns, duplicate abstractions, dependency directions quietly inverted.
The countermeasure is cheap and recognized practice (spec-driven development):

- **Substantial projects carry a ≤1-screen invariants list in the project `CLAUDE.md`**
  (the per-project always-loaded layer): declarative one-liners on canonical data
  ownership, forbidden dependency directions, trust boundaries, where business logic
  lives, how data may be mutated, which system is authoritative. Details and rationale
  live in a fuller architecture doc or the handoff; the invariants themselves stay
  short enough that no agent can claim they were buried. (Bootstrap procedure: the
  `new-project` skill.)
- **Diffs are reviewed against the invariants** — `pre-release-review` includes them in
  the reviewer brief; a violation is a finding, not a style note.
- **Changing an invariant is a decision**, recorded in the handoff with the why —
  never a side effect of an implementation task.
- Drift smells to act on mid-project: a second abstraction for something that already
  has one, a new folder invented mid-task, a "convenient" import against the dependency
  direction. Fix or surface immediately — drift compounds.

## Before you write code: the least-code ladder

The best code is the code you never wrote. Before adding any new code — a file, a
dependency, a component, an abstraction — walk this ladder top-down and stop at the
first rung that satisfies the goal. Only descend when the rung above genuinely can't
do the job. This is the operational form of "smallest coherent change" and of "don't
big-bang rewrite a working tool". Corollary: no unjustified hardcoding — intentional
hardcoding gets a justifying comment.

1. **Skip it (YAGNI)** — is this actually needed *now*, or speculative? The requirement
   nobody asked for is the cheapest thing to cut.
2. **Reuse** — does code in this repo already do it (or 90% of it)? Extend/call that
   instead of writing a parallel version. No duplicate `_v2` files — edit in place.
3. **Standard library** — can the language's stdlib do it before you reach for anything else?
4. **Native platform feature** — a built-in (`<input type="date">`, an OS API, a DB
   feature) over a hand-rolled component or a new library.
5. **A dependency you already have** — if a lib is already installed, use it before
   adding a new one. A new dependency is a permanent tax (supply chain, churn,
   upgrades) — justify it.
6. **A one-liner / small inline solution** — before building a module or abstraction,
   ask if a few lines inline suffice. Abstract on the *second* real use, not the first.
7. **Build it minimally** — only now write new code, and only the smallest coherent
   piece that achieves the goal.

Non-negotiable: descending the ladder to save code **never** means dropping safety —
validation, error handling, security, and accessibility stay intact at every rung.
The ladder trims over-engineering, not correctness. When the user intentionally wants the
"heavier" option, that overrides the ladder — do it, note the reason in the handoff.

## By project type

### Small scripts & automation
- One file, constants at the top as the config surface, README with setup + local-run
  instructions.
- State = a small JSON file committed back to the repo; first run establishes a baseline
  silently (no alert flood).
- Scheduling: CI cron (e.g. GitHub Actions) for anything that must run without a machine
  on; the OS scheduler for local machines. Secrets in repo/environment secrets, never in
  code.
- Notify via webhook (Discord/Slack). Always post *something* per run ("no new items")
  so silence means broken, not idle.

### Local desktop tools & dashboards
- Python server + single-page HTML/chart UI, served locally; a native webview window
  with browser fallback.
- Double-click launchers per OS → shared `bootstrap.py` (runtime check → virtualenv
  **outside** any cloud-synced folder → dependency install → `health_check.py` → launch).
- `health_check.py` with exit 0/1 and a `--check-only` bootstrap mode.
- Port-conflict probe: second launch detects the running instance and opens it.
- Poll (e.g. 5s) over file-watchers for human-speed data — simpler, no OS-specific deps.
- Config: one `config.json`/`config.yaml`, documented inline, plus a machine-specific
  override file when the tool runs on multiple machines.

### Web apps / anything with a hosted backend
- Build artifacts (`node_modules`, `.next`, etc.) stay gitignored and per-machine. If
  source lives in a cloud-synced folder by the user's choice, let sync finish before
  editing from a second device; git push/pull remains the source of truth.
  Static-first Next.js + an i18n library on a static host works well for multilingual
  (including RTL) sites.
- Supabase (Postgres + Auth + RLS) is a solid default backend. RLS isolates by
  `auth.uid()`; anon/publishable key only, never service-role in the client.
- Run the backend's security advisors after every schema change **and re-verify the fix
  stuck** (a revoke silently didn't apply once).
- Know your residual risks and write them down (e.g. anon-key sync leaves SELECT open
  until a real auth migration — documented, deliberate).

### Native Apple apps
- SwiftUI + SwiftData. For NEW apps, prefer a **Swift package + thin app shell** so
  `swift build`/`swift test` work from the CLI without an `.xcodeproj`, and the kit is
  shared with future targets (macOS→iOS). Existing conventional `.xcodeproj` apps built
  via `xcodebuild` are fine to continue as-is — don't retrofit.
- Platform-specific code isolated to `#if os(...)` blocks; one root view owns layout
  differences.
- Known SwiftData gotchas (App Group container location, DerivedData inside synced
  folders) belong in project memory. Read them before touching persistence or building.
- Feature gates for OS-version APIs: `#if canImport` + `@available` + a deterministic
  fallback that never throws to the UI.

### Finance/data tools
- The user's ground-truth data (workbook, source exports) is read-only by default; a
  separate audited write path is an opt-in capability that degrades cleanly when its
  prerequisites (the owning app, permissions) are missing — check capability up front,
  not at write time.
- Verify totals against the source's own rollups **to the cent** on every parse; ship
  that as a permanent health check, not a one-time test.
- Keep an `audit_log.jsonl` of every write with old/new values.

### Monitoring tools & scheduled jobs
- Idempotent runs; persisted "seen" state; explicit heartbeat message every run.
- Extraction of messy sources (foreign-language PDFs, scraped HTML) → hand to a cheap
  multimodal model with a narrow, structured ask.

### Camera / image / media apps
- Respect capture-pipeline quality settings explicitly (max photo dimensions, quality
  prioritization) — defaults silently downscale.
- Anything camera/sensor-dependent is **not verifiable in a simulator** — keep a
  physical-device checklist in the handoff.

### Projects that may later need a UI / another platform
- Put all logic in the package/service layer from day one; the UI is a client.
- Cross-model references as plain UUIDs that map 1:1 to backend tables.

### Projects spanning multiple agent sessions (treat all of them as this)
- A dated handoff file at the project root from day one (create it on first touch if
  missing); memory files for durable gotchas; a "supersedes" chain.
- Decide architecture with the *next* session in mind: could a cold-start agent continue
  this from the handoff alone? If not, the handoff (or the structure) is wrong.

## Choosing storage (quick decision guide)

| Situation | Default |
|---|---|
| Script state / seen-lists | JSON file next to the script |
| Local tool with queries/relations | SQLite |
| Native Apple app | SwiftData with sync-ready conventions (UUID, timestamps, soft delete, syncStatus) |
| Multi-device / multi-user | Postgres (e.g. Supabase) + RLS |
| User already owns the data in a file (e.g. Excel) | **Don't migrate it.** Read it read-only; write through the owning app with backup + audit |

The last row is the most important lesson in this playbook: sometimes the right database
is the one the user already has, wrapped in safety layers.
