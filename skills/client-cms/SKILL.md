---
name: client-cms
description: Analyze the current website project and intelligently add a secure, client-facing content-management/admin system so authorized nontechnical users can update approved website content without editing source code. Use when the user invokes /client-cms, asks to add an admin panel/dashboard for site content, or wants website content editable by a client/business owner.
---

# Client CMS — a safe content layer for client-managed websites

Core conceptual model, always:

**Authorized admin edits approved content → content is stored in an appropriate
persistence/content layer → the live public website consumes and displays it.**

A Postgres-backed admin dashboard is ONE valid instance of this pattern — never a
mandate. **The architecture follows the project, not the other way around.** This
skill states the capability, constraints, and outcome; you (the executing model) are
the architect and decide the best technical implementation for THIS website. Treat it
as an end-to-end engineering task — public site, admin UI, persistence, auth, and
content flow must actually work together — not "generate an admin page".

## Phase 0 — Inspect before deciding (mandatory, no shortcuts)

Understand the project before proposing anything. Do not decide from filenames or a
glance at the tree. Establish at minimum:

- Framework/language, rendering model (static, SSR/SSG, SPA, hybrid), frontend
  architecture, backend (if any), database (if any).
- Authentication system (if any), hosting/deployment target, existing APIs.
- **Existing CMS or content system** — if one exists (headless CMS, content
  collections, markdown/frontmatter content, admin routes), extending it is the
  default; adding a second content system needs strong justification.
- Project structure and conventions, design system/components, how content is
  currently stored and rendered, any existing admin capabilities.
- Security/infrastructure constraints that shape the design.

If the stack, platform, or deployment system has current best practices you are not
certain of, research them (web search/docs) before committing to an architecture.

Two edge cases, handled here and not later: if the project is **not a public-facing
website at all** (CLI tool, pipeline, library), stop and confirm with the user before
proceeding — never force a content layer onto a non-web project. If a **partial or
broken admin/CMS already exists** (half-built earlier, abandoned mid-way), assess its
state and decide extend / repair / replace with stated justification — never assume
greenfield.

## Phase 1 — Content inventory (judgment, not a mechanical sweep)

Identify what a nontechnical business owner would reasonably manage: headings, hero
copy, paragraphs, images/media, FAQs, testimonials, announcements, business/contact
info, hours, social links, pricing, services, team members, news/blog, promotions,
CTAs, repeated homepage sections — *examples, not a checklist*.

- **Client-editable:** business-managed copy, media, and repeatable content items.
- **Developer-controlled (never exposed):** layout system, routes, application
  logic, styling/design tokens, infrastructure, source code, anything whose edit
  could break the site.

Do NOT turn every value into editable content. Produce a short grouped inventory and
scale scope to the site: a small marketing site gets a lightweight editor; a
content-heavy site gets a more structured system.

**Checkpoint — confirm before building.** Present the inventory and the proposed
architecture (Phase 2) to the user and get scope confirmed before implementing. This
operation adds auth and rewires a live website's read paths — it is not built
autonomously off a silent plan.

## Phase 2 — Architecture (let the site pick the stack)

Choose storage and delivery from what exists and where it deploys. The option space
spans (non-exhaustive): JSON/markdown flat files committed or written at runtime,
SQLite, the project's existing database, a hosted backend (e.g. Supabase/Firebase),
server actions/API routes, a traditional framework's own admin scaffolding
(WordPress/Rails/Django-style), or an existing headless CMS. Decision drivers:

- **Reuse first.** Existing DB/auth/API/CMS beats new infrastructure. Introduce new
  infrastructure only when nothing suitable exists, and pick the lightest thing the
  hosting environment supports (a static host with no runtime may need a build-time
  or hosted content source; an SSR app can read at request time).
- **One content module.** All reads AND writes go through a single content
  layer/module with defined shapes — not scattered fetches. This is also what keeps
  the door open for future automations/AI agents updating approved content through a
  safe API instead of source edits. Don't build that API speculatively; just don't
  architect it away.
- **Fallbacks.** Public pages must render sensibly if the content layer is empty or
  unreachable (seed data / build-time defaults), and rendering must remain
  visually identical to today.
- **Static/client-only targets.** Writes still go through a server/serverless
  function or a backend with server-enforced policies — the shipped client bundle is
  NEVER the authorization boundary, and admin/service-role keys never ship in it.

## Phase 3 — Auth, authorization, and security

Run the `security-pass` skill for this phase when available; its checklist applies in
full (secrets, keys, RLS/policies, live-backend advisors, re-run after fixes).

- Admin surface reachable only by authenticated, authorized users. Reuse the
  project's existing auth if present; otherwise add the simplest robust mechanism
  appropriate to the platform. Never invent home-rolled crypto/session schemes when
  the platform provides one.
- **Every write is authorized server-side** — including that the record being edited
  belongs to this admin's scope (never trust an ID from the client). Client-side
  route hiding is not security. Validate and bound all input (types, lengths,
  allowed fields).
- **CSRF:** with cookie-based sessions, a valid session cookie is not sufficient
  authorization for a write — use the framework's CSRF tokens, or SameSite cookies
  plus origin checks, on every state-changing admin request.
- **Output-context encoding:** escape every content value for its actual sink —
  HTML, attribute, URL, JS, JSON-LD — not just the rich-text field (which gets XSS
  sanitization). Validate URL-type fields to http/https/mailto so a "link" field
  can't carry `javascript:`/`data:`.
- **Media uploads:** validate by content signature, not extension; bound size;
  disallow or sanitize/rasterize SVG and HTML (they execute script when served from
  the app origin); store outside the source tree or in platform storage; never trust
  filenames; serve user media with non-executable content types. If media can be
  added by URL and the server fetches it, that is SSRF-sensitive — restrict schemes
  and block private/link-local ranges.
- Secrets in env/config, never committed; rate-limit or otherwise protect the login
  surface. Do not weaken any existing security posture to make content editable.

## Phase 4 — Admin experience

Simple enough for a nontechnical employee: plain text fields by default, rich text
only where the content needs it, image/media pickers, repeatable items with
add/remove/reorder, appropriate validation, clear save/publish affordance, preview
where feasible (behind the same authorization as the editor — draft content must not
leak), and confirmation (or soft-delete/versioning) guarding destructive actions. Match the project's design system where reasonable, but clarity and
usability for the content manager win over visual cleverness. If you have a
design-system skill, admin UI styling runs under it.

**Optional higher tier — on-site inline ("live") editing.** When the stack already
supports a draft/preview mode plus server-side auth (a headless CMS with draft mode, an
SSR app with sessions), a strong admin experience is letting staff edit approved copy
IN PLACE on the real page, not only in a separate dashboard. Proven pattern:

- **Entry point = a persistent staff bar, not a `?edit` URL trick.** Show logged-in
  staff a fixed bar on every page (identity, dashboard link, log out, edit-mode
  toggle). Detect the staff session CLIENT-side (a tiny probe endpoint) so the page
  layout never reads cookies/headers and public pages stay static/cacheable; the bar
  renders nothing for anonymous visitors. Add a "View site" link inside the dashboard
  too, so staff can reach the live site after logging in.
- **Double gate, server-enforced.** Edit mode is ON only when BOTH a draft/preview flag
  is set AND the request still carries a freshly re-verified staff session — never
  loosen to one. The client bundle is never the authorization boundary; the public
  build must be marker-free (code-split the editor out of it) and leak no PII.
- **Writes reuse the SAME content endpoints** as the dashboard (no parallel write path)
  so server-side auth, validation, sanitization, any auto-translate, and cache
  revalidation all come from Phase 2's single content module.
- **Inline-edit UX — each point learned from a real bug:** intercept only the click
  that ENTERS edit mode — never `preventDefault` a click inside an already-active
  field, or the user can't place the caret or drag-select; seed the caret from the
  pointer (`caretRangeFromPoint`/`caretPositionFromPoint`), not the end of the text;
  give the active field a distinct color and an explicit `caret-color` so the cursor is
  visible; provide Undo (toolbar button AND ⌘Z/Ctrl+Z sharing one path). Mark all
  editor chrome with an exclusion attribute so the overlay's own document-level click
  handler ignores its clicks.
- **Verify the editor's visual CSS by screenshot, not `getComputedStyle`** — an editor
  that re-wraps text spans via a MutationObserver makes computed-style reads on those
  spans return stale defaults even when the rule is applying.

## Phase 5 — Migration and data safety

`safe-data-write` rules apply (run that skill when available) — the site's current
copy and media are precious data.

- **Seed the content layer from the existing live content BEFORE switching any read
  path to it.** The site must never lose or blank its current copy/media because the
  new layer started empty.
- Additive over destructive; backup before any destructive operation; a rollback
  story (feature flag, revert path, or fallback rendering) before the cutover.
- **Ongoing admin writes fall under `safe-data-write` too, not just the migration:**
  version or soft-delete prior content and keep an audit trail of who changed what,
  so any edit is recoverable.

## Phase 6 — Verify end-to-end (before claiming done)

`verify-work` standard: verified means you ran it. Confirm the full loop:

1. Authorized admin edits content → change persists → public site reads and displays
   the new content correctly.
2. Unauthorized/unauthenticated access to admin routes and write endpoints is
   rejected (actually test it, server-side).
3. Public site is visually and behaviorally unchanged apart from content source —
   visitors cannot tell a CMS was introduced. Watch for subtle markup/whitespace
   diffs from round-tripping copy through the new layer (especially rich text).
4. Build/deploy still passes for the project's actual hosting target.

Keep an honest Verified / NOT-verified ledger; anything untested on the real
deployment target is NOT verified. If this ships to production, `pre-release-review`
is mandatory.

## Wrap-up

Record in the project's `CLAUDE.md`/handoff: the chosen architecture and why,
rejected alternatives, the content-layer module as an architectural invariant
("client content lives in X, edited only via Y — never hardcode it back"), and admin
credentials/setup steps for the site owner (never the secrets themselves).

## Guardrails (recap)

- No blind stack introduction; no forcing one CMS architecture on every site.
- No feature maximalism — implement the capability level this website needs.
- Preserve existing design, UX, and security. Change where content comes from, not
  how the site looks.
- Keep the implementation understandable for future developers and future Claude
  sessions.
