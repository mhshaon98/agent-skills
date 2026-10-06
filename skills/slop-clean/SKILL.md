---
name: slop-clean
description: Project-wide sweep that removes heavy AI slop from design and copy while keeping deliberate, evidenced creative choices (bold colour, density, texture, voice). Manual only (/slop-clean [path]); never self-trigger.
disable-model-invocation: true
---

# Slop Clean: remove heavy slop, keep the taste

A cleanup pass, **not a redesign and not a flattening**. Functionality, information
architecture and deliberate exact-idiom UI decisions stay intact: users treat exact
visual idioms as deliberate choices ("liquid glass" is not one thing, and two
implementations a reviewer calls identical are not interchangeable), so "don't regress"
notes in handoffs are binding. `/slop-clean <path>` scopes the sweep to that path; in a
monorepo resolve the design system and brand binding per package.

**What slop is.** Slop is an *unauthored default*, not boldness. Good taste is
commitment, not minimalism: loud, dense, dark, worn and austere work can all be good
when one decisive thing reads at a glance inside a rich scene. What fails is the
**generic** (template look, stock imagery, one hue smeared everywhere, decoration with no
author) and the **weightless** (thin, grey, small, empty). This pass removes the generic
and never produces the weightless.

**Both failure modes are rejected.** (1) Leaving the template look because it is
"clean". (2) Over-cleaning: stripping colour, texture, motion and voice until the result
is a pale centred column of small grey text. A cleanup that leaves a surface blander
than before is a regression even when every grep hit is gone.

**Precedence.** The user's explicit words > the project's DESIGN-SYSTEM.md / bound
design language > your design doctrine (if you keep one) > this skill.

## Step 0: authorities, linter, before-captures

1. **Your design doctrine**, if you have one (a design-system skill, a brand guideline,
   the project's `DESIGN-SYSTEM.md`). Fixes are expressed in *that* vocabulary; this
   skill supplies the method, not the values.
2. **Run a deterministic linter first**, if you have one wired up, before reading
   anything by eye. Its hard errors feed the hard list in Step 2; its warnings seed the
   inventory.
3. **Brand binding**: if the project binds a design language, it governs every fix and is
   never mixed with another. No binding → match the project's own tokens; never import a
   brand into someone else's project.
4. **Idioms the user asked for**: grep handoffs, DESIGN-SYSTEM.md and the bug ledger for
   "don't regress", "keep", and idiom names before classifying anything.
5. **Before-captures**: screenshot every surface in scope now (both themes and one mobile
   width where the platform has them), before any edit, for Step 4.

**Stack coverage.** Web: `.tsx/.jsx/.ts/.js/.vue/.svelte/.html/.css/.scss` + i18n files.
SwiftUI: `.swift`, `Localizable.strings`, `.xcstrings`. WPF: `.xaml`, `.resx`.
Android: `res/values/strings.xml`. Office/PDF: extract the text first.
**No renderable UI → copy mode**: skip linter, renders and the comparison review; verify
by diff and reading.

## Step 1: deterministic sweep (code, not AI)

Grep user-facing strings and styles only. Exclude handoffs, bug ledgers, changelogs,
licences, `node_modules`, `dist`, `build`, `vendor*`, lockfiles, generated files, and code
identifiers or comments.

**Copy markers** (case-insensitive): `delve`, `leverage`, `seamless`, `elevate`,
`unlock`, `empower`, `supercharge`, `game-chang`, `cutting-edge`, `revolutioniz`,
`effortless`, `robust`, `unleash`, `dive into`, `in today's`, `look no further`,
`it's not just`, `takes? .* to the next level`, `elevate your`, `journey`, `crafted
with`, `lorem ipsum`, emoji, em-dashes in visible text. By reading: exclamation filler,
triads of vague benefits, headings that describe nothing, shipped placeholders.

**Design markers**: AI-purple/indigo gradients and mesh/aurora washes behind text,
centred hero over dark mesh + logo row, three equal feature cards, glass on content cards
or stacked glass, decorative infinite loops, an untouched default `Inter` + `slate-900`
identity, emoji as icons, uniform `rounded-xl` + `shadow-md` card soup, coloured glows,
gradient or glossy controls, grey body text under 4.5:1, near-identical font pairs,
cut-outs with no shared light, retired tokens, dead `_v2`/duplicate files.

## Step 2: classify every hit

**Hard list: always fix, never keep.** Linter hard errors; the accessibility floor
(contrast, focus, zoom, paste, labels, reduced motion); and whatever your doctrine bans
outright. The only exception: the user explicitly asked for that exact thing in this
project, quoted with where they said it. Everything else goes into the buckets below.

**Register first.** Expressive surfaces (hero, landing, onboarding, empty states, store
art) can carry decoration; utility surfaces (settings, forms, lists, tables, editors) are
judged by plain control and type rules, and "keep" covers only the product's committed
idiom and idioms the user asked for.

**Authored needs evidence.** An item is authored only with one of: (a) the user's words
naming it (handoff, DESIGN-SYSTEM.md, bug ledger, commit message), (b) a bound
brand-language file specifying it, or (c) a written spec it meets (palette hexes, face,
composition). In an AI-built project the agent wrote everything, so "it looks
intentional" is not evidence.

- **Fix** if ANY holds: on the hard list; template-identical (would look the same in any
  AI-made project); or it carries no product meaning and nothing breaks without it.
- **Keep** only with evidence of authorship. Examples that usually qualify when
  evidenced: a saturated full-bleed ground, a dense catalogue layout, grain or texture, a
  characterful face set large, a single loud accent, motion that explains state, copy
  with real voice (voice is kept; emoji and em-dashes are not part of voice).
- **Strengthen** (proposal only): the intent is evidenced but the execution is default (an
  unlit cut-out, a timid accent, type at ordinary sizes, an empty region left by a safe
  zone). List it with one concrete spec; execute only on the user's pick. Never generate
  new imagery or scenes in a cleanup pass.
- **Unsure** → it goes in the batched question as "keep?", never silently into Kept.

Subtraction test per decorative element: *what breaks if it goes?* Nothing → remove,
unless removing it leaves the surface bare; then propose more scene as a strengthen item
instead of stripping.

## Step 3: report, then fix

Present the inventory grouped **Design / Copy**: each line with its bucket, the rule
behind it, and for Kept items the evidence. Then:

- **Hard-list and mechanical fixes** (filler words, contrast, retired tokens, dead
  duplicates, placeholders, glow and gloss on controls): do them, matching the existing
  style and register.
- **One batched question** for everything that needs the user: "keep?" items, strengthen
  proposals, and any motif or voice replacement on an expressive surface. For a
  replacement give one recommended direction plus one alternative, each with a concrete
  spec (palette, face, composition).
- Copy rewrites keep meaning, register and personality; cut filler, not voice. Design
  fixes go through the project's existing tokens and components.
- Large projects: delegate grep triage or per-page fix batches to cheaper-tier subagents
  per the `spawn-agent` gate; keep the bucket judgements in-session.

## Step 4: verify, including the creativity check, and close

Per `verify-work`: render every touched surface **after**, matching the Step 0 captures;
no render → write **"NOT-VERIFIED: could not render"**. For expressive surfaces, give a
fresh-context subagent the before and after screenshots and no account of your
intentions, and ask: which is more generic, did the after lose its heaviest thing, its
colour commitment or its voice, and did it remove something that was clearly default?
If the after is **blander**, revert or propose a strengthen item for that change;
hard-list fixes are never reverted. Re-run the linter, re-grep the markers, run the build
and tests, and report an honest Verified / NOT-verified ledger. Log the pass in the
handoff (`update-handoff`): findings count, fixed, kept (with evidence), asked, not fixed.
