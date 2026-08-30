# Discovery — Application Understanding

> Loaded by the orchestrator and by `app-audit-recon` before any domain work.
> Discovery produces four artifacts: **application profile**, **data-flow model**,
> **trust-boundary catalog**, **third-party processor inventory** — plus the
> **domain router classification** that decides what gets investigated at all.
>
> `/app-audit` is an automated technical and disclosure compliance-assistance
> system. Discovery describes what the code *does*; it never asserts that the
> project is compliant, secure, or production-guaranteed.

---

## 0. Discovery rules (apply to every step)

| Rule | Meaning |
|---|---|
| **Read-only** | Discovery never edits product source. No installs, no migrations, no writes outside `<project>/.app-audit/`. |
| **Env var NAMES only** | Record `STRIPE_SECRET_KEY` exists. **Never** record, echo, log, or quote its value. Values found in committed files are reported as a *secret-exposure finding* with the value redacted (`sk_live_…REDACTED`). |
| **Evidence-anchored** | Every profile field, data-flow row, boundary, and processor carries `file:line` or config-path evidence. No inferred-from-vibes entries. |
| **Absent ≠ false** | If a signal is not found, record `UNKNOWN` (with what was searched), not `false`. `false` means positively established absence. |
| **No chain-of-thought** | Return conclusions, evidence, sources, confidence. Never reasoning transcripts. |
| **Scale the effort** | A 5-file static site gets a single pass. A payments+AI SaaS gets the full inventory. Never 30 agents for a brochure site. |

---

## 1. Inspection inventory

Inspect **each item below when present**. Absence is itself a recorded observation
(it drives `NOT_APPLICABLE` routing). Use `Glob` for existence, `Grep` for
signals, `Read` for the files that matter.

### 1.1 Package manifests and lockfiles

- `package.json`, `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`
- `requirements.txt`, `pyproject.toml`, `poetry.lock`, `Pipfile`
- `Gemfile`, `Gemfile.lock`
- `Podfile`, `Podfile.lock`
- `Package.swift`, `Package.resolved`
- `build.gradle`, `build.gradle.kts`, `settings.gradle`
- `AndroidManifest.xml` — permissions, exported components, SDK levels
- `Info.plist` — usage-description strings, ATS exceptions, URL schemes

Record: direct dependencies (the processor signal), dev-only vs runtime, versions,
and whether a lockfile exists at all.

### 1.2 Containers and infrastructure-as-code

- `Dockerfile`, `docker-compose.yml`, `.dockerignore`
- Terraform (`*.tf`), Pulumi, CloudFormation templates, `serverless.yml`, SAM
- Kubernetes manifests / Helm charts if present

Record: exposed ports, base images, run-as-root, secret injection style, declared
cloud resources (buckets, DBs, queues, functions), public-vs-private networking.

### 1.3 CI and hosting

- `.github/workflows/*`, `.gitlab-ci.yml`, `.circleci/config.yml`, `azure-pipelines.yml`
- `vercel.json`, `netlify.toml`, `wrangler.toml`, `_headers`, `_redirects`, `fly.toml`, `render.yaml`, `app.yaml`, `Procfile`

Record: what runs on push/PR/tag, which gates exist (tests, lint, typecheck,
security scan), how secrets reach the pipeline, deploy targets, preview
environments.

### 1.4 Data layer

- Schema files, `migrations/`, `seeds/`, `schema.sql`, `supabase/migrations/`
- ORM/model definitions (Prisma `schema.prisma`, Drizzle, SQLAlchemy, ActiveRecord, TypeORM, Mongoose)
- Row-level-security / policy definitions, database roles and grants
- Indexes, foreign keys, constraints, triggers, views, stored procedures

Record: every table/collection that holds user or personal data, its columns, its
access-control mechanism, and whether deletion is hard, soft, or cascading.

### 1.5 Server surface

- API routes (`app/api/**`, `pages/api/**`, Express/Fastify/Koa routers, Django/Flask/FastAPI routes, Rails routes)
- Middleware (auth guards, CORS, CSP, rate limiters, body parsers)
- Server actions / RPC / tRPC procedures
- Serverless and edge functions
- GraphQL schema, resolvers, introspection setting, depth/complexity limits

Record for each route: method, auth requirement, authorization check present/absent,
inputs accepted, data returned, side effects.

### 1.6 Platform services

- **Storage** — buckets/containers, public-vs-private policy, signed-URL usage, upload validation, path structure
- **Authentication** — provider, session mechanism, token storage, password policy, MFA, email verification, reset flow
- **Authorization** — RBAC/ABAC tables, ownership checks, tenant scoping, admin gates, object-level checks
- **Webhooks** — inbound endpoints, signature verification, replay/idempotency handling
- **Queues, workers, cron/background jobs** — schedulers, job definitions, retry config, dead-letter handling

### 1.7 Client surface

- Frontend routes/pages and which ones are gated
- Forms and the fields they collect (this is a primary data-collection signal)
- State management and what personal data lands in client storage
- Analytics SDKs, advertising pixels, session replay, tag managers
- Cookie usage, `localStorage`/`sessionStorage`/IndexedDB writes, consent banner implementation
- Payments and subscriptions UI (checkout, plan selection, cancellation path)
- AI provider calls made from the client
- Email and SMS senders, in-app messaging/support widgets

### 1.8 Operations

- Monitoring/APM/error tracking configuration
- Logging setup, log destinations, log levels, what gets logged at each
- Test suites (unit, integration, e2e), coverage config, fixtures
- Deployment configuration, environments, environment separation
- `.env.example`, `.env.*` templates → **names only**
- `README`, `CHANGELOG`, docs, `CLAUDE.md`, ADRs — stated intent (used to compare against actual behavior)

### 1.9 Disclosure surfaces (needed for the compliance comparison)

- Privacy policy, cookie policy/notice, Terms of Service/EULA, refund policy
- App Store privacy "nutrition label" config, Play Data Safety declarations
- Marketing pages: claims, testimonials, logos, statistics, AI claims
- Support/help content that makes factual promises (retention, deletion, security)

---

## 2. Application profile

Machine-readable, validated against `schemas/application-profile.schema.json`.
Every field is populated with a value **or** `UNKNOWN` — never silently omitted.
Each non-trivial field carries `evidence` (`file:line` or config path).

| Field | What to record |
|---|---|
| `type` | web app / SaaS / static site / mobile app / API service / CLI / library / desktop / hybrid |
| `maturity` | prototype / pre-launch / launched / mature — evidenced by git history, versioning, tests, monitoring, live config |
| `platforms` | web, iOS, Android, desktop, server-only |
| `frameworks` | Next.js, Django, Rails, Expo, SwiftUI, … with versions |
| `frontend` | rendering model (SSR/SSG/CSR/RSC), routing, build tooling |
| `backend` | runtime, server framework, serverless vs long-running, edge |
| `public_api` | is there an externally consumable API? auth model? documented? versioned? |
| `database` | engine(s), hosting, schema location, ORM, RLS/policies present |
| `storage` | object storage providers, buckets, public/private posture |
| `authentication` | provider, session mechanism, MFA, verification, reset |
| `authorization_model` | none / role-based / ownership / tenant-scoped / policy-engine / mixed |
| `payments` | processor(s), checkout style, server-side verification present |
| `subscriptions` | plans, trials, renewal model, cancellation path |
| `ai` | providers, models, where invoked, tools/agents present, user-facing vs internal |
| `analytics` | products in use and where initialized |
| `advertising` | ad networks, conversion pixels, ad SDKs |
| `tracking` | cookies, persistent IDs, session replay, fingerprinting signals |
| `user_accounts` | can users register? what identity data is stored? |
| `user_uploads` | can users upload files? types, size limits, validation, storage target |
| `ugc` | user-generated content visible to other users? moderation present? |
| `messaging` | email, SMS, push, in-app messaging; providers |
| `children_possible` | evidence-driven signal (see §5 of `domains-compliance.md`); default `UNKNOWN`, never a bare `false` |
| `sensitive_data` | health, financial, biometric, precise location, government ID, sexual/political/religious data, credentials |
| `mobile` | native/hybrid, permission declarations, store presence |
| `cloud` | hosting and cloud providers, regions |
| `ci_cd` | pipelines, gates, deployment triggers |
| `monitoring` | uptime, APM, error tracking, alerting destinations |
| `background_jobs` | schedulers, workers, queues |
| `webhooks` | inbound and outbound webhook endpoints |

Profile fields feed the router directly: `payments: null` plus no processor
dependency ⇒ payments/subscription modules classify `NOT_APPLICABLE`.

---

## 3. Data-flow model

Build **one flow per data type**, not one per feature. A "data type" is a
distinguishable category of information about a person or their content
(e.g. `account_email`, `uploaded_document`, `chat_transcript`, `device_id`,
`payment_method_token`, `precise_location`, `support_message`).

### 3.1 The flow chain

```
SOURCE → CLIENT → API → PROCESSING → DATABASE / STORAGE → THIRD PARTIES
       → RETENTION → DELETION
```

Trace each hop with evidence. A hop you cannot evidence is `UNKNOWN`, and an
`UNKNOWN` in the DELETION hop is itself a reportable gap, not a PASS.

### 3.2 Recorded attributes (all required per data type)

| Attribute | Notes |
|---|---|
| `data_category` | the normalized category name |
| `collection_point` | exact form/route/SDK/event that captures it (`file:line`) |
| `purpose` | why the code collects it, inferred from actual use, not from the policy text |
| `storage_location` | table/column, bucket/prefix, cache, log, client storage |
| `processor` | which internal component handles it |
| `external_sharing` | every third party that receives it, with the call site |
| `retention` | how long it persists — code/config evidence, or `UNKNOWN` |
| `deletion_path` | the concrete chain that removes it, or `NONE_FOUND` |
| `sensitivity` | low / moderate / high / special-category |
| `privacy_disclosure` | is this category disclosed in the privacy policy? quote the line or record `NOT_DISCLOSED` |
| `store_disclosure` | is it declared in App Store privacy labels / Play Data Safety? `NOT_DECLARED` / `N_A` if no store presence |

The last two columns are what makes the **five-way comparison** in
`domains-compliance.md` possible. Do not skip them because the project "probably"
discloses everything.

### 3.3 Flows that get missed (check explicitly)

- Data written only to **logs** or error-tracking breadcrumbs
- Data in **client storage** (localStorage, IndexedDB, cookies) that never reaches the server
- Data carried in **URLs/query strings** (and therefore into referrers and access logs)
- Data sent to **analytics** as event properties
- Data in **email/SMS bodies** handed to a messaging provider
- **Prompts and completions** sent to AI providers — the transcript is user data
- **Backups, exports, and caches** — a deletion path that misses these is partial
- Data in **support/ticketing** integrations (Intercom-class widgets)

---

## 4. Trust-boundary catalog

A trust boundary is any point where data or control crosses between principals
with different privileges. Boundaries drive security testing: every finding in
`domains-production.md` should name the boundary it crosses.

### 4.1 Principals to catalog

| Principal | What to document |
|---|---|
| **Anonymous user** | what is reachable without auth; which routes/assets/APIs |
| **Authenticated user** | what a logged-in user can reach; how identity is derived per request |
| **Admin** | how admin is granted, where it is checked, whether it is separately isolated |
| **Internal service** | service-to-service calls, shared secrets, network assumptions |
| **Third-party webhook** | inbound callers; how authenticity is established |
| **AI model** | what the model can read and what it can *do* (tools) — see `domains-ai.md` |
| **Storage service** | who can read/write objects, and under what policy or signed URL |
| **Database** | which credentials/roles the app uses; RLS vs application-enforced access |
| **Background worker** | privileges of jobs; whether jobs run with elevated/service-role credentials |
| **External API** | outbound calls; whether responses are trusted as input |

### 4.2 Per-transition record

For each major transition record: `from_principal`, `to_principal`,
`entry_point` (`file:line`), `control` (what enforces the boundary),
`control_evidence`, `inputs_crossing`, `trust_assumption`, `notes`.

Explicitly flag transitions where the control is **absent**, **client-side only**,
or **derived from user-supplied identifiers** (e.g. a route that trusts a `userId`
from the request body rather than the session). Those are the seeds of
object-level authorization findings.

---

## 5. Third-party processor discovery — DYNAMIC

> There is **no static allowlist of vendors**. The known-family list in §5.3 is a
> *recognition aid* for naming and classifying what you find — never the search
> universe. A processor absent from that list is discovered by the same six
> signals and reported the same way.

### 5.1 The six discovery signals

1. **Dependencies** — every runtime entry in the package manifests and lockfiles. A vendor SDK in `dependencies` is a candidate processor even if you have not yet found its call site.
2. **Imports / requires** — actual import statements in shipped code, which separate *installed* from *used*.
3. **SDK initialization** — constructor/`init`/`configure`/provider-wrapper calls. This is where you learn *what* is sent (autocapture on? session replay on? PII scrubbing configured?).
4. **Network calls** — hardcoded hosts and base URLs in source, `fetch`/`axios`/`http` targets, script tags, iframes, CSP `connect-src`/`script-src` allowlists, and (where a behavioral test is possible) actual outbound requests observed at runtime.
5. **Environment variable NAMES** — `STRIPE_*`, `OPENAI_API_KEY`, `NEXT_PUBLIC_POSTHOG_KEY`, `RESEND_API_KEY` … Names are strong evidence of an integration. **Values are never read, echoed, stored, or reported.** A secret value found committed is reported redacted as a security finding.
6. **Configuration** — `vercel.json`/`_headers` CSP, tag-manager containers, mobile plist/manifest entries, `app.config`, Terraform provider blocks, dashboard-exported config files in the repo.

Cross-reference the signals: **installed but never imported** ⇒ likely dead
dependency (note it, do not call it a processor). **Called but not in manifests**
⇒ a script tag, tag manager, or vendored snippet — often the tracker nobody
disclosed. **Env name present, no code path** ⇒ `UNKNOWN`, ask whether the
integration is live.

### 5.2 Per-processor record

`name`, `category`, `discovery_signals[]` (which of the six fired),
`evidence[]` (`file:line`), `data_sent` (from the data-flow model),
`initialized_where`, `fires_before_consent` (yes/no/`UNKNOWN` — behavioral),
`disclosed_in_privacy_policy`, `disclosed_in_store_declarations`,
`is_subprocessor_of_user_data`, `confidence`.

The last three columns feed the privacy comparison. An undisclosed processor that
receives personal data is a compliance finding; an undisclosed processor that
receives nothing personal (e.g. a CDN for static logos) usually is not — establish
which before writing the finding.

### 5.3 Known families to recognize

Recognition aid only. Presence of a name below still requires evidence; absence
from the list means nothing.

| Category | Families |
|---|---|
| Analytics / product / session replay | Google Analytics, Google Tag Manager, Meta Pixel, TikTok Pixel, Microsoft Clarity, Hotjar, Mixpanel, PostHog, Amplitude, Segment, Sentry |
| Backend / cloud / hosting | Firebase, Supabase, AWS, Cloudflare, Vercel |
| Payments / billing | Stripe, Paddle, RevenueCat |
| Identity | Clerk, Auth0 |
| AI providers | OpenAI, Anthropic, Gemini, xAI, Replicate, Hugging Face, Amazon Bedrock, Azure AI |
| Messaging / comms / support | Resend, SendGrid, Mailgun, Twilio, Intercom |

Classification notes:

- **Sentry** is error tracking, but breadcrumbs and request bodies routinely carry
  personal data — treat it as a processor and check its scrubbing config.
- **Segment / GTM** are *fan-out* points: the real processor list is whatever the
  container or destinations config forwards to. If the container config is not in
  the repo, that is an `UNKNOWN` worth surfacing, not an assumed-empty set.
- **Supabase / Firebase / AWS** are infrastructure processors — they hold the data
  rather than analyze it, but they still belong in a processor disclosure.
- **AI providers** are processors of whatever is in the prompt. An omitted AI
  processor is one of the most common disclosure gaps (see `domains-compliance.md`).
- **RevenueCat / Stripe** receive identifiers and purchase data; store declarations
  frequently omit them.

---

## 6. Domain router

Every module in `domains-compliance.md`, `domains-production.md`, and
`domains-ai.md` receives exactly one classification. Nothing is silently skipped
and nothing is investigated "just in case".

### 6.1 The four classifications

| Class | Meaning | Trigger |
|---|---|---|
| `APPLIES` | Profile/data-flow/processor evidence positively establishes the module is in scope. | e.g. Stripe dependency + checkout route ⇒ payments APPLIES |
| `POSSIBLY_APPLIES` | Partial or ambiguous signals; scope cannot be settled from what has been read so far. | e.g. an AI chat surface exists — whether it meets a companion-chatbot definition is unresolved |
| `NOT_APPLICABLE` | Non-applicability is **established**, with evidence of absence. | no store presence, no mobile targets, no store config ⇒ App Store module N/A |
| `INSUFFICIENT_EVIDENCE` | Cannot be classified — the deciding facts are outside the repo or unreadable. | CCPA thresholds depend on revenue/user counts not present in code |

### 6.2 The deep-investigation rule

**Deep-investigate `APPLIES` and `POSSIBLY_APPLIES` only.**

- `APPLIES` → assign research depth (`NONE`…`FORENSIC`) and dispatch specialists.
- `POSSIBLY_APPLIES` → first resolve applicability (cheapest decisive check), then
  either promote to `APPLIES` and investigate, or demote with the evidence recorded.
- `NOT_APPLICABLE` → record the module, the reason, and the evidence of absence in
  the report's *Modules Skipped / N/A* section. Do not dispatch agents. Do not
  produce findings.
- `INSUFFICIENT_EVIDENCE` → produce **one** `UNKNOWN` finding carrying
  `applicability.facts_required[]` — the exact questions whose answers would settle
  it. These are batched into *Unknown Facts Needed*, asked of the user once, never
  one-at-a-time, and **never** resolved by assumption in either direction.

### 6.3 Router discipline

- **Absence must be evidenced.** `NOT_APPLICABLE` requires a positive search that
  came back empty ("no `Info.plist`, no store config, no mobile build target"),
  recorded as the reason. Never route to N/A because a module felt irrelevant.
- **Never route to `NOT_APPLICABLE` to save budget.** Budget is managed by *depth*,
  not by pretending modules do not apply.
- **Uncertainty never becomes PASS.** A module you could not investigate yields
  `UNKNOWN`, not a clean bill.
- **Re-run the router when discovery changes.** If a specialist finds a processor
  or feature recon missed, reclassify the affected modules before synthesis.
- **False-positive principles bind the router**, not just the findings. In
  particular: *California access ≠ CCPA applicability*, *AI dependency ≠ companion
  chatbot*, *public bucket ≠ vulnerability*, *UGC ≠ automatic liability*. Apply the
  full list in `domains-compliance.md` when classifying.

### 6.4 Router output record

Per module: `module_id`, `classification`, `reason`, `evidence[]`,
`assigned_depth`, `facts_required[]` (when `INSUFFICIENT_EVIDENCE`), `confidence`.
This record is written to `<project>/.app-audit/state.json` and rendered in the
report's *Modules Automatically Activated* and *Modules Skipped / N/A* sections.

---

## 7. Discovery hand-off

Discovery is complete when:

1. The application profile has a value or `UNKNOWN` for every field.
2. Every data type reachable from the inspection inventory has a flow row with all
   eleven attributes.
3. Every principal in §4.1 that exists in this project has its transitions catalogued.
4. The processor inventory has been cross-referenced across all six signals.
5. Every module in all three domain catalogs carries a router classification.
6. No secret value appears anywhere in the output.

Anything still unresolved leaves discovery as an explicit `UNKNOWN` with
`facts_required` — never as an assumption.
