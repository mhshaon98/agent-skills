# Production Engineering Module Catalog

> Domain knowledge for the engineering side of `/app-audit`. The system is an
> automated technical and disclosure compliance-assistance system: it reports what
> the code does and where the evidence points. It never certifies a project as
> "secure", "hack-proof", or "production guaranteed" — the strongest available
> report status is `READY_WITH_KNOWN_RISKS`, with its disclaimer intact.
>
> Inputs: the application profile, data-flow model, and trust-boundary catalog from
> `discovery.md`. Every security finding names the boundary it crosses.

## How to use this catalog

1. Each module carries a router classification (`APPLIES` | `POSSIBLY_APPLIES` |
   `NOT_APPLICABLE` | `INSUFFICIENT_EVIDENCE`). Deep-investigate the first two only.
2. `FAIL_TECHNICAL` requires concrete evidence: `file:line`, configuration,
   request/response, test result, observed network behavior, observed database
   behavior, an authorization reproduction, or a runtime trace. No vague findings.
3. **Recommendations are scaled to the project.** A pre-launch side project and a
   revenue-carrying SaaS get different bars. Recommending enterprise machinery to a
   five-file site is itself a defect in the audit.
4. The **False-Positive Principles** in `domains-compliance.md` bind this catalog —
   especially 7–12 (monolith, microservices, Kubernetes, Redis, tests, AI-written
   code). Read them before writing an architecture or maturity finding.
5. Security-agent findings use the extended output format: `finding`,
   `attack_precondition`, `attack_path`, `affected_boundary`, `evidence`,
   `reproduction`, `impact`, `false_positive_conditions`, `recommended_test`.

---

# 1. Design and structure

## 1.1 `production.system-design`

Judge the system against **its actual needs**, established from the profile: user
scale, data sensitivity, financial exposure, team size, uptime expectations, and
maturity. Document: the components and what each owns, the request lifecycle for the
critical paths, synchronous vs asynchronous boundaries, and where state lives.

## 1.2 `production.architecture`

Assess on evidence, across these axes:

| Axis | What to establish |
|---|---|
| **Service boundaries** | do they align with data ownership and change frequency, or cut across them? |
| **Coupling** | which components cannot change independently; shared databases; shared types across deploy units |
| **Critical paths** | which flows must work for the product to function (signup, auth, checkout, core action) |
| **Single points of failure** | components whose failure takes the product down; is that acceptable at this scale? |
| **State ownership** | which component is the source of truth for each entity; duplicated state and drift |
| **Failure propagation** | does one slow/failing dependency cascade? (cross-reference §6) |
| **Complexity justification** | is each layer, abstraction, service, and queue earning its cost? |

### The never-assume list

Never assert, imply, or grade against any of these:

- "microservices are better"
- "monoliths are bad"
- "Kubernetes means production-ready"
- "serverless is more scalable"
- "this needs a message queue"
- "this needs Redis"
- "this needs a cache"
- "this needs multi-region"
- "more tests always means safer"
- "this framework/language is the wrong choice"

A structural recommendation must cite an **observed problem** (a measured or
evidenced failure mode, a real coupling that blocked a change, a genuine SPOF with
stated impact), not a preference. Absent an observed problem, the correct output is
`PASS` or `INFO`, not a redesign proposal. **Unnecessary complexity is itself a
finding** — an unjustified queue, service split, or abstraction layer is reported
the same way a missing one would be.

## 1.3 `production.frontend`

Rendering strategy and its consequences (data exposure in SSR payloads, hydration
cost), route protection on the client vs the server (client-only gating is a finding
— it is UX, not authorization), form validation duplicated server-side, error and
empty states, secrets or privileged config reaching client bundles (`NEXT_PUBLIC_*`
class variables carrying non-public values), and dependency weight.

## 1.4 `production.backend-api`

Route inventory with method, auth requirement, input contract, output shape, and
side effects. Check: input validation at the boundary (schema-validated, not
hand-rolled per field), consistent error contracts, error messages that do not leak
internals, pagination and unbounded result sets, mass-assignment exposure, HTTP
method semantics for state-changing operations, and content-type handling.

---

# 2. Data

## 2.1 `production.database`

| Area | What to inspect |
|---|---|
| **Constraints** | NOT NULL, unique, check constraints — is the schema enforcing invariants or is the app? |
| **Indexes** | indexes for the actual query patterns; unused indexes; missing indexes on FK and filter columns |
| **Foreign keys** | present? with what ON DELETE behavior (this determines deletion completeness) |
| **Transactions** | multi-step writes that must be atomic — are they in a transaction? |
| **Races** | check-then-write patterns, non-atomic counters, missing unique constraints where uniqueness matters, concurrent-update lost writes |
| **N+1** | loops issuing queries; ORM lazy-loading in list views |
| **Query safety** | parameterization vs string interpolation; raw SQL sites; dynamic ORDER BY / table names |
| **Migrations** | see §2.3 |
| **Backups** | see §2.4 |
| **Restore** | has a restore ever been exercised? evidence, or `UNKNOWN` |
| **Connection limits** | pool size vs serverless concurrency — the classic serverless connection exhaustion |

Where row-level security or policy-based access exists, read the policies: a table
with RLS enabled but a permissive `USING (true)` policy is not protected, and a
service-role key used from a user-facing path bypasses RLS entirely.

## 2.2 `production.storage`

Bucket/container inventory with the public-vs-private posture of each. Upload
validation (type, size, content sniffing, filename/path sanitization), object key
structure (guessable keys plus a public bucket is a real exposure; guessable keys
in a private bucket is not), signed-URL expiry and scope, direct-upload policies,
and whether the storage layer enforces per-user access or relies on unguessable
URLs.

**Public bucket ≠ vulnerability** (Principle 1). Establish what the bucket
*contains* — marketing assets in a public bucket are correct design. The finding is
"private user data is reachable without authorization", proven with a request, not
"a bucket is public".

## 2.3 `production.migrations`

Are migrations versioned, ordered, and reversible? Are they applied by an
identified process (CI, manual, on-boot)? Destructive operations (column/table
drops, type changes, non-concurrent index builds on large tables) and whether they
are safe against a running deployment. Data backfills mixed into schema migrations.
Divergence between the migration history and the live schema. Rollback story.

Any recommendation that touches migrations is `PLAN_REQUIRED` at minimum — see
`fix-safety.md`.

## 2.4 `production.backups`

What is backed up, by whom, how often, where it is stored, how long it is retained,
whether it is encrypted, and whether restores have been tested. Managed-provider
defaults count as evidence only when configuration is present or documented —
otherwise `UNKNOWN`. Backups also matter to compliance: they are a retention
surface and a deletion surface.

## 2.5 `production.disaster-recovery`

Recovery objectives (stated or absent), the concrete recovery procedure, what
happens if the primary provider is unavailable, whether infrastructure is
reproducible from code, and where the single copies of critical state live. Scale
the expectation: for a pre-launch project, "documented restore procedure" is the
bar; for a revenue system, exercised recovery is.

## 2.6 `production.caching-cdn`

Cache layers, keys, and TTLs. Correctness first: is any per-user or authenticated
response cacheable by a shared cache (`Cache-Control` on authenticated routes, CDN
caching of personalized HTML, `Vary` handling)? Cache-key collisions across tenants
are a cross-user data-exposure class. Then invalidation, stampede behavior, and
whether cached data is a compliance surface (retention/deletion).

---

# 3. Access control

## 3.1 `production.authn` — Authentication

Inspect: password handling (hashing algorithm and parameters, minimum policy,
breach-list checks if any), session mechanism (cookie flags `HttpOnly`/`Secure`/
`SameSite`, token storage location, expiry, rotation, revocation on logout and on
password change), OAuth/social flows (state parameter, PKCE, redirect-URI
allowlisting, token validation, account-linking safety), MFA (available? enforced
for admins?), password reset (token entropy, single use, expiry, session
invalidation after reset), email verification (enforced before privileged actions?),
account enumeration (do login, signup, and reset responses and timings reveal
whether an address exists?), and brute-force protection (cross-reference §4.2).

## 3.2 `production.authz` — Authorization

| Area | What to establish |
|---|---|
| **Model** | RBAC, ABAC, ownership-based, tenant-scoped, or ad-hoc — and whether it is applied consistently |
| **Ownership checks** | does every route that reads/writes a record verify the caller owns it? |
| **Tenant isolation** | is the tenant scope derived from the session, or accepted from the request? |
| **Admin isolation** | how is admin granted and checked; is the admin surface separately protected |
| **Object-level authz** | the highest-yield class: an authenticated route that fetches by an id from the request without an ownership predicate |
| **Consistency** | middleware-level protection with route-level exceptions; new routes missing the guard |

**Safe cross-user testing where the environment permits**: with two accounts in a
non-production environment, request account B's resource with account A's session
and record the response. That reproduction is what turns a suspected authorization
gap into `FAIL_TECHNICAL` with `VERY_HIGH` confidence. Never run such tests against
production data, never against real users' records, and never create or mutate data
to do it. Where testing is not possible, the finding stands on code evidence with a
`recommended_test`.

## 3.3 `production.security` — Web application security

Investigate each class, with the code path and boundary named:

| Class | Look for |
|---|---|
| **SQL injection** | string-built queries, unparameterized raw SQL, dynamic identifiers |
| **NoSQL injection** | user-controlled objects reaching query filters, `$where`, operator injection |
| **Command injection** | `exec`/`spawn`/`system` with interpolated input, shell-invoking helpers |
| **XSS** | `dangerouslySetInnerHTML`, `innerHTML`, unescaped template output, user-controlled URLs in `href`/`src`, `javascript:` URLs, markdown/HTML rendering without sanitization |
| **CSRF** | state-changing routes relying on cookie auth without token or `SameSite` protection; verify actual cookie attributes |
| **SSRF** | server-side fetches of user-supplied URLs, webhook/callback registration, image/URL preview fetchers, metadata-endpoint reachability |
| **CORS** | reflected origins, `*` with credentials, overly broad allowlists |
| **Open redirect** | post-login/logout `next`/`returnTo` parameters without allowlisting |
| **Path traversal** | user input in file paths, storage keys, or archive extraction |
| **Deserialization** | `pickle`, `yaml.load`, `eval`-adjacent parsing of untrusted input |
| **Unsafe templates** | server-side template injection, user input reaching template compilation |
| **Uploads** | see §5.3 |
| **Secrets** | see §4.4 |
| **Tokens** | JWT algorithm confusion, `none` acceptance, unverified signatures, missing audience/issuer checks, long-lived non-revocable tokens, tokens in URLs or logs |

Also check security headers (CSP and whether it is actually restrictive, HSTS,
`X-Content-Type-Options`, frame ancestors) and TLS enforcement.

## 3.4 `production.rate-limiting`

**Rate limits are judged proportional to the abuse and cost surface**, not by a
global "every endpoint needs a limiter" rule. For each surface below, the question
is: what does an attacker or a runaway client gain, and what does each request
cost?

| Surface | Why it matters |
|---|---|
| **Login** | credential stuffing, account takeover |
| **Signup** | mass account creation, spam infrastructure |
| **OTP / verification codes** | code brute force, SMS pumping cost |
| **Password reset** | enumeration, mail-volume abuse, reputation damage |
| **AI generation** | direct per-request provider cost — the highest-cost surface in most modern apps |
| **Email sending** | provider cost, deliverability reputation |
| **SMS sending** | direct cost, toll-fraud exposure |
| **Uploads** | storage cost, bandwidth, processing cost |
| **Search** | expensive queries, database saturation |
| **Public APIs** | scraping, resource exhaustion |
| **Payments** | card testing against the processor |

Record for each: is a limit present, at what layer (edge, middleware, handler,
provider), keyed on what (IP alone is weak behind NAT/proxies; prefer account or
combined keys), with what window, and what happens at the limit. Missing limits on
a **cost-bearing** surface (AI, SMS, email) are ranked above missing limits on a
cheap read endpoint. A cheap, idempotent, authenticated read with no abuse story
does not need a limiter, and saying so is a valid `PASS`.

---

# 4. Platform and operations

## 4.1 `production.hosting-cloud`

Hosting/platform inventory, regions, network exposure (which services are publicly
reachable), IaC coverage vs console-configured drift, resource limits and
timeouts at the platform level, and platform-level protections in use.

## 4.2 `production.abuse-prevention`

Beyond rate limits: account-creation abuse, content spam, scraping, enumeration of
resources by sequential ids, referral/credit abuse, free-tier abuse of paid
resources (AI credits especially), and whether abuse is detectable at all from the
current logging (cross-reference §7.1).

## 4.3 `production.bot-protection`

CAPTCHA/challenge presence on abuse-prone surfaces, bot-management at the edge,
`robots.txt` vs actual protection (it is not protection), automation-friendly
endpoints without any friction, and — where protection exists — whether it is
enforced server-side or bypassable by calling the API directly.

## 4.4 `production.secret-management`

Where secrets live (platform env config, secret manager, `.env` files), whether any
secret is committed to git history (scan history, not just the working tree),
whether `.env*` is gitignored, key rotation posture, separation of test and live
keys, client-exposed variables carrying non-public values, and secrets reaching
logs, error reports, or AI prompts.

**Report values redacted, always** (`sk_live_…REDACTED`). A committed live
credential is `CRITICAL` and its remediation is a human action (rotation is
`PROHIBITED_AUTOFIX` — the system never rotates production credentials).

## 4.5 `production.environment-separation`

Separate credentials, databases, storage, and provider accounts per environment;
whether development or CI can reach production data; test/live payment key mixing;
seed/demo data in production; and debug flags enabled in production builds.

## 4.6 `production.dependencies`

Direct vs transitive inventory, known-vulnerability status from the lockfile,
unmaintained or abandoned packages on critical paths, install scripts, typosquat
risk on obscure names, license posture (cross-reference `compliance.copyright`),
pinning and lockfile presence, and whether automated update tooling exists.

Severity follows **reachability**: a vulnerable transitive package in a dev-only
tool is not the same finding as one in the request path. Establish reachability
before assigning severity.

## 4.7 `production.ci-cd`

| Element | What to verify |
|---|---|
| **Tests** | do they run automatically, on which events, and do failures block? |
| **Lint** | present and enforcing, or advisory? |
| **Typecheck** | present in the pipeline, not just in the editor |
| **Security scanning** | dependency/secret/SAST scanning present; are results gating? |
| **Gates** | which checks are required vs informational — `continue-on-error` silently defeats gates |
| **Branch protection evidence** | required checks, review requirements — recorded as evidence where readable, `UNKNOWN` where the setting lives outside the repo |
| **Staging** | does a pre-production environment exist and does the pipeline use it? |
| **Rollback** | how a bad deploy is reverted; is it exercised? |
| **Secret handling** | pipeline secrets scoped and masked; secrets not echoed; forked-PR exposure |
| **Migration workflow** | how schema changes are applied relative to deploys, and what happens when a deploy is rolled back after a migration |

Excessive workflow permissions (`permissions: write-all`, unpinned third-party
actions on `pull_request_target`) are findings in their own right.

## 4.8 `production.rollback`

Can a deployment be reverted quickly, is the previous artifact retained, are
migrations compatible with the previous version (backward-compatible schema
changes), and is there a documented, evidenced procedure?

## 4.9 `production.feature-flags`

Flag mechanism, whether flags are evaluated server-side for anything
security-relevant (a client-side flag hiding an admin feature is not a control),
stale flag accumulation, default-on risk, and per-tenant targeting correctness.

## 4.10 `production.api-versioning`

For a public or consumed API: is there a versioning scheme, are breaking changes
detectable, is there a deprecation path, and are mobile clients (which cannot be
force-updated) accounted for?

---

# 5. Interfaces and integrations

## 5.1 `production.webhooks`

| Check | Detail |
|---|---|
| **Signature verification** | is every inbound webhook verified against the provider's signing secret, using the **raw body** before parsing, with a constant-time comparison and timestamp/replay window? An unverified webhook endpoint that grants entitlements is typically `CRITICAL`. |
| **Idempotency** | see §5.2 |
| **Retries** | does the handler return the right status codes so the provider retries appropriately — and not retry-storm on permanent failures? |
| **Duplicates** | providers deliver at-least-once; is a repeated event safe? |
| **Ordering** | events can arrive out of order; does the handler assume sequence? |
| **Source of truth** | is provider state or local state authoritative, and is that consistent across the codebase? |
| **Reconciliation** | is there any process to detect and repair missed events? |

Outbound webhooks get the mirror treatment: signing, retries with backoff, SSRF
exposure from user-supplied destination URLs, and secret handling.

## 5.2 `production.idempotency`

Which operations must be exactly-once (charges, entitlement grants, credit
deduction, email/SMS sends, job execution)? Is there an idempotency key, is it
persisted, is the uniqueness enforced by the **database** rather than by a
check-then-write, and does a retry return the original result rather than
performing the action twice?

## 5.3 `production.file-uploads`

Type and size validation server-side (never trusting the client-declared
content-type or extension), content sniffing, image/document processing library
exposure, archive extraction safety, filename and path sanitization, storage target
and its access posture, malware handling if relevant, and whether uploads are
counted against a quota or rate limit (cross-reference §3.4).

## 5.4 `production.payment-reliability`

Distinct from `compliance.billing`. Verify: charges are created and confirmed
server-side (never trusting client-reported success), amounts and currencies are
computed server-side from server-held prices, the entitlement is granted only from
a verified server signal, webhook and redirect paths cannot double-grant,
subscription state stays synchronized with the processor, failed payments and
dunning are handled, refunds and chargebacks propagate to entitlements,
reconciliation exists for missed events, and test/live keys are not mixed.

## 5.5 `production.email-reliability`

Provider configuration, SPF/DKIM/DMARC evidence where readable, transactional vs
marketing separation, bounce and complaint handling, retry behavior for critical
mail (verification, reset, receipts), templating injection risk, and whether a
provider outage silently breaks signup or password reset.

## 5.6 `production.background-jobs`

Job inventory and trigger mechanism, execution guarantees (at-most-once vs
at-least-once and whether handlers match that assumption), failure visibility,
whether jobs run with elevated credentials (a trust boundary — see `discovery.md`
§4), overlapping runs of long jobs, and scheduling reliability.

## 5.7 `production.queues`

Queue technology and semantics, visibility timeouts vs actual processing time,
dead-letter configuration and whether anyone would notice items landing there,
poison-message handling, backlog growth and its alerting (cross-reference §7.2),
and ordering guarantees the code assumes vs those the queue provides.

## 5.8 `production.vendor-failure`

For each critical external dependency (auth provider, database host, payment
processor, AI provider, email/SMS provider, CDN): what happens to the product when
it is unavailable or slow? Which user journeys break entirely, which degrade, and
which fail silently? Is there a status-page/alerting awareness path? This is the
practical form of the SPOF analysis in §1.2.

---

# 6. Resilience

## 6.1 `production.timeouts`

Every outbound call — HTTP, database, cache, queue, AI provider — needs a bounded
timeout. Hunt for defaults that are effectively infinite (many HTTP clients),
timeouts longer than the platform's own function timeout (the call is killed
mid-flight, leaving inconsistent state), and missing client-side timeouts on
long-running user actions.

## 6.2 `production.retries`

Retries must be **bounded**, must use **backoff with jitter**, and must only apply
to retryable failures. Findings: unbounded retry loops, immediate retries in tight
loops, retrying non-idempotent operations (cross-reference §5.2), retry
amplification across nested layers (client × server × provider SDK), and retries
that multiply cost (AI calls especially — cross-reference `domains-ai.md`).

## 6.3 `production.graceful-degradation`

When a non-critical dependency fails, does the product degrade or collapse? Check:
analytics/tracking failures blocking rendering, error-tracking failures breaking
requests, AI-provider failure taking down a page that only *optionally* uses AI,
cache unavailability falling through correctly, and user-facing error states that
say something useful.

**Circuit breaking is recommended only where warranted** — a repeatedly failing,
expensive, or slow dependency on a hot path. Do not recommend a breaker as a
default pattern for a project that makes three outbound calls a minute.

## 6.4 `production.scaling`

Identify the actual constraint before recommending anything: database connections,
single-threaded processing, N+1 query growth, unbounded in-memory state, per-request
cost, provider rate limits, cold starts. Evidence-based only — projected load
without data is `UNKNOWN`, and **no Redis ≠ scaling failure** (Principle 10).

## 6.5 `production.backend-performance`

Hot-path query cost, unbounded queries and missing pagination, serial awaits that
could be parallel, payload sizes, work performed per request that could be
deferred, and cold-start cost on serverless. Prefer measured evidence; where
measurement is unavailable, describe the mechanism and mark confidence accordingly.

## 6.6 `production.frontend-performance`

Bundle size and what is inflating it, render-blocking third-party scripts (often the
same trackers found in `compliance.cookies-tracking`), image handling, layout
stability, unnecessary client-side data fetching waterfalls, and the cost of
hydration on the critical path.

## 6.7 `production.cost-controls`

Where can spend run away: AI token usage, SMS, email volume, storage growth,
egress/bandwidth, serverless invocation loops, log volume, and a function that
retries a paid call. Are there budgets, caps, quotas, or alerts? Cost controls are
a reliability concern, not a nicety — an unbounded AI retry loop is both an
availability and a financial finding.

---

# 7. Observability and quality

## 7.1 `production.logging`

Structured logs (parseable, with consistent fields) vs `console.log` scatter;
correlation/request IDs threading through the request and into background jobs;
distributed traces where the architecture warrants; log levels used meaningfully;
and — critically — **PII and secret leakage into logs**: request bodies, headers
containing tokens, emails and names in error context, full AI prompts, payment
details, and stack traces reaching the client.

Log leakage is simultaneously a security finding and a privacy finding
(cross-reference `compliance.privacy` — logs are a storage location in the data-flow
model and a surface for retention and deletion).

## 7.2 `production.monitoring`

What is observed today: uptime checks, latency, error rate and error grouping,
queue depth, payment failure rate, AI-provider failure rate, database health
(connections, slow queries, storage), and saturation signals (CPU, memory, disk,
connection pools). Record what exists with evidence and what is absent.

## 7.3 `production.alerts`

Does anything *notify a human*? Which conditions, to which destination, with what
severity, and is there any deduplication/noise control? A dashboard nobody watches
is not an alert.

**Scale to project size**: for a small pre-launch project, "error tracking with
email alerts on new issues" is a reasonable bar and recommending full SLO tooling
is an audit defect. For a system carrying payments or user data, silent failure on
payment or deletion paths is a real finding.

## 7.4 `production.testing`

What exists (unit, integration, e2e), what the tests actually cover on the critical
paths (auth, authorization, payments, deletion), whether they run in CI and gate
merges, whether they are deterministic, and whether tests touch production
resources.

**Few tests ≠ automatically unsafe** (Principle 11). The finding is never "coverage
is low"; it is "this specific critical path — authorization on the documents route
— has no test, and a regression there is not detectable", with the path named.

## 7.5 `production.accessibility`

Semantic structure and landmarks, keyboard operability of all interactive controls,
focus management in dialogs and route changes, labels and accessible names on form
controls, color contrast, alt text, motion preferences, and screen-reader-visible
error announcement. Scale expectations to the product's audience and maturity, and
prefer specific, reproducible defects over a generic "improve accessibility".

---

# 8. Module index

| # | Module id | # | Module id |
|---|---|---|---|
| 1 | `production.system-design` | 23 | `production.secret-management` |
| 2 | `production.architecture` | 24 | `production.environment-separation` |
| 3 | `production.frontend` | 25 | `production.webhooks` |
| 4 | `production.backend-api` | 26 | `production.background-jobs` |
| 5 | `production.database` | 27 | `production.queues` |
| 6 | `production.storage` | 28 | `production.email-reliability` |
| 7 | `production.authn` | 29 | `production.payment-reliability` |
| 8 | `production.authz` | 30 | `production.idempotency` |
| 9 | `production.hosting-cloud` | 31 | `production.timeouts` |
| 10 | `production.ci-cd` | 32 | `production.retries` |
| 11 | `production.security` | 33 | `production.graceful-degradation` |
| 12 | `production.rate-limiting` | 34 | `production.api-versioning` |
| 13 | `production.caching-cdn` | 35 | `production.feature-flags` |
| 14 | `production.logging` | 36 | `production.rollback` |
| 15 | `production.monitoring` | 37 | `production.accessibility` |
| 16 | `production.alerts` | 38 | `production.frontend-performance` |
| 17 | `production.testing` | 39 | `production.backend-performance` |
| 18 | `production.scaling` | 40 | `production.cost-controls` |
| 19 | `production.migrations` | 41 | `production.abuse-prevention` |
| 20 | `production.backups` | 42 | `production.bot-protection` |
| 21 | `production.disaster-recovery` | 43 | `production.file-uploads` |
| 22 | `production.dependencies` | 44 | `production.vendor-failure` |

All 44 modules receive a router classification. `NOT_APPLICABLE` requires evidence
of absence (no payments integration, no queue, no mobile client) and is recorded in
the report's *Modules Skipped / N/A* section — never used to trim scope quietly.
