# Cloudflare Cost-Safety Playbook

Rules distilled from an account-wide billing audit across several projects after a
first invoice. Read this BEFORE creating or modifying anything on Cloudflare (Workers,
KV, R2, D1, Pages, DNS) in any project. Plan limits and prices change — verify current
figures on Cloudflare's pricing pages before relying on the numbers below.

## 0. The one structural truth

**"No surprise bill" is a plan-and-dashboard property, not a code property.**
Cloudflare bills a request before your code runs — no app-layer rate limiter, breaker,
or validation can cap spend. The spend ceiling is the PLAN.

## 1. Account facts to establish (verify in the dashboard, don't assume)

- Which account you're deploying to, and whether a card is on file (R2 requires one —
  after that, plan settings are the only guardrail).
- **Workers Free** has a hard daily request cap (requests beyond it error) and a fixed
  small CPU limit. That cap is the entire $0 guarantee for Workers. KV on Free has
  daily read and (much smaller) write allowances.
- **R2** is pay-as-you-go with free monthly allowances for storage, Class A ops, and
  Class B ops. **Egress is free** — the classic hotlink bill cannot happen on R2.
- Set billing alerts per product (e.g. R2 storage, Class A, Class B) well under the
  free allowances.
- Zones on the Free plan with DNS-only (gray-cloud) records are unmetered.

## 2. Hard rules for any new Cloudflare work

1. **Stay on Workers Free unless the user explicitly decides otherwise.** The hard cap IS
   the protection. Cloudflare upsells Paid from every limit page — the upsell is the
   threat model.
2. **Upgrading to Workers Paid is a ONE-WAY DOOR with a prerequisite:** `workers.dev`
   hostnames CANNOT take WAF or Rate Limiting rules (Cloudflare's zone, not yours). On
   Paid, requests to a workers.dev URL are unbounded spend with no possible edge
   mitigation. BEFORE any plan upgrade: move every worker behind a custom domain on an
   owned zone and add a Rate Limiting rule (runs pre-worker; blocked requests unbilled).
3. **No `[limits] cpu_ms` on Free** — the API rejects it. Free's fixed CPU limit is
   stricter anyway. Add an explicit `cpu_ms` (e.g. 50) before any first Paid deploy
   (Paid's default allows long billable CPU per request).
4. **New paid-capable products (R2 buckets, D1, Queues, Durable Objects, AI, Logpush,
   Observability) require:** a billing alert on that product's metrics BEFORE first
   real traffic, and a line in the project's `CLAUDE.md` naming the product + free-tier
   ceilings. Workers Observability may default ON for new workers — turn it off unless
   wanted (billable dimension on Paid).
5. **Never enable the r2.dev public URL** on a bucket serving an app — it bypasses the
   app's caching/auth and every hit is a raw billed Class B op. Serve through the app
   (or a custom domain with caching) instead.

## 3. Design rules (each traces to a shipped finding)

- **KV op-cost discipline in workers:** order request handling cheapest-first (header
  checks → cached breaker state → KV peeks → body work). Cache tripped global breakers
  in isolate scope keyed on the dated key so refusals cost 0 KV ops. Every KV key gets
  a TTL — nothing accumulates without expiry.
- **Know the KV write ceiling:** a few writes per accepted request can exhaust Free's
  daily write allowance at a few hundred requests — a service cliff (500s), not a bill.
  Reconcile app-level daily caps with it.
- **R2 media behind a proxy needs Cache-Control set on the RESPONSE layer** (e.g. a
  CMS's upload response-header hook, 200/304/206 only) — NEVER via a route-layer header
  rule, which decorates 404s and pins them publicly at the CDN. Not `immutable` if any
  path can rewrite the same filename (e.g. crop re-uploads). Public caching is coupled
  to public read access — restricting access later means removing the cache header.
- **Anything that writes objects per-save must delete what it supersedes** — with
  filename-pattern + reference-check guards, run OUTSIDE the save transaction (some CMS
  local APIs throw inside the caller's transaction and kill it while still returning
  200). Cap upload sizes globally.
- **Client callers of workers:** one fetch per human action, hard timeout, NO retry
  loops, dedupe at the sender. A retry storm from installed clients is a self-DDoS.

## 4. Session checklist when touching Cloudflare

1. Read this playbook (and any project billing notes) if unfamiliar.
2. `npx wrangler whoami` — confirm the account before deploying anything.
3. Grep the project for new bindings (`wrangler.toml`: kv/d1/r2/queues/ai/crons/
   observability) — each new one needs rule 2.4 treatment.
4. After deploy: smoke-test the cheap-refusal path, and confirm the plan page still
   says Workers Free.
5. Deploys are outward-facing: the user's explicit go-ahead first, always.
