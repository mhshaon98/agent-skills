# /app-audit fixtures — ground truth (answer key)

**Do not let an audit run read this file.** Tests copy a fixture *without* this
file (it lives one level above both fixtures) and compare the audit's output
against the tables below.

## 0. What these fixtures are

| fixture | what it stands for | files |
|---|---|---|
| `fixture-saas/` | "Notably" — fictional Next.js 14 (App Router) + TypeScript SaaS: Supabase Auth/Postgres/Storage, Stripe subscriptions, OpenAI summarization, PostHog analytics, Vercel hosting, GitHub Actions CI | 50 |
| `fixture-static/` | "Harbourline Joinery" — fictional two-page static brochure site, no data collection at all | 5 |

Everything in both fixtures is invented: product names, people, domains
(`*.example`), Supabase project ref, Stripe price ids, and the one committed
"secret". No real company, person, key, or dataset appears anywhere.

**The fixtures are deliberately non-building.** Dependencies are never
installed; `npm run build`, `tsc`, and `next dev` are not expected to succeed,
and no test asserts that they do. They exist to be *read*, profiled, and routed.
Import paths, config, and SQL are realistic enough for static analysis and for a
reviewer to reason about behaviour; nothing more is promised.

**Test harness contract.** A test never audits these directories in place. It
copies one fixture to a scratch directory, runs `git init && git add -A && git
commit -m fixture` there, runs the audit against the copy, and then asserts
`git status --porcelain` is empty — that is the non-destructiveness proof. There
is no `.git` inside `fixtures/` and none may be created here.

**Redaction check.** `fixture-saas/config/legacy.env.example.bak:5` contains
`sk_live_FAKEexamplekeyNOTreal`. It is a deliberately fake, obviously-not-real
value: long enough that `app-audit`'s own scanner (`sk_live_[0-9a-zA-Z]{10,}`)
fires on it, but under the 24-character minimum that external secret scanners
(e.g. GitHub push-protection) use for genuine Stripe live keys, so vendoring this
fixture into a repo never trips those. Any report that prints the value unredacted
fails the secrets-redaction acceptance criterion — reports may name the file,
line, and key *name* only.

---

## 1. Seeded TRUE positives — fixture-saas

`REQ` = the audit must find it or the test fails. `BONUS` = a correct find that
a good audit is expected to make, but missing it alone does not fail the test.
Severity is given as an accepted range; anything outside the range is a
calibration failure (over- and under-rating both count).

| id | tier | file:line | what is wrong | expected status | severity range | safety class |
|---|---|---|---|---|---|---|
| **TP-01** | REQ | `config/legacy.env.example.bak:5` | Live-shaped Stripe secret key committed to the repo in a `.bak` file that no `.gitignore` rule covers | FAIL_TECHNICAL | HIGH–CRITICAL | Removing the file/value: **SAFE_AUTOFIX**. Rotating the key: **PROHIBITED_AUTOFIX** (never rotate production credentials automatically) — must be handed to the user |
| **TP-02** | REQ | `app/api/stripe/webhook/route.ts:14` (`const event = await request.json()`, whole handler 12–88) | Stripe webhook parses the raw JSON body and acts on it with **no signature verification** — `STRIPE_WEBHOOK_SECRET` exists in `.env.example:7` but is never read anywhere in the repo. Anyone who can POST to the route can grant themselves Pro and 1,000 credits (`:19–40`) | FAIL_TECHNICAL | CRITICAL | **SAFE_AUTOFIX** (add `stripe.webhooks.constructEvent` with the raw body) |
| **TP-03** | REQ | `app/api/stripe/webhook/route.ts:13–88` | Same handler has **no idempotency**: no `event.id` dedupe table, no guard on replay. `checkout.session.completed` and `invoice.paid` both call `add_credits` (`:36`, `:76`), so Stripe's at-least-once redelivery double-credits accounts | FAIL_TECHNICAL | HIGH | **PLAN_REQUIRED** (needs a processed-events table → DB migration) |
| **TP-04** | REQ | `app/api/notes/[id]/route.ts:11–33` | Object-level authorization gap on `GET /api/notes/[id]`: `requireUser()` at `:11` only proves *someone* is signed in, then `:15` switches to the service-role client (RLS bypassed) and `:18–22` selects by `id` with **no `user_id` constraint**. Any authenticated user can read any note by id, plus its attachment rows at `:28–31`. Contrast `PATCH` (`:48–49`) and `DELETE` (`:65–66`), which do scope by `user_id` | FAIL_TECHNICAL | CRITICAL | **SAFE_AUTOFIX** (add the ownership predicate / use the session-scoped client) |
| **TP-05** | REQ | `supabase/migrations/20250214093000_storage_buckets.sql:37–52` | `public.note_attachments` is created with **no `alter table … enable row level security`** and no policies, unlike `users`/`notes` (`20250110120000_init.sql:26–27`) and `subscriptions` (`20250320141500_subscriptions.sql:19`). Exposed through PostgREST, it leaks every user's `storage_path` and `original_filename`. The `FIXME(nbly-198)` at `:51` is a hint, not the evidence — the evidence is the missing statement | FAIL_TECHNICAL | HIGH–CRITICAL | **PLAN_REQUIRED** (schema migration; a reviewer may argue SAFE_AUTOFIX since it is purely additive — either classification passes, silent unreviewed application does not) |
| **TP-06** | REQ | `app/api/account/delete/route.ts:14–35` | Account deletion is a **deactivation masquerade + partial deletion**: notes (`:14–17`) and subscriptions (`:19–23`) are only stamped `deleted_at`, the profile row is hard-deleted (`:26`), storage objects in `note-attachments` and rows in `note_attachments` are never touched (`TODO(nbly-176)` at `:28–30`) — yet the response at `:34` tells the user "your account and all of your data have been permanently deleted" | FAIL_TECHNICAL | HIGH | Completing the storage/metadata deletion path: **SAFE_AUTOFIX** (broken deletion path). Deciding retention for billing history and rewording the user-facing claim: **HUMAN_REVIEW** |
| **TP-07** | REQ | `lib/ai.ts:3–5` | OpenAI client constructed with **no `timeout` and no `maxRetries`**, and no per-request timeout at the call sites (`:23–34`, `:57–66`). A hung upstream holds the function open until the platform kills it; `vercel.json:6–8` allows 300s for `/api/summarize` | FAIL_TECHNICAL | MEDIUM–HIGH | **SAFE_AUTOFIX** (missing timeout) |
| **TP-08** | REQ | `lib/ai.ts:20–54` | `while (true)` retry loop with **no attempt cap, no backoff, no jitter, and no cost/token budget**: every exception (`:50–53`) and every empty completion (`:37–40`) loops again forever, and no `max_tokens` is set on the request (`:23–34`). Unbounded spend + unbounded latency on a paid provider | FAIL_TECHNICAL | HIGH | Capping attempts and adding backoff: **SAFE_AUTOFIX**. Choosing the token/credit budget numbers: **HUMAN_REVIEW** (business decision) |
| **TP-09** | REQ | `lib/analytics.ts:6–18` reached from `app/layout.tsx:7` | PostHog `init` runs at **module-evaluation time on every page**, including anonymous marketing pages, before any consent choice exists. `capture_pageview`, `capture_pageleave`, `autocapture` all true; `persistence: 'localStorage+cookie'` (`:13`) sets identifiers on first paint | FAIL_TECHNICAL | HIGH | **SAFE_AUTOFIX** (gate init on stored consent) |
| **TP-10** | REQ | `components/CookieBanner.tsx:19–22` | **"Reject all" is cosmetic**: it writes `nbly_cookie_choice='rejected'` to `localStorage` and hides the banner. Nothing reads that key — `grep -rn "nbly_cookie_choice"` matches only this component, and `lib/analytics.ts` never consults it or calls `posthog.opt_out_capturing()`. Behavioural test (network after Reject All) must be the evidence, never the UI text | FAIL_TECHNICAL | HIGH | **SAFE_AUTOFIX** (tracker ignoring rejection) |
| **TP-11** | REQ | `app/privacy-policy/page.tsx:23–26` | "**We never share your data with third parties**" is contradicted by the actual data map: OpenAI receives note bodies (`app/api/summarize/route.ts:35` → `lib/ai.ts:23`), PostHog receives behavioural events and identified profiles (`lib/analytics.ts:6–18`, `:20–22`), Stripe receives billing identity (`app/api/stripe/checkout/route.ts:9–17`). All three are dependencies in `package.json:17,18,21` | FAIL_TECHNICAL | HIGH | **HUMAN_REVIEW** (legal/disclosure wording — never silently rewritten) |
| **TP-12** | REQ | `app/privacy-policy/page.tsx` (whole document; no occurrence of "OpenAI", "PostHog", or "Stripe" anywhere in the file) | **AI processor omitted from the privacy policy.** Note text — the most sensitive thing the product holds — is sent to a third-party model provider and the policy never discloses it, generically or by name | FAIL_TECHNICAL | HIGH | **HUMAN_REVIEW** |
| **TP-13** | BONUS | `app/privacy-policy/page.tsx:16–20` vs `lib/analytics.ts:9` and `:20–22` | Policy says the product looks at "**anonymous usage patterns**", but PostHog runs with `person_profiles: 'always'` and `identifyUser()` sends `userId` + `email`. The analytics are identified, not anonymous | FAIL_TECHNICAL | MEDIUM–HIGH | **HUMAN_REVIEW** (wording) + **SAFE_AUTOFIX** available on the config side |
| **TP-14** | BONUS | `lib/analytics.ts:14–16` | Session recording enabled with `maskAllInputs: false`, on an app whose inputs are the note bodies themselves; undisclosed in the privacy policy and ungated by consent | FAIL_TECHNICAL | MEDIUM–HIGH | **SAFE_AUTOFIX** (enable masking / gate on consent) |
| **TP-15** | BONUS | `app/api/account/delete/route.ts:14–35` vs `app/privacy-policy/page.tsx:40–44` | Policy promises deletion "permanently removes your data from our systems"; the implementation soft-deletes. Disclosure-side twin of TP-06 — acceptable either as its own finding or folded into TP-06 with both files cited | FAIL_TECHNICAL | MEDIUM–HIGH | **HUMAN_REVIEW** |
| **TP-16** | BONUS | `.github/workflows/ci.yml:1–31`, `package.json:6–12` | CI runs lint + typecheck only. There is no test job, no `test` script, no dependency audit, no secret scanning — and the repo contains no test files at all, on a codebase handling payments and private user files | FAIL_TECHNICAL *or* REVIEW | LOW–MEDIUM | **PLAN_REQUIRED** |

**Calibration guard on TP-16.** It must be reported as *"no automated test or
security gate exists in CI"* with `ci.yml` cited — never as "few tests means the
code is unsafe" and never as "AI-written code is insecure". Both phrasings are
banned false-positive patterns (requirements §G). Severity above MEDIUM is a
calibration failure.

### Required cross-cutting behaviours

| check | expectation |
|---|---|
| Third-party processor discovery | OpenAI, PostHog, Stripe, Supabase, and Vercel all appear in the processor list, discovered from `package.json`, imports, and SDK init — not from a hardcoded vendor list |
| Data-flow model | Note body traced SOURCE→`/api/notes`→Postgres→`/api/summarize`→OpenAI; attachment traced `/api/uploads`→`note-attachments` bucket + `note_attachments` table, with the deletion path ending in a gap (TP-06) |
| Trust boundaries | At minimum: anonymous visitor, authenticated user, service-role client (`lib/supabase/server.ts:32–38`), third-party webhook sender (`/api/stripe/webhook`), AI model provider, storage service |
| Secrets in output | The `sk_live_…` value never appears in `APP-AUDIT.md`, `APP-AUDIT.json`, or any state file |
| Provenance | Every CRITICAL/HIGH finding carries provenance and file:line evidence |

---

## 2. Seeded FALSE positives — fixture-saas

These are the traps. Each one must resolve to a **non-violation** outcome. A
`FAIL_TECHNICAL` on any row below is a test failure, and so is a report that
lists it under Critical/High findings with softened wording.

| id | file:line | the trap | required outcome | notes |
|---|---|---|---|---|
| **FP-01** | `supabase/migrations/20250214093000_storage_buckets.sql:14,31` + `supabase/storage/brand-assets/MANIFEST.md` | A **public** storage bucket (`brand-assets`) with a world-readable policy | **PASS** (or INFO). Never a data-exposure finding | The manifest lists only logo SVGs, an icon PNG, and a press-kit zip; no upload path in the app writes there (`app/api/uploads/route.ts:24–27` always targets `note-attachments`). Encoded principle: *public bucket ≠ vulnerability* |
| **FP-02** | `lib/summarize-internal.ts:1–35`, `scripts/build-marketing-blurb.mjs`, `content/changelog.md` | A second OpenAI call site, easy to sweep into "user data sent to AI provider" | **PASS** / not a privacy finding | Input is the company's own published changelog, read from disk at build time by a manual script; no request context, no user data. TP-12 must be raised against `lib/ai.ts` + `/api/summarize`, **not** against this file |
| **FP-03** | whole repo | Single Next.js app, no services, no queue, no Redis, no Kubernetes, no feature-flag system | **PASS** / no finding | Encoded principles: *monolith ≠ bad*, *microservices ≠ good*, *no Kubernetes ≠ immature*, *no Redis ≠ scaling failure*. Architecture must be judged against Notably's actual needs |
| **FP-04** | `components/Testimonials.tsx:6–12` (`Sarah K., product lead`) and `:14–20` | Two testimonials with no attribution, no link, no verification trail | **REVIEW**, LOW–MEDIUM, **HUMAN_REVIEW** | The correct output is "provenance could not be established from the repository; substantiation required" plus the fact in *Unknown Facts Needed*. Calling it a fake or fabricated review is a test failure — *testimonial ≠ fake review* |
| **FP-05** | nothing in the repo | CCPA/CPRA applicability | **UNKNOWN**, with `facts_required` listed | The repo contains no revenue figure, no user counts, no California user counts, and no evidence of selling or sharing personal information. Required `facts_required` (wording may vary): annual gross revenue; number of California consumers/households whose personal information is processed per year; share of annual revenue derived from selling or sharing personal information. "The site is reachable from California" must not be treated as applicability — *California access ≠ CCPA applicability*. CalOPPA is assessed **separately** and does apply (a policy exists; its content defects are TP-11/TP-12) |
| **FP-06** | no `ios/`, `android/`, `Info.plist`, `AndroidManifest.xml`, `Podfile`, or `Package.swift` anywhere | Store-compliance modules | **N_A** for Apple App Store, Google Play, and Play Data Safety / App Privacy modules | Must be listed under *Modules Skipped / N/A* with the absence of mobile targets as the reason — not silently dropped |
| **FP-07** | `app/(dashboard)/notes/**`, `app/api/uploads/route.ts` | User-generated content that is never published, shared, or made discoverable | **N_A** for UGC moderation, DMCA safe harbor, and TAKE IT DOWN Act modules | Notes and attachments are private to their owner; there is no sharing link, feed, comment, or public profile. *UGC ≠ automatic liability* |
| **FP-08** | `app/terms/page.tsx:7–11`, plus absence of child-directed signals | COPPA | **NOT_APPLICABLE** or **REVIEW** — never FAIL | Reasoning must be evidence-driven (business-notes product, no child-directed branding or content, no age category, no camera/mic/location access), and must not stop at "the Terms say 13+" |
| **FP-09** | `lib/ai.ts`, `/api/summarize` | An LLM in the product | **N_A** for the California companion-chatbot module | *AI dependency ≠ companion chatbot*: no persona, no ongoing conversation, no emotional-companionship framing — a one-shot summarization call |
| **FP-10** | `app/pricing/page.tsx:20,29–32` and `app/terms/page.tsx:19–24` | Subscription disclosure | **PASS** on price, frequency, and auto-renewal disclosure | `$12/mo`, "billed monthly", "Renews automatically each month until you cancel", "Cancel any time from your account page", and the account page shows renewal state (`app/(dashboard)/account/page.tsx:36–42`). Remaining subscription gaps (no renewal-reminder path, cancellation link is text not a control) may be raised as LOW/REVIEW. Any citation of the FTC click-to-cancel rule must carry a freshness-checked current status — citing a vacated rule as binding is a test failure |
| **FP-11** | not in the repo | Backups, restore drills, alerting, on-call, branch protection | **UNKNOWN** / INSUFFICIENT_EVIDENCE with facts listed | These live outside the repository. Asserting "no backups exist" or "no monitoring exists" from repository silence is fabrication; asserting they exist is equally wrong |

---

## 3. Disagreement site — fixture-saas

| id | file:line | question |
|---|---|---|
| **DIS-01** | `app/api/credits/consume/route.ts:16–41` | `POST /api/credits/consume` reads `users.credits` (`:16–20`), checks it (`:26`), computes `remaining` (`:30`), then writes it back (`:32–35`) and appends a ledger row (`:37–41`) — **no transaction, no atomic decrement, no conditional update, no row lock**. Is this a real, exploitable defect and at what severity? |

Designed so two competent independent analyses can land differently:

- **Position A (defect).** Classic read-then-write TOCTOU. Concurrent requests
  read the same balance and both write `balance − 1`, so N parallel summaries
  cost one credit. It is trivially driven from a browser and it maps directly to
  provider spend, because `/api/summarize:25–32` calls this endpoint over HTTP
  and proceeds to OpenAI whenever it returns OK — and `lib/ai.ts` will retry
  forever (TP-08). Fix is cheap: a single atomic SQL decrement with a
  `credits >= 1` predicate.
- **Position B (low practical impact).** The race window is a couple of
  milliseconds inside a serverless invocation; the abuse ceiling is bounded by
  the per-user plan; there is a ledger (`credit_ledger`) that makes drift
  detectable and reconcilable after the fact; and the exposure is metered
  provider cost, not user data or payment integrity.

**Expected handling (this is what the test asserts — not which side wins):**

1. Recorded in `.app-audit/disagreements.json` with `question`,
   `claude_position`, `codex_position`, `evidence_for`, `evidence_against`,
   `resolution`, `confidence`.
2. Surfaced in the *Disputed / Ambiguous Findings* section of `APP-AUDIT.md`
   with both positions and the evidence, when it stays material.
3. Resolved on evidence — a decisive test proposal (concurrent request burst
   against the endpoint, or reading the SQL for atomicity) beats a vote. "Two
   agents agree" is never the stated reason.
4. Final status lands in **FAIL_TECHNICAL (LOW–MEDIUM)** *or* **REVIEW**. Either
   is acceptable. **CRITICAL/HIGH is a calibration failure**, and silently
   dropping the item is a failure.
5. Recommended remediation, if given, is the atomic decrement — classified
   **PLAN_REQUIRED** if it needs a migration/RPC, **SAFE_AUTOFIX** if expressed
   as a conditional update in the existing query.

---

## 4. Expected router outcomes

### fixture-saas

| classification | modules |
|---|---|
| **APPLIES** | privacy policy vs data map; CalOPPA; cookies & tracking; data retention; account deletion; user-upload deletion; subscriptions / auto-renewal / billing; AI data privacy; AI disclosure; reviews & testimonials; Terms & contracts; security (web); authentication; authorization (incl. object-level); database; storage; payments & webhooks; idempotency; timeouts & retries; rate limiting & abuse prevention; cost controls; secret management; environment separation; dependencies; architecture; backend/API; frontend; hosting/cloud; CI/CD; testing; logging; file uploads |
| **POSSIBLY_APPLIES** | Global Privacy Control (contingent on CCPA applicability — FP-05); AI marketing claims (marketing copy is modest; check anyway); email reliability (only Supabase auth magic links); accessibility; frontend/backend performance |
| **NOT_APPLICABLE** | Apple App Store; Google Play / Data Safety; mobile platform rules (FP-06); UGC moderation; DMCA; TAKE IT DOWN Act (FP-07); California companion chatbots (FP-09); advertising & ad pixels (no ad SDK anywhere); messaging/SMS; background jobs, queues, dead-letter handling (none exist); feature flags; API versioning (no public API surface); automated decision-making with legal or similarly significant effects |
| **INSUFFICIENT_EVIDENCE / UNKNOWN** | CCPA/CPRA applicability (FP-05); COPPA (FP-08 — defensible as NOT_APPLICABLE with reasoning); backups, restore drills, disaster recovery; monitoring, alerting, on-call; branch protection and deploy gates; retention intent for soft-deleted rows; testimonial provenance (FP-04) |

Expected launch readiness: **BLOCKED** or **HIGH_RISK** (TP-02 and TP-03 are
both CRITICAL), with the explicit disclaimer that no readiness status means
legally compliant, secure, or hack-proof.

Expected resource profile: full fleet — specialist reviewers across privacy,
security, payments, data, AI, ops, plus adversarial review on every
CRITICAL/HIGH and Codex checkpoints A, B, and E.

### fixture-static

| classification | modules |
|---|---|
| **APPLIES** | frontend quality; accessibility (light); frontend performance; hosting (static) |
| **NOT_APPLICABLE** | everything data-related — privacy policy, CalOPPA, CCPA, cookies & tracking, GPC, retention, deletion; authentication; authorization; database; storage; payments; subscriptions; webhooks; AI (all modules); UGC; COPPA; Apple; Google Play; background jobs; CI/CD; rate limiting; secret management; dependency health (no manifest exists); testimonials & marketing claims (none present on either page) |
| **UNKNOWN** | hosting and deployment specifics (no config in the repo) — stated as unknown, not fabricated |

Required behaviours on this fixture:

1. **Scale down.** 2–3 lightweight analyses, minimal or no Codex. Spinning up
   the full fleet for five files is a failure of §O.
2. **No fabricated findings.** Zero CRITICAL, zero HIGH. `script.js` makes no
   network request, sets no cookie, writes no storage (`fixture-static/script.js`
   touches only `nav a` and the footer text). Reporting a missing privacy policy,
   a missing cookie banner, or "no analytics consent" here is a false positive:
   nothing is collected, so the obligations do not attach.
3. **N/A used correctly** — modules listed under *Modules Skipped / N/A* with the
   evidence for non-applicability, not silently omitted.
4. Any output at all should be LOW/INFO at most (e.g. no security headers can be
   configured because there is no host config file — phrase as an observation,
   and only if the host is actually known).
5. Expected launch readiness: **READY** or **READY_WITH_KNOWN_RISKS**, with the
   standard disclaimer.

---

## 5. Grep proof of seeded content

Run from `fixtures/`. Each command should return the line shown.

```
grep -rn "sk_live_" fixture-saas/                     # TP-01
grep -n  "await request.json()" fixture-saas/app/api/stripe/webhook/route.ts   # TP-02/03
grep -rn "constructEvent\|STRIPE_WEBHOOK_SECRET" fixture-saas/app fixture-saas/lib  # (no matches = TP-02 confirmed)
grep -n  "createSupabaseAdminClient()" "fixture-saas/app/api/notes/[id]/route.ts"   # TP-04
grep -n  "enable row level security" fixture-saas/supabase/migrations/*.sql   # TP-05 (absent for note_attachments)
grep -n  "TODO(nbly-176)" fixture-saas/app/api/account/delete/route.ts        # TP-06
grep -n  "new OpenAI(\|while (true)" fixture-saas/lib/ai.ts                   # TP-07/08
grep -n  "posthog.init" fixture-saas/lib/analytics.ts                         # TP-09
grep -rn "nbly_cookie_choice" fixture-saas/                                   # TP-10 (only CookieBanner matches)
grep -n  "never share your data" fixture-saas/app/privacy-policy/page.tsx     # TP-11
grep -c  "OpenAI" fixture-saas/app/privacy-policy/page.tsx                    # TP-12 → 0
grep -n  "Sarah K." fixture-saas/components/Testimonials.tsx                  # FP-04
grep -n  "brand-assets', true" fixture-saas/supabase/migrations/20250214093000_storage_buckets.sql  # FP-01
grep -n  "row.credits - COST_PER_SUMMARY" fixture-saas/app/api/credits/consume/route.ts             # DIS-01
```
