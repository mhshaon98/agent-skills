---
name: apply-richformat
description: Give any text-bearing surface (app screen, document, report, README, chat answer, CLI output, table) visible rank and separation. Use when building or reviewing one, or on "rich formatting", "text vomit", "needs better structure", "make this readable".
---

# Apply Rich Formatting

The same request comes back on project after project, in the same words: *"it looks
like someone vomited text"*, *"needs richer formatting and proper UI separation"*.
This skill exists so nobody has to ask.

**The standing instruction it encodes:** any surface you produce is formatted to the
standard a reviewer would ask for, the first time, without being prompted.

## The diagnosis — it is almost never density

The instinct is to blame the amount of text and start cutting. That is usually wrong,
and cutting real information to fix a layout problem makes the surface worse.

**The actual cause is undifferentiated rank.** A block reads as vomit when:

- every part of it has the same visual weight, and
- the gap between two *parts of one item* is the same as the gap between two
  *separate items*.

When those two boundaries look identical, the eye cannot find where one thing ends and
the next begins, so eight perfectly legible parts read as one wall. Fixing it means
establishing rank — not deleting content.

> Worked example. An optimizer finding was a title, a paragraph,
> a value pair, an evidence list, a tick list and an outcome, stacked at one indent with
> 2-8px between every part, and 1px between two findings. Nothing was too long. Adding
> one indent, turning the value pair into a labelled grid, and naming the sub-blocks
> fixed it without removing a single fact.

## Step 1 — name the medium out loud

The vocabulary is different in each, and using the wrong one is its own kind of slop.
State it in one line before you format anything.

| Medium | What "rich" means here |
|---|---|
| **App / UI surface** | Indent spines, hairline rules, labelled sub-blocks, definition grids, chips, per-row consequence notes. **Governed by the project's design system** — go to Step 2. |
| **Document / README / report** | Headings that carry rank, tables where there are 2+ dimensions, fenced code, callouts, short paragraphs, tight lists. |
| **Chat answer** | Bold *lead-ins* that name the claim, short paragraphs, lists only for genuinely parallel items, code fences for anything runnable. |
| **Terminal / CLI output** | Alignment and columns, a stable prefix per line kind, colour only where it encodes state and always with a word too. |
| **Data / table** | One row per record, one column per attribute, units in the header, numbers right-aligned and tabular. |

## Step 2 — obey the project's design system first (UI only)

**Never invent a visual language.** Before adding a single style, read in this order and
build only from what you find:

1. The project's `CLAUDE.md` or design doc — a bound design language beats everything
   else here.
2. Your own design-system skill or brand guideline, if you have one.
3. The project's own token file and existing component classes.

If the project has a locked language, this skill supplies the *method* and that
language supplies every *value*. Reach for an existing class before writing a new one.

## Step 3 — inventory the kinds of information

Before formatting, list the distinct KINDS in the blob. Most walls contain four to eight
and treat them all identically. Typical kinds:

- a **claim** (what is true, in prose)
- a **machine value** (path, pid, version, size, duration, setting)
- **evidence / citation** (what was measured, verbatim)
- a **choice** (something to tick, pick, or fill)
- a **consequence** (what this costs, what it changes)
- an **outcome** (what happened, after the fact)
- an **instruction** (what to do next)

## Step 4 — the seven moves

Apply what the inventory calls for. Each move exists to fix a specific failure.

1. **One treatment per kind, everywhere.** A machine value looks the same in every
   place a machine value appears. Inconsistency is what makes a surface feel improvised.
2. **A separation rank.** Gap between parts of an item **<** gap between items **<**
   gap between sections. If two of those are equal, the wall comes back. This is the
   single highest-value move.
3. **One left edge per item.** Everything below a heading hangs at one indent under it.
   That spine is what makes a tall block scannable.
4. **Pull machine values out of the prose.** `X becomes Y` mid-paragraph must be read;
   `Now: X` over `After: Y` can be *seen*. Labelled pairs and definition grids beat
   sentences for anything a reader compares.
5. **Name every sub-block.** An unlabelled list of values under a paragraph reads as
   more paragraph. A three-word caption ("What was measured", "Choose which ones") turns
   it into a citation the reader can skip or check. Sentence case and quiet — an
   uppercase tracked eyebrow on a sub-block is itself slop.
6. **Pair, never parallel.** If two lists must be read against each other, bind them
   structurally into one block per item. Two parallel lists whose lengths can diverge is
   a bug, not a layout: the reader is left inferring the mapping from position.
7. **Hold prose to a measure.** 65-75 characters. A 12px paragraph across a 1400px pane
   is ~190 characters a line and will read as filler however good the sentence is.

## Step 5 — the restraint gate (formatting is not decoration)

Rich means *legible structure*, not more ornament. Every one of these is a failure:

- **Formatting that encodes nothing.** Bold, a chip, a colour or a rule that marks no
  real distinction is noise. If you cannot say what a treatment *means*, delete it.
- **Bullets that destroy an argument.** Connected reasoning stays prose. Lists are for
  genuinely parallel items.
- **A table for one dimension.** Two columns of "Item / Description" is a list.
- **Nested cards, stacked shadows, coloured bars on any card edge** (top, side or
  bottom) — the single most-repeated slop finding there is.
- **Emoji in any user-facing output**, unless the user asks for it in that piece of work.
- **Em-dashes in user-facing copy.** Hyphens and math minus only.
- **State carried by colour alone.** Always a word too.
- **More than one signal-coloured fill per view**, counting persistent chrome.
- **Headings that describe the heading** ("Overview of the overview").

## Step 6 — verify by looking, not by reading the diff

- **UI:** render it. Screenshot both themes and a narrow width — browser automation, or
  the project's own dev command. A formatting task is never done from
  code review alone — a scrolling dialog that hides its own title and buttons looks
  perfect in the diff.
- **Document / chat:** reread it cold. Can you find the answer to the obvious question
  in under three seconds without reading a paragraph?
- **Terminal:** run it and look at the real column widths with real data.

Then state what you checked. If you could not render it, say so plainly rather than
implying you did.

## The one-line test

**Can a reader find the one thing they came for without reading anything they did not
come for?** If no, the formatting is not done yet.

## Interaction with other skills

- **Your design-system skill**, if you have one — it governs UI work and supplies the
  values. This skill is the formatting method underneath it, not a replacement for it.
- **`slop-clean`** — the project-wide retrospective sweep, invoked explicitly. This
  skill is what you apply *while building* so that sweep finds less.
- **`verify-work`** — Step 6 is that skill's ladder applied to formatting; "it looks
  right in the code" is not evidence.
