---
name: deepen
description: Before planning a substantial build, redesign, feature, research question or subagent brief, answer four questions (what a top professional would add, the rawest source, their methods, what outside check proves it right) and rewrite the brief to ask for exactly that. Deeper, not bigger; the outside checks become verify-work's done-criteria.
---

# Deepen: the four-question pass before planning

A request arrives already digested: phrased from memory, scoped to what the asker could
picture, judged by "looks fine". Answering it as written gets a competent version of the
shallow task. This pass asks what a top professional in the field would actually do, then
rewrites the brief so the work aims there from the first step.

**The goal is a deeper task, not a bigger one.** Deeper = better inputs, sharper methods,
done-criteria that something other than you can check. Bigger = more features, more pages,
more agents. If the rewritten brief is mostly longer, redo it.

## When it fires (the size test)

Run it when ANY of these is true:
- the work spans more than one session, or more than ~5 files, or a new route/screen/module;
- it is a redesign, a new feature, a new product surface or a new pipeline;
- it is a research question whose answer will drive a decision;
- you are about to write a brief for a subagent doing substantial work (`spawn-agent`);
- "done" is hard to state in one observable sentence.

Do NOT run it for: one-line fixes, a bug with a known cause, lookups, renames, config
tweaks, quick questions, or anything you would finish in under ~15 minutes. Running it
there is ceremony.

**Light mode** (medium tasks: a few files, one session): four one-liners, no rewrite block.
**Full mode** (anything multi-session, a redesign, or a brief for a costly agent run):
the full blocks below.

## The four questions

### Q1. What would a top professional in this field do here that wasn't asked for?
Name the field first (product designer, data engineer, security reviewer, editor), then
the specific moves that person makes by default. Good answers are concrete practices:
"start from the user's top tasks, not the screen list", "model the objects before the
visuals", "write a parity ledger before deleting the old version", "design the empty,
loading and error states".
- Anti-example: "follow best practices", "make it scalable", "ensure good UX". Generic
  padding is not an answer; if a line would fit any project, cut it.
- Anti-example: new features. A top professional adds rigour, not surface area.

### Q2. What is the rawest material they would start from?
Name the concrete sources, by path, table, endpoint, URL or person, that sit upstream
of every summary: the database tables, the API's actual JSON, the log lines, the spec,
the competitor's real screens captured fresh, the user's own list of what they do.
- The current UI, a handoff, memory, a previous plan and your own recollection are
  DIGESTED material. Read them for orientation, never as the source of truth.
- Anti-example: "the existing code" or "relevant docs". If you cannot name the file,
  table or URL, you have not answered Q2.

### Q3. Which specific methods and tools would they use?
Name techniques and tools by name: object-oriented UX, a top-task list, a manifest that
generates the nav, fixtures shaped like real data, contract tests, a design review
against named references, axe, Lighthouse, `tsc`, a scripted SQL reconciliation.
Prefer a tool that already exists in the project or this repo over a new dependency.
- Anti-example: "use modern tooling", "write tests". Say which tests, against what.

### Q4. What, other than the agent or the user, would show the result is right?
List checks that can actually run: a script that compares every figure to the raw source,
a test suite, a linter, axe, a build, a click-count on the top tasks, a fresh-context
reviewer agent (a design evaluator, `app-audit-security-reviewer`, `pre-release-review`),
a real user trying it.
- Every Q4 line must name WHAT runs and WHAT result counts as a pass.
- Anti-example: "review it carefully", "looks right", "test thoroughly". Your own
  judgment and the user's eyeball are not on this list; they come after it.

## Output

Full mode writes two blocks (into the plan file for multi-session work, otherwise in chat):

```
## Deepening pass
Q1 (a top <field> would also): <3-8 concrete practices>
Q2 (rawest material): <named tables / endpoints / files / screenshots / people>
Q3 (methods and tools): <named techniques and tools>
Q4 (outside checks): <check -> pass condition, one per line>

## Brief, rewritten
<the task restated so it asks for exactly the above: inputs first, structure, look or
behaviour, then "Done means: <the Q4 checks>". Ask-before items last.>
```

Light mode writes only `Q1:` to `Q4:` as one line each, then proceeds.

## What happens next

- **Q4 becomes the definition of done.** Copy the Q4 checks into the plan's done-criteria
  and into any subagent brief's DEFINITION OF DONE. At the end, `verify-work` reports each
  one in the ledger: Verified (ran it, here is the output) or NOT verified (and why).
  A Q4 check that silently disappears between the plan and the handoff is a failure.
- **Q1 additions are proposals, not silent scope.** Fold cheap, reversible rigour (empty
  states, a parity ledger, fixtures) straight into the brief. Anything costly, slow,
  irreversible, outward-facing, or that changes what the user asked for goes to them as ONE
  question with your recommendation, and the work proceeds on the original scope until
  they answer.
- **Q2 gaps become first steps.** If the raw material is not yet in hand (screenshots to
  capture, a list only the user can give), the rewritten brief starts by getting it, and
  says so; draft a best guess for them to correct rather than asking an open question.
- **Delegation.** When the brief goes to a subagent, Q2 fills "Read first" with the raw
  sources and Q4 fills "Definition of done" (`spawn-agent`).

## Worked example (condensed)

Request: "Redesign the admin console from scratch; sidebar app switcher; shared modules
on one page."

```
## Deepening pass
Q1 (a top product designer would also): list the 8-12 jobs the owner opens the console
   for and derive nav from them; model apps x modules before visuals, a shared module
   is ONE canonical URL; a needs-attention home; app, module and range live in the URL;
   a command palette; every number shows freshness and source; empty/error/"not
   configured" states designed; a parity ledger of the old console before deleting it;
   works on a phone.
Q2 (rawest material): the database tables behind each module; each app's dashboard
   endpoint JSON; each data pipeline's raw output; fresh screenshots of the two
   reference dashboards the owner actually uses; the owner's own list of which pages
   they open and why. Not the current UI, not this plan's summary.
Q3 (methods and tools): top-task list -> apps x modules matrix -> one registry manifest
   that generates sidebar, palette and breadcrumbs; framework routes per app/module plus
   a shared route; keep the working data fetchers and auth, scrap the UI layer; fixtures
   for every source; a design review against the reference screenshots.
Q4 (outside checks): scripted comparison of every figure to the raw JSON/SQL for a fixed
   range -> all equal; parity ledger -> every item kept, moved or cut; top tasks -> each
   <=2 clicks from home (counted); fresh-context design evaluator vs
   reference screenshots -> pass;
   security reviewer -> every route checks the session, 2FA unchanged; axe, tsc, build,
   tests -> clean; 375 px render -> no horizontal scroll.

## Brief, rewritten
Rebuild the console UI from the ground up, keeping only the data fetchers and sign-in.
Before visuals: draft the top-task list (owner corrects it), build the apps x modules
matrix from the real sources, write the parity ledger. Structure: sidebar with app
switcher; shared modules are one page linked from every app they belong to; URL holds
state; palette jumps anywhere. Show 2-3 rendered directions built from the reference
screenshots; owner picks one. Done means: <the Q4 list>. Ask before pushing.
```

Note what did NOT happen: no new product features were added. The rewrite changed the
inputs (real sources, real screenshots, the owner's own task list), the method (a
manifest instead of hand-wired nav) and the finish line (six runnable checks).
