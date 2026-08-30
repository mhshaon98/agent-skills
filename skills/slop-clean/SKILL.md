---
name: slop-clean
description: Deep-dive sweep of the current project for AI slop, in design and in copy. Only runs when the user explicitly invokes /slop-clean; never self-trigger.
disable-model-invocation: true
---

# Slop Clean — find and remove AI slop, project-wide

A cleanup pass, **not a redesign**: functionality, information architecture, and
deliberate exact-idiom UI decisions stay intact. Users treat exact visual idioms as
deliberate choices — "liquid glass" is not one thing, and two implementations a
reviewer calls identical are not interchangeable — so "don't regress" notes in handoffs
are binding. The job is to find everything that makes the project read as AI-generated
(visual defaults and written tells) and bring it in line with the project's own design
language.

## Step 0 — load the authorities

1. **Your design doctrine**, if you have one — a design-system skill, a brand
   guideline, or the project's own `DESIGN-SYSTEM.md`. Everything this sweep changes is
   expressed in *that* vocabulary; this skill supplies the method, not the values.
2. **Run a deterministic linter first, before reading anything by eye**, if you have
   one wired up. Banned fonts, purple gradients, `h-screen`, `user-scalable=no`,
   em-dashes, gradient text-clip and emoji are cheap to detect mechanically and are
   non-negotiable fixes; softer warnings seed the inventory below.
3. **Brand binding**: check the project's `DESIGN-SYSTEM.md`, `CLAUDE.md`, or newest
   handoff for a bound design language. If one is bound, it governs every fix and is
   never mixed with another. If no binding, match the project's own established
   tokens — don't import a brand into someone else's project.

## Step 1 — deterministic sweep first (code, not AI)

Beyond what a linter already caught, pre-filter with grep/glob over source, styles,
and copy (`.tsx/.jsx/.vue/.svelte/.html/.css/.md`, i18n/string files, marketing
pages). Build a findings inventory — file:line, category, severity — before judging
anything by eye.

**Text/copy slop markers** (grep, case-insensitive): `delve`, `leverage`, `seamless`,
`elevate`, `unlock`, `empower`, `supercharge`, `game-chang`, `cutting-edge`,
`revolutioniz`, `effortless`, `robust`, `unleash`, `dive into`, `in today's`,
`look no further`, `it's not just`, `takes? .* to the next level`, `🚀`, `✨`, `💡`,
`elevate your`, `journey`, `crafted with`, `lorem ipsum`. Plus by reading: em-dash
overuse, exclamation-heavy filler, triads of vague benefits, headings that describe
nothing, placeholder copy that shipped, tone inconsistent with the product's register.

**Design slop markers**: AI-purple/indigo gradients (`from-purple`, `violet-600`,
mesh/aurora backgrounds), centered-hero-over-dark-mesh, three-equal-feature-cards,
gratuitous glassmorphism (`backdrop-blur` everywhere), infinite-loop micro-animations,
default `Inter` + `slate-900` identity, emoji used as icons, uniform `rounded-xl` +
`shadow-md` card soup, low-contrast muted-gray body text (<4.5:1), font pairs that are
similar-but-not-identical, tokens the project has since retired, dead `_v2`/duplicate
component files.

A grep hit is a **candidate**, not a verdict — a word like "journey" can be earned in
context. The shortlist gets judged against the loaded doctrine; scope creep beyond
slop (feature ideas, refactors) goes to the handoff, not into this pass.

## Step 2 — report, then fix

Present the inventory grouped **Design / Copy**, ordered by severity, with the
one-line doctrine rule each finding violates. Then fix in place:

- Mechanical fixes (banned words, contrast bumps, retired tokens, dead duplicates,
  placeholder copy) — just do them, matching existing style.
- Judgment calls (rewriting a hero's voice, replacing a whole visual motif, anything
  a reasonable person could call a redesign) — **flag and confirm with the user first**;
  batch these into one question, don't drip.
- Copy rewrites keep meaning and register; say less, not more. Design fixes go through
  the project's existing tokens/components — no new design system smuggled in.
- Large projects: delegate the bulk grep-triage or per-page fix batches to cheaper-tier
  subagents per the `spawn-agent` gate; keep judgment in-session.

## Step 3 — verify and close

Per `verify-work`: render every touched surface in **both themes and a mobile width**
(browser automation / screenshots); if you cannot render it, say
**"NOT-VERIFIED: could not render"** in those words rather than claiming done. Re-run
the linter and re-grep the marker list to confirm zero regressions, run the
project's build/tests if present, and report an honest Verified / NOT-verified ledger. Log the pass in the handoff (`update-handoff`) with
the findings count, what was fixed, and what was flagged-not-fixed.
