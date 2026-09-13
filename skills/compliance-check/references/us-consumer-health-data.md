# US consumer health data (Washington, Nevada, Connecticut)

**Last verified: 2026-09-12** by `app-audit-legal-researcher` against primary sources, for
a body-tracking consumer app. **Freshness window: 90 days.** If today is past 2026-12-11, or the app's facts
differ, re-run the legal researcher with the questions in section 6 before relying on
anything below. Not legal advice; items marked COUNSEL need a lawyer.

## 1. When this applies

Any app or site that handles information that could identify a consumer's past, present
or future physical or mental health status: body measurements and weight, fitness, symptoms,
conditions, medications, reproductive or sexual health, biometric data, "wellness" data,
AND free text or images a user volunteers (support chat).

- **Washington My Health My Data Act, RCW 19.373** (effective 2024-03-31; small businesses
  2024-06-30). No revenue or volume threshold. "Collect" includes "access, ... infer,
  derive, or otherwise process". Applies to entities doing business in WA or targeting WA
  consumers.
- **Nevada, NRS 603A.400 to 603A.550 (SB 370, 2023)**, effective 2024-03-31. Consumer
  health data is data the entity "uses to identify" health status (NRS 603A.430), which may
  be narrower than WA.
- **Connecticut Data Privacy Act as amended by PA 25-113 (SB 1295)**: from 2026-07-01
  applies to anyone processing sensitive data, no volume threshold; consumer health data
  provisions (42-526) had no threshold before that. Primary text was NOT retrievable on
  2026-09-12 (cga.ct.gov certificate failure); relied on the CT AG summary page.

"It stays on the device" does not settle applicability: whether on-device processing by
the developer's software counts as collecting is unresolved (COUNSEL). Write the policy
so it is true either way ("processed only on your device ... we never receive, see, or
store them").

## 2. The policy page (required elements)

Publish as a **separate page** (WA AG FAQ: "a separate and distinct link on the regulated
entity's homepage and may not contain additional information not required under the My
Health My Data Act"). Put general-privacy items (for example Connecticut's statements) in
the general policy, and link between the two.

| # | Element | Source |
|---|---|---|
| 1 | Categories of consumer health data collected and the purposes, including how used | RCW 19.373.020(1)(a)(i); NRS 603A.495(1)(a) |
| 2 | Categories of sources | RCW 19.373.020(1)(a)(ii); NRS 603A.495(1)(b) |
| 3 | Categories shared, and the third parties and specific affiliates shared with | RCW 19.373.020(1)(a)(iii)-(iv); NRS 603A.495(1)(c)-(d) |
| 4 | How the data is processed | NRS 603A.495(1)(f) |
| 5 | How to exercise rights (access/confirm, delete, withdraw consent) | RCW 19.373.020(1)(a)(v), .040 |
| 6 | How to review and request correction | NRS 603A.495(1)(h) |
| 7 | How material changes are notified | NRS 603A.495(1)(i) |
| 8 | Whether third parties can collect health data over time and across sites/apps | NRS 603A.495(1)(j) |
| 9 | Effective date | NRS 603A.495(1)(k) |
| 10 | Retention, including offline-deletion behaviour and backups | accuracy; WA allows backups up to 6 months, NV up to 2 years |

**Processor wording:** WA excludes disclosure to a processor acting for the collection
purpose from "share" (RCW 19.373.010, requires the .060 contract). NV's definition of
"share" has no processor exclusion (NRS 603A.480) but allows disclosure necessary to
provide a requested service (NRS 603A.500(2)(b)). A safe sentence names the processor,
says WA does not treat it as sharing, and says NV may, and why it is necessary.

## 3. Response windows and appeals

- Answer requests within **45 days of receipt** (WA .040(1)(g)); one 45-day extension if
  the consumer is told why within the first 45 days. NV counts from authentication.
- **Nevada deletion: within 30 days** of authenticating (NRS 603A.515(1)). A single
  "45 days" promise is too long for NV deletions.
- **Appeal:** process required; answer in writing within 45 days (WA .040(1)(h), NV
  603A.520; CT allows 60). The Attorney General contact (WA: online mechanism
  `https://www.atg.wa.gov/file-complaint`; NV: contact information for the Office of the
  Attorney General; CT: `https://portal.ct.gov/ag/common/complaint-form-landing-page`) must
  be given **in the appeal-denial response**; it is not required on the page. A shorter page
  can say "we will tell you how to contact your state Attorney General" and keep the
  contacts in the operator's runbook. The NV complaint page URL was not confirmed; check
  before first use.

## 4. Where the link must appear

RCW 19.373.010(16) "homepage": the introductory page of the website AND any web page where
personal information is collected; for a mobile app, the app's platform (store) page or
download page AND a link within the app (configuration, about, information, or settings
page). In practice:

- site footer on every page (covers the root and every form page);
- the app's product page on the site;
- the App Store / Play description (goes in with the next version);
- a Settings row inside the app.

NV (NRS 603A.495(2)) accepts a hyperlink on the main website or a clear and conspicuous
equivalent.

## 5. Consent and notices

WA (RCW 19.373.030(1)(a)(ii)) and NV (603A.500(1)(b)) allow collection necessary to provide
a product or service the consumer requested; volunteered details used only to answer a
support request plausibly fit (MEDIUM confidence). Connecticut's no-threshold
sensitive-data consent rule may still bite (COUNSEL). Low-friction safe pattern: a one-time
notice before the first message that the user acknowledges with a tap:

> Only include health details, like measurements, conditions, or body photos, if you want
> <person> to use them to help you. Messages are deleted N days after your last one.
> [I understand]   Health data policy

Store the acknowledgement locally, reset it on account deletion, verify on screen.

Connecticut general-policy statements to include (from 2026-07-01, per the AG summary):
whether personal data trains large language models; no sale, targeted advertising, or
profiling (if true); the right to correct.

## 6. Re-verification brief (for the legal researcher)

Ask, with the app's facts: (1) required policy elements under current RCW 19.373, NRS 603A
and the CTDPA as amended; (2) response and deletion windows and the appeal rule; (3) whether
a processor disclosure is "sharing" in each; (4) the homepage/link requirement for apps;
(5) consent for volunteered chat content, including Connecticut's sensitive-data rule;
(6) any statement in the draft that over-promises. Require primary-source URLs, retrieval
dates, and a list of what could not be confirmed. Then run `app-audit-source-verifier` on
the citations before publishing.
