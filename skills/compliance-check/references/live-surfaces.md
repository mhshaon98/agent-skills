# Live-surface check catalog

Each check: **what to read**, **how**, **pass**, **typical failure seen**, **close-out**.
Record the retrieval date for every live read. Commands are examples; adapt ids.

---

## S1. Store listing as published

**Read:** live version, release date, minimum OS, storefront availability, full
description, What's New.

**How (Apple, no auth):**
```bash
curl -s "https://itunes.apple.com/lookup?id=<APP_ID>&country=us" | python3 -m json.tool | head -60
for c in us gb de fr ca au jp in br; do printf "%s " $c; curl -s "https://itunes.apple.com/lookup?id=<APP_ID>&country=$c" | python3 -c "import sys,json;print(json.load(sys.stdin)['resultCount'])"; done
```
Google Play: read the public listing page; Data Safety section is on the same page.

**Pass:**
- The version you are about to submit is NOT already live (App Store Connect rejects a
  new build under a released version string).
- Any storefront in the EU/EEA/UK makes GDPR / UK GDPR apply: the privacy policy must
  carry controller, legal bases, rights, transfers, retention, and the complaint route.
- Auto-renewable subscription: the description itself (not only the paywall) carries the
  EULA link, privacy policy link, price, billing period, and auto-renewal / cancellation
  terms (Guideline 3.1.2; omitting these from the description is a known rejection cause).
- Any policy the law says must be linked from the "homepage" of an app (WA consumer
  health data) is linked in the description.

**Seen:** session notes carried "build N is the candidate" for weeks after that build went live;
EU availability never checked, so the GDPR gap was invisible.

**Close-out:** bump the marketing version; draft description edits into the release
checklist (the description changes only with a new version).

---

## S2. Store privacy labels / Data Safety

**Read:** every declared data type with linked / tracking / purposes.

**How:** App Store Connect > app > App Privacy (browser; owner must be signed in). Read the
page text; the "Edit" wizard lists every type with checkboxes. Play Console > App content >
Data safety.

**Pass:** every type the code sends off the device to the developer or a third party is
declared (name, email, message text, images, user id, device id, purchase status,
diagnostics like device model and OS version). Data that stays on the device or in the
user's own private cloud container, never received by the developer, is not "collected"
for label purposes.

**Map from code:** grep every network send (support/chat payloads, push registration,
analytics, crash reporters, purchase status attached to requests). Each field maps to a
label type.

**Seen:** label declared 5 types; the chat send attached name, device model, OS version,
subscription status and an owner id, so Customer Support, User ID, Device ID and Other
Diagnostic Data were missing.

**Close-out (Apple):** App Privacy > Data Types > Edit > tick types > Publish, then "Set Up"
each new type: purpose (App Functionality, and others only if true), linked yes/no,
tracking yes/no > Publish. Label edits go live immediately, without a new version.
Confirm with the owner before publishing (outward-facing). Verify by reloading the page
and reading the type list.

---

## S3. Binary disclosures

**Read:** `PrivacyInfo.xcprivacy` in the app AND every extension, `Info.plist` purpose
strings, entitlements of the exported build.

**How:**
```bash
plutil -lint App/PrivacyInfo.xcprivacy Widget/PrivacyInfo.xcprivacy
grep -rn "UserDefaults(suiteName\|activeInputModes\|systemUptime\|attributesOfFileSystem\|creationDate" --include=*.swift .
codesign -d --entitlements :- "<path>.app" | grep -A1 aps-environment
```
Confirm manifests are inside the BUILT `.app` and `.appex`, not only in source.

**Pass:** every required-reason API used has a declared reason in the target that uses it
(App Group defaults need `1C8F.1` in both app and widget; active keyboards `54BD.1`);
`aps-environment` resolves to production in the export.

---

## S4. Published policy pages and their links

**Read:** the served text of each policy; where each is linked.

**How:**
```bash
curl -s https://<site>/<policy-path> | grep -o "Last updated[^<]*\|Effective date[^<]*"
curl -s https://<site>/<policy-path> | grep -ci "legal basis\|controller\|retention\|transfer"
curl -s https://<site>/ | grep -o 'href="/<health-policy-path>"'
```
For client-rendered pages the text sits in the RSC payload; grep still finds it.

**Pass:**
- The page states what the code does (five-way comparison in app-audit
  `domains-compliance.md` 1.1) and the retention sentence matches the job (S6).
- Required links exist in every required place: site root, every page that collects
  personal information (forms), the store listing, and inside the app's settings.
- In-app links point at live 200 URLs (the uptime template checks them).

**Seen:** GDPR content absent although EU storefronts; a consumer health data section
drafted inside the general policy (Washington AG reads the Act as requiring a separate,
distinct page with nothing unrelated on it).

**Close-out:** write the change in the website repo, `tsc` + production build, show the
owner, publish only on a yes, then verify the live text with curl. Commit only the files
you changed; never sweep up unrelated uncommitted files in that repo.

---

## S5. Deployed backend matches the repository

**Read (Supabase example, all read-only):**
```sql
select policyname, cmd, roles from pg_policies where tablename = '<table>';
select p.oid::regprocedure, p.prosecdef,
       has_function_privilege('anon', p.oid, 'execute') anon,
       has_function_privilege('authenticated', p.oid, 'execute') authd
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' order by 1;
select extname, extversion from pg_extension;
```
Plus: edge function list with versions (MCP `list_edge_functions` or the dashboard),
`get_edge_function` source vs repo file, and the security + performance advisors.

**Pass:**
- No "transitional" or legacy policy still live after the clients that needed it are gone
  (prove with the live client's code at its release tag and recent direct-insert counts).
- SECURITY DEFINER maintenance functions are not executable by anon/authenticated.
- Deployed function source equals repo source (diff it; version numbers alone prove nothing).
- Unauthenticated POST to each function returns 401.

**Seen:** a transitional insert policy bypassing rate limits months after the last client
needing it; two functions deployed from older source than the repo.

---

## S6. Retention jobs as scheduled

See `retention-and-deletion.md` for the full method. Minimum read:
```sql
select jobid, jobname, schedule, command, active from cron.job;
select jobid, status, return_message, start_time from cron.job_run_details order by start_time desc limit 20;
```
**Pass:** a job exists for every published retention sentence, its unit/trigger/scope match
the sentence word for word, it runs at least daily for a "N days after" promise, it covers
stored files as well as rows, and its last runs succeeded. Compute and record the earliest
date any data can qualify.

---

## S7. Account deletion as experienced

**Read:** UI copy before and after deletion; client handling of each server response;
server response contract (ok, failures, skipped/forbidden semantics).

**Pass:** the UI never implies online data was removed when the server skipped or refused
part of it; partial failures keep a retry job; the path for "never used the feature" does
not produce a false warning. Retained anti-abuse records are disclosed
in the policy.

---

## S8. Consent and notice surfaces

**Read:** screenshots on a simulator or device: first-use notices, settings rows linking
policies, permission prompts only after a user action.

**Pass:** each notice appears where the law or policy says, is acknowledged by an affirmative
action when consent is the basis, persists its acknowledgement across relaunch, and resets on
account deletion. Settings contains a link to every policy that must be linked "within the
application". Verify on screen; a compile is not verification.

---

## S9. Ops floor

| Item | How | Pass / record |
|---|---|---|
| Backups, PITR | backend console > Database > Backups | record plan and yes/no; "no backups" is an owner-accepted risk with a manual-dump mitigation |
| Max rows / API caps | Data API settings | record the cap; client lists must order newest-first under it |
| Members + MFA | org Team page, account Security page | record; never enable MFA for the owner |
| Alerting / uptime | `.github/workflows/` or a provider | scheduled check exists and last run is green |
| CI on the release candidate | `gh run list --branch <branch> --limit 3` | green on the exact SHA to archive |
| Branch protection | `gh api repos/<o>/<r>/rulesets` and `.../branches/<b>/protection` | deletion + force-push blocked on shipping branches (owner may need to create it in the UI) |
| Dead CI jobs | read the workflow | a PR-only job in a repo that never opens PRs is dead; remove it |

---

## S10. Processor contracts and region

**Read:** the vendor's legal documents page in the console (e.g. Supabase Organization >
Legal Documents) and the project region.

**Pass:** a DPA is in force (some vendors incorporate it into their terms, "no separate
signature needed"; record that exact statement and date); the transfer mechanism for EU/UK
data (SCCs + UK Addendum) is named in the policy when the region is outside the EEA/UK.
