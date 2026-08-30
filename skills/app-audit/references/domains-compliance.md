# Compliance Module Catalog

> Domain knowledge for the compliance side of `/app-audit` — an automated
> technical and disclosure compliance-assistance system. Nothing here establishes
> legal compliance, and no finding, report line, or agent output may claim that it
> does. Findings describe **what the code does**, **what the disclosures say**, and
> **where those two disagree**.
>
> Read with `discovery.md` (the data-flow model and processor inventory are the
> inputs to nearly every module below) and `research-policy.md` (authority order,
> freshness windows, adversarial source checking).

## How to use this catalog

1. Every module below gets a router classification from `discovery.md` §6:
   `APPLIES` | `POSSIBLY_APPLIES` | `NOT_APPLICABLE` | `INSUFFICIENT_EVIDENCE`.
   Deep-investigate the first two only.
2. Findings use the schema in `schemas/finding.schema.json` with the `module` id
   given in each section heading.
3. **Legal research is mandatory and fresh** for every time-sensitive compliance
   finding. This catalog is a *starting point*, never the citation. Cite primary
   authority, verify current status and effective date, and record it in the source
   registry.
4. **Uncertainty never becomes PASS.** Missing business facts produce `UNKNOWN`
   with `applicability.facts_required[]`, batched for the user.
5. Read the **False-Positive Principles** at the end of this file before writing
   any compliance finding. They bind routing, severity, and status.

---

# 1. Privacy and data disclosure

## 1.1 `compliance.privacy` — Privacy policy vs actual behavior

The core compliance test of the whole system: **compare what the code actually
does against every place the project describes what it does.**

### The five-way comparison (required)

Run the comparison across all five surfaces. Anything missing from a surface is
itself an input, not an excuse to skip the comparison.

| # | Surface | Source |
|---|---|---|
| 1 | **Actual data map** | the data-flow model from `discovery.md` §3 — the ground truth |
| 2 | **Privacy policy** | the shipped policy text (repo, route, or hosted page) |
| 3 | **Cookie disclosure** | cookie banner text, cookie policy, consent-tool category config |
| 4 | **App Store disclosures** | Apple privacy "nutrition label" declarations |
| 5 | **Play Data Safety** | Google Play Data Safety form declarations |

Compare **category by category**, using the data-flow model as the spine: for each
data category, what does each of the five surfaces say about collection, purpose,
sharing, retention, and deletion?

### Mismatch hunt list

Hunt each of these explicitly — they are the recurring failure shapes:

- **Undisclosed data** — a category the code collects that no surface mentions.
- **Undisclosed processors** — a third party receiving personal data that appears in
  no disclosure (analytics, session replay, error tracking, support widgets,
  messaging providers, ad pixels).
- **False "we do not collect" statements** — the policy denies collecting something
  the code demonstrably collects (IP addresses, device identifiers, precise
  location, analytics events, uploaded file contents).
- **Retention mismatch** — the policy states a retention period that no code or
  configuration implements, or implements differently.
- **Deletion mismatch** — the policy promises deletion the deletion path does not
  achieve (see §1.7).
- **AI processor omission** — prompts, transcripts, or uploaded content are sent to
  an AI provider and no disclosure names AI processing or the provider. This is the
  single most common omission in current projects.
- **Tracking mismatch** — the cookie disclosure lists fewer trackers than actually
  fire, or categorizes advertising trackers as "necessary".
- **Store mismatch** — App Store labels or Play Data Safety declare less collection
  or sharing than the code performs, or omit a linked-to-identity flag.

### Evidence standard

A privacy finding cites **both sides**: the code evidence (`file:line`, network
call, table) *and* the disclosure evidence (the quoted policy line or the declared
store category). A one-sided finding is not yet a finding.

Where a disclosure surface does not exist at all (no privacy policy, no store
listing), the finding is about the absence — scoped to whether that surface is
required for this project, which is a research question, not an assumption.

## 1.2 `compliance.caloppa` — CalOPPA

Evaluated **separately from CCPA** — different statute, different trigger, different
obligations. Never fold it into a CCPA conclusion, and never let a CCPA
`NOT_APPLICABLE` suppress a CalOPPA analysis.

Investigate: whether a conspicuous privacy policy is posted and reachable; policy
contents against the statute's enumerated elements; the effective/revision date;
how changes are announced; how the site responds to Do Not Track signals and
whether that response is disclosed; disclosure of third parties collecting
personally identifiable information across sites.

Research the current statutory text and any amendments before citing.

## 1.3 `compliance.ccpa` — CCPA/CPRA

### Applicability discipline (the rule that gets broken most)

- **A California user accessing the app does not, by itself, make CCPA apply.**
  Applicability turns on *business* facts about the entity, not on where a visitor
  sits.
- **Research the current thresholds** — revenue, consumer/household volume, and
  revenue-share-from-selling-or-sharing tests are amended over time. Never cite
  remembered numbers; verify against the current statutory text and CPPA regulations
  and record them in the source registry with `effective_date` and `status`.
- **If the deciding business facts are unavailable from the repository, the result
  is `UNKNOWN`** with `applicability.facts_required[]` listing the exact facts
  needed — for example: annual gross revenue; number of California consumers,
  households, or devices whose personal information is processed; whether personal
  information is sold or shared and what share of revenue that represents; the legal
  entity and its corporate affiliates. Do not guess in either direction, do not
  infer applicability from having a California-reachable website, and do not infer
  non-applicability from the project being small.
- Only when applicability is `APPLIES` (or `POSSIBLY_APPLIES` pending one fact) do
  you investigate the substantive obligations: notice at collection, categories
  disclosed, right-to-know/delete/correct request mechanisms and their actual
  implementation, opt-out of sale/sharing and its plumbing, the required links,
  sensitive-personal-information limits, service-provider vs third-party contract
  posture, non-discrimination, and authorized-agent handling.
- Where obligations *are* investigated, test the mechanism, not the page. A
  "Do Not Sell or Share" link that sets no signal and reaches no processor is a
  technical finding regardless of the legal question.

## 1.4 `compliance.cookies-tracking` — Cookies, trackers, consent

### Inventory first

Inventory every one of: cookies (first- and third-party, with names, purposes,
durations), advertising and conversion pixels, analytics SDKs, ad-network SDKs,
session replay, persistent identifiers (device IDs, advertising IDs, user IDs,
anonymous IDs), `localStorage`/`sessionStorage`/IndexedDB writes, and
fingerprinting signals (canvas/WebGL/font/audio enumeration, high-entropy client
hints).

For each: what sets it, when it is set relative to consent, what it transmits, and
which consent category it is assigned to by the consent tool.

### Behavioral testing (required — never PASS from UI text)

**Never mark a consent control PASS because the banner says the right thing.**
Test the behavior at the network and script level:

| Path | What must be verified |
|---|---|
| **Accept All** | which requests/scripts fire; do they match the declared categories? |
| **Reject All** | do non-essential trackers stop firing? Are cookies actually not set, or set anyway? |
| **Custom / per-category** | does each toggle map to the trackers it claims? Do rejected categories stay silent? |
| **Withdraw consent** | after previously accepting, does withdrawal stop new collection *and* is the earlier state cleared as described? |
| **GPC (Global Privacy Control)** | see §1.5 |

Verification is **network requests, script execution, and storage writes observed
directly** — not banner copy, not the consent tool's own dashboard, not a comment
in the code. Where a live browser test is not available, say so: the status is
`UNKNOWN` (or a code-evidence finding about initialization order), never a PASS.

The classic true positive: a tracker initialized at module import or in the root
layout, so it fires **before** the banner renders and regardless of the choice made.
Look for initialization order, not just the presence of a guard.

## 1.5 `compliance.gpc` — Global Privacy Control

Check whether the app reads `navigator.globalPrivacyControl` and the `Sec-GPC`
request header at all, what it does when the signal is present, whether that
behavior is disclosed, and whether the response persists across sessions and
subdomains.

Verify behaviorally, same rule as §1.4: send the signal and observe whether
tracker behavior changes at the network level. A code path that reads GPC but
never reaches the tracker initialization is a finding.

Research the current legal status and required response before asserting any
obligation — GPC requirements have moved and continue to move.

## 1.6 `compliance.data-retention` — Retention

Compare stated retention (privacy policy, terms, support docs) with implemented
retention: TTLs, cron/cleanup jobs, log retention settings, backup retention,
analytics-provider retention configuration, soft-delete rows that never age out,
cache and CDN retention, and AI-provider retention settings for submitted content.

A stated period with no implementing mechanism is a mismatch finding. No stated
period *and* no mechanism is typically `REVIEW` plus an `UNKNOWN` for the intended
policy — retention *intent* is a business fact only the user can supply.

## 1.7 `compliance.account-deletion` — Account deletion

### Trace the full chain

```
UI control → endpoint → authenticated identity check → primary DB record
→ related records (FKs, join tables, audit rows) → object storage
→ user content → AI history / prompts / transcripts → third parties
```

At each hop record what is actually removed, what is retained, and the evidence.
Also check: the confirmation and re-authentication flow, what happens to active
sessions/tokens, exports and backups, analytics identity, email/marketing lists,
payment-processor customer records, and whether deletion is reachable at all from
the product (a support-email-only path is a finding to evaluate against platform
and legal requirements).

### Deactivation masquerade

**Detect deactivation masquerading as deletion.** A flow labeled "delete my
account" that only flips `is_active = false`, sets `deleted_at`, anonymizes the
display name, or disables login while retaining the personal data is *not* deletion
— and if the product or policy calls it deletion, that is a disclosure mismatch as
well as a technical finding. Read the handler, not the button label.

### Partial-fix rule

**Partial fixes do not PASS.** If deletion covers the primary table but leaves
storage objects behind, or clears one storage prefix while other user-owned prefixes
remain, or removes the app-side record while the AI transcript and the analytics
profile persist — the finding stays open. It PASSes only when **all user-owned
storage and all recorded destinations in the data-flow model are covered.** The
same rule applies in `verify` mode: re-check every hop, not the one that was fixed.

## 1.8 `compliance.user-upload-deletion` — User-upload deletion

Uploads get their own module because they fail separately from account deletion.

Trace: does deleting an item in the UI delete the object, or only the database row
pointing at it? Are thumbnails, derived/transcoded variants, and CDN copies removed?
Are signed URLs still valid after deletion? Do orphaned objects accumulate? Is
bulk deletion (account closure) covering every prefix the upload code can write to,
including historical prefixes from earlier schema versions?

Enumerate write paths from the code — every place an object key is constructed —
and confirm the deletion path covers each one.

---

# 2. Platform and store

## 2.1 `compliance.apple-app-store` — Apple App Store

`NOT_APPLICABLE` unless there is evidence of an iOS/macOS target or store presence.

When it applies, investigate against **current official Apple Developer policy**
(fresh research; platform policies use the 30-day freshness window): privacy
nutrition-label accuracy against the actual data map, `Info.plist` purpose strings
against actual permission use, App Tracking Transparency where identifiers are used
for tracking, account-deletion-in-app requirements, sign-in requirements where
third-party login is offered, in-app-purchase rules for digital goods, subscription
disclosure requirements, kids-category rules if applicable, data-collection SDK
disclosure, and required-reason API usage where relevant.

Cite the specific guideline section and record its `last_verified` date.

## 2.2 `compliance.google-play` — Google Play

`NOT_APPLICABLE` unless there is evidence of an Android target or Play presence.

When it applies, investigate against **current official Google Play Developer
policy**: Data Safety form accuracy against the actual data map (collection,
sharing, encryption-in-transit, deletion-request availability), declared
permissions in `AndroidManifest.xml` against actual use, sensitive-permission
policies, the account-deletion requirement (including the off-app deletion URL),
families/child-directed policy, ads and advertising-ID policy, and SDK disclosure
requirements.

Play and Apple disagree on details — record conflicts rather than merging them.

---

# 3. Money

## 3.1 `compliance.subscriptions` — Subscriptions

### Checklist (investigate each)

| Item | What to verify |
|---|---|
| **Price disclosure** | is the actual charged amount presented clearly before consent, at the point of consent? |
| **Frequency** | is the billing interval disclosed with the price, not in a footnote? |
| **Trial conversion** | when and at what price does a trial convert; is that stated before signup; does the code match the stated terms? |
| **Affirmative consent** | is there an explicit, separate action consenting to the recurring charge — not a pre-ticked box or a bundled acceptance? |
| **Cancellation** | can a subscriber cancel through the same channel they subscribed in; how many steps; does the code actually cancel or merely queue a request? |
| **Renewal notices** | are pre-renewal notices sent where required; is there code that sends them? |
| **Annual notices** | for long-term/annual terms, are periodic reminders implemented? |
| **Price changes** | how are increases communicated and consented to; does the code re-consent or silently re-price? |
| **Refund consistency** | see §3.4 |

Test the cancellation path behaviorally where possible: does the entitlement
actually end, does the processor subscription actually cancel, and does the UI tell
the truth about the end date?

### Never apply vacated or outdated rules

**Before citing any subscription or negative-option rule, verify its current
status.** Rules in this area are amended, delayed, enjoined, and vacated. The
FTC "click-to-cancel" / negative-option rule is the canonical example: **verify its
current status before citing it** — do not assert it as binding from memory, and do
not assert it is dead from memory either. Search explicitly for *vacated*,
*stayed*, *enjoined*, *effective date*, *compliance deadline*, *amended*,
*superseded*, and record `status` (`CURRENT` | `UPCOMING` | `SUPERSEDED` |
`VACATED` | `REPEALED` | `UNDER_CHALLENGE` | `UNKNOWN`) in the source registry.

If status cannot be established, the finding is `UNKNOWN` with the conflict
documented — never a confident citation of a rule that may not be in force, and
never a silent drop of a rule that may be.

State-level automatic-renewal laws are separate authorities with their own status;
check them separately rather than treating "the FTC rule" as the whole field.

## 3.2 `compliance.auto-renewal` — Auto-renewal mechanics

The technical counterpart of §3.1: does the code auto-renew, on what schedule, with
what notice, and is the renewal behavior identical to what the UI and terms
describe? Check trial-to-paid transitions, grace periods, dunning, involuntary
churn handling, and whether a "cancel" sets `cancel_at_period_end` while the UI
says the subscription ended immediately (or vice versa).

## 3.3 `compliance.billing` — Billing disclosure and accuracy

Amounts charged vs amounts displayed; currency and tax presentation; proration on
plan change; what appears on the statement descriptor; invoices/receipts issued;
whether the app is the source of truth for entitlements or the processor is (see
`domains-production.md` payments modules for the reliability side).

## 3.4 `compliance.refund-consistency` — Refund consistency

Compare the refund policy text, the store-level refund rules (Apple/Play handle
their own refunds), the processor configuration, the in-app messaging, and what the
code actually does. Inconsistency between a stated refund window and the
implemented one is a finding; a policy promising refunds through a channel the code
does not implement is a finding.

---

# 4. AI-related compliance

> Technical AI review lives in `domains-ai.md`. These three modules cover the
> *disclosure and claims* side and cross-reference it.

## 4.1 `compliance.ai-data-privacy` — AI data privacy

What personal data reaches the model provider (prompts, system context, retrieved
documents, uploaded files, transcripts)? Is that transmission disclosed in the
privacy policy and store declarations? What is the provider's retention and
training posture for this account/endpoint, and is the app configured accordingly?
Is there PII minimization or redaction before transmission? Are transcripts stored,
and are they covered by the deletion path (§1.7)?

Cross-reference: an AI processor missing from disclosures is a §1.1 privacy finding
as well.

## 4.2 `compliance.ai-disclosure` — AI disclosure

Is the user told they are interacting with, or being processed by, an AI system —
where that matters (chat surfaces, generated content, automated evaluation of the
user)? Is generated content labeled where required? Is there a human-contact path
where one is required?

Research current obligations by jurisdiction and surface type; requirements here
are new and moving, so use a short freshness window and record effective dates.

## 4.3 `compliance.ai-marketing-claims` — AI marketing claims

Cross-reference marketing copy against the implementation (this is a joint module
with `domains-ai.md` and §6.1 below). Hunt: claims of accuracy, "hallucination-free",
percentage performance claims, "trained on your data" vs actual behavior, claims of
human review that no code performs, claims about which model powers the product,
security/privacy claims about AI processing, and autonomy claims ("fully
autonomous") that the implementation does not support.

An unsupported claim is a finding about **the gap between claim and
implementation**, with both sides evidenced. Where the truth of a claim depends on
facts outside the repo (a vendor contract, an internal review process), it is
`REVIEW` or `UNKNOWN` with `facts_required`, not an accusation.

## 4.4 `compliance.california-companion-chatbots` — California companion chatbots

Applicability is **evidence-driven and narrow**. The presence of an AI dependency,
an LLM API call, or even a chat interface does **not** make a product a companion
chatbot (see False-Positive Principle 2). Establish against the current statutory
definition: is the system designed to sustain ongoing social/relational
interaction, does it maintain persona and relationship continuity, is it directed
at or accessible to minors, and what are the actual product framing and marketing?

If the definition's deciding elements cannot be settled from the repo, classify
`POSSIBLY_APPLIES` and resolve with the cheapest decisive evidence (product copy,
persona prompts, memory features), or record `UNKNOWN` with `facts_required`.

When it does apply, research the current obligations — disclosure, minor-specific
protections, crisis-response handling, reporting — from primary authority with
effective dates, since this area is new.

## 4.5 `compliance.automated-decision-making` — Automated decision-making

Does the system make or materially inform decisions about a person (eligibility,
pricing, ranking that affects access, moderation/suspension, credit, employment,
insurance)? Is there disclosure, an explanation path, human review, opt-out, or
appeal where required?

Distinguish decisions *about people* from ordinary product logic — a recommendation
carousel is not an eligibility decision. Establish which before invoking the module.

---

# 5. Children

## 5.1 `compliance.children-coppa` — Children and COPPA

### Evidence list (all of it, not just the terms)

**"Terms say 13+" does not end the analysis.** Gather and weigh:

- **Audience evidence** — who the product is actually for, per marketing copy, app
  description, store category, and screenshots
- **Branding and design** — cartoon/child-oriented visual language, mascots,
  simplified language, reward mechanics aimed at children
- **Age gating** — is there any gate, is it neutral, is it bypassable, is it
  enforced server-side or only in the UI
- **Date of birth** — collected? verified? used to gate anything? stored?
- **Store age category** — declared rating and target-age settings
- **Content** — subject matter, characters, difficulty, themes
- **Trackers** — third-party analytics/ad SDKs firing in child-accessible contexts
- **Sensitive capabilities** — location, camera, microphone, contacts access
- **Persistent identifiers** — device/advertising IDs, cookies, anonymous IDs tied
  to a child-accessible surface (persistent identifiers are themselves personal
  information under COPPA)

### Discipline

Weigh the *totality*: a 13+ term of service alongside cartoon branding, a kids
store category, and ad SDKs is not a resolved question. Conversely, an app with
adult-only subject matter and no child-directed signals routes `NOT_APPLICABLE`
with that evidence recorded.

Where applicability is genuinely open, `POSSIBLY_APPLIES` plus `facts_required`
(actual audience data, store settings, marketing intent) — not a guess. Research
current COPPA rule text and FTC guidance, including recent amendments, before
citing obligations (notice, verifiable parental consent, data minimization,
retention limits, disclosure restrictions, ad-targeting limits).

---

# 6. Content, claims, and contracts

## 6.1 `compliance.reviews-testimonials` — Reviews and testimonials

### Locate

Reviews, star ratings, quoted customer testimonials, customer/partner logos, usage
numbers ("10,000 teams"), statistics and performance claims, endorsements and
influencer content, "as seen in" placements, and AI-capability claims.

### Discipline — REVIEW, not fraud

**Unknown authenticity → `REVIEW`, never a fraud finding.** The audit can establish
that a testimonial exists, that it is presented as a real customer statement, and
that the repository contains no evidence of provenance. It **cannot** establish
that it is fake. Write the finding as: what is displayed, what disclosure
obligations attach if it is not a genuine unpaid customer statement, and what fact
would resolve it (`facts_required`: is this a real customer? was compensation or
free product provided? is the person an employee or affiliate? is the statistic
substantiated and current?).

Placeholder/lorem testimonials shipped in production, or logos used without any
relationship evidence, are worth flagging as `REVIEW` with the same discipline.

Where a *claim* is objectively checkable against the code (e.g. "SOC 2 certified",
"end-to-end encrypted", "we never store your data") and the code contradicts it,
that is a stronger finding — cite both sides.

## 6.2 `compliance.ugc` — User-generated content

Investigate: moderation (automated, human, none), reporting/flagging mechanisms,
blocking and muting, appeal paths, terms governing content, the license the terms
take in user content (see §6.6), age-related handling, and how quickly reported
content can be removed technically.

**UGC does not create automatic liability** (Principle 5). The module documents
what mechanisms exist and which are absent relative to researched obligations and
platform requirements — not a presumption that hosting content is a violation.

## 6.3 `compliance.take-it-down-act` — TAKE IT DOWN Act

Applies where the product hosts user-uploaded imagery or media that could depict
identifiable people. Research the current statutory requirements and effective /
compliance dates (this is recent law — short freshness window, verify status).

Investigate whether the product provides: a reachable notice-and-removal request
mechanism for non-consensual intimate imagery, the required removal timeframe
handling, removal of known copies/derivatives (thumbnails, transcodes, CDN caches
— cross-reference §1.8), and the required notice content.

Absence of a mechanism where the Act applies is a technical finding about the
missing mechanism; whether the Act applies is a research question with an
evidenced answer.

## 6.4 `compliance.copyright` — Copyright

Investigate: third-party assets in the repository (images, fonts, icons, audio,
video, code snippets) and whether licensing evidence exists; open-source license
obligations from the dependency inventory (attribution, notice files, copyleft
implications for distributed code); AI-generated asset provenance; and marketing
use of third-party trademarks and logos.

**Unknown provenance is not infringement** (Principle 6). An asset with no license
record produces a `REVIEW` finding naming the asset and the missing evidence, with
`facts_required` (where did this come from, what license). Never assert
infringement from absence of a license file.

## 6.5 `compliance.dmca` — DMCA safe harbor procedure

Applies where the service hosts third-party content. Investigate the presence and
correctness of the safe-harbor procedure: a designated agent and whether
registration is claimed, published contact/notice instructions, a takedown
mechanism that actually removes content, counter-notice handling, a
repeat-infringer policy that exists in more than name, and whether the terms
reference the procedure.

Cite the U.S. Copyright Office as primary authority for agent registration
requirements. Missing elements are technical/disclosure findings; do not
characterize the service's safe-harbor status as lost — that is a legal conclusion
outside the system's remit.

## 6.6 `compliance.terms-contracts` — Terms and contracts

Audit the Terms of Service / EULA / customer agreement for internal consistency,
consistency with the product's actual behavior (a term promising 30-day data export
that no code implements is a finding), presence of required consumer disclosures,
governing-law/venue coherence with the audience, and clarity of the subscription
terms (cross-reference §3.1).

### HUMAN_REVIEW by default — never silently added or changed

The following clauses are **`HUMAN_REVIEW` by default**, are **never**
auto-fixed, drafted, inserted, strengthened, or reworded by the system, and appear
in the report's *Compliance Review Queue* rather than as remediation steps:

- Arbitration clauses
- Class-action waivers
- Jury-trial waivers
- Indemnification obligations
- Limitation-of-liability caps
- Governing law
- Venue / forum selection
- Broad intellectual-property assignment
- Broad user-generated-content licenses

The system may **observe** that such a clause is present, absent, unusual, or
inconsistent with the product's behavior, and may flag it for a lawyer. It may
never write or alter one. This mirrors the `PROHIBITED_AUTOFIX` list in
`fix-safety.md`; where the two are read together, the stricter reading governs.

---

# 7. Module index

| # | Module id | Router notes |
|---|---|---|
| 1 | `compliance.privacy` | applies wherever any personal data is collected |
| 2 | `compliance.caloppa` | separate from CCPA — always evaluated on its own |
| 3 | `compliance.ccpa` | applicability is a business-facts question, not a traffic question |
| 4 | `compliance.cookies-tracking` | requires behavioral verification |
| 5 | `compliance.gpc` | requires behavioral verification |
| 6 | `compliance.data-retention` | intent is often a user-only fact |
| 7 | `compliance.account-deletion` | trace the full chain; partial fixes do not PASS |
| 8 | `compliance.user-upload-deletion` | separate from account deletion |
| 9 | `compliance.apple-app-store` | N/A without an Apple target |
| 10 | `compliance.google-play` | N/A without an Android target |
| 11 | `compliance.subscriptions` | verify rule status before citing |
| 12 | `compliance.auto-renewal` | technical counterpart of subscriptions |
| 13 | `compliance.billing` | disclosure accuracy of charges |
| 14 | `compliance.refund-consistency` | policy vs store vs processor vs code |
| 15 | `compliance.ai-data-privacy` | cross-references `domains-ai.md` |
| 16 | `compliance.ai-disclosure` | new, fast-moving — short freshness window |
| 17 | `compliance.ai-marketing-claims` | claim vs implementation, both sides evidenced |
| 18 | `compliance.california-companion-chatbots` | narrow; AI presence alone never triggers it |
| 19 | `compliance.automated-decision-making` | decisions about people, not product logic |
| 20 | `compliance.children-coppa` | totality of evidence; terms alone never settle it |
| 21 | `compliance.reviews-testimonials` | unknown authenticity → REVIEW |
| 22 | `compliance.ugc` | mechanisms present/absent, not presumed liability |
| 23 | `compliance.take-it-down-act` | recent law — verify status and dates |
| 24 | `compliance.copyright` | unknown provenance → REVIEW |
| 25 | `compliance.dmca` | applies to third-party-hosted content |
| 26 | `compliance.terms-contracts` | listed clauses are HUMAN_REVIEW by default |

---

# False-Positive Principles

> **Verbatim and binding.** These apply to every module in this catalog, to the
> production and AI catalogs, to the domain router, and to severity assignment. A
> finding that violates one of these principles is withdrawn or downgraded, not
> defended. The adversarial reviewer checks findings against this list explicitly.

1. **public bucket ≠ vulnerability**
2. **AI dependency ≠ companion chatbot**
3. **California access ≠ CCPA applicability**
4. **testimonial ≠ fake review**
5. **UGC ≠ automatic liability**
6. **unknown copyright provenance ≠ infringement**
7. **monolith ≠ bad**
8. **microservices ≠ good**
9. **no Kubernetes ≠ immature**
10. **no Redis ≠ scaling failure**
11. **few tests ≠ automatically unsafe**
12. **AI-written code ≠ insecure**

Corollary that binds equally hard in the other direction: **a wrong PASS is worse
than a false-positive FAIL.** These principles justify downgrading a finding to
`REVIEW`/`UNKNOWN` or establishing `NOT_APPLICABLE` with evidence. They never
justify skipping the investigation, and they never convert an unexamined area into
a PASS.
