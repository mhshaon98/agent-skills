---
name: commissioning-logger
description: Use ONLY when explicitly asked to log/document/track a multi-step hands-on process (commissioning, wiring, network bring-up, setup, troubleshooting, runbooks) — "log this", "start a commissioning log", "write it up as we go". Keeps a log.md plus a Word doc with annotated screenshots.
---

# Commissioning / Activity Logger (general)

Maintain ONE authoritative, growing record of how something was done, so the finished
document is a repeatable "how we did it" another person could follow. Works for any
subject — not tied to one machine, vendor, or industry.

## Per-subject workspace
Each thing being logged gets its own folder. Ask the user for (or infer) a short
**subject slug** (e.g. `cl3000`, `network-bringup`, `press-pm`). Default location is a
`<Subject>_Log/` folder inside the current project/working folder; confirm or let the
user override. Create this layout on first use:

    <Subject>_Log/
      log.md                      # plain-text source of truth (append-first)
      <Subject>_StepByStep.docx   # generated deliverable
      screenshots/                # raw images the user drops in
      screenshots_annotated/      # generated, with arrows/boxes

## Every session
1. **At start**, read `log.md` (and any project handoff) so you know what's done.
2. **As the user works / pastes images / describes actions**, capture each discrete step:
   date-time, phase/section, the exact action, WHERE (menu path / tab / field / terminal),
   the value set, and the observed result. Record ONLY verified-working steps; mark
   anything unconfirmed **PENDING** — never assert an unverified step as done.
3. **Screenshots/photos**: pasted images are NOT saved to disk — ask the user to save each
   into `screenshots/`. Then run `scripts/annotate_screenshot.py` to draw boxes/arrows/
   labels on the exact control/item changed, output into `screenshots_annotated/`, and
   reference it in `log.md` as `![caption|w=NNN](screenshots_annotated/file.jpg)`
   (`w=` optional width in px; portraits ~380, screenshots ~620).
4. **Append to `log.md` first**, then rebuild the `.docx`:
   `node scripts/build_log_docx.js <Subject>_Log/log.md <Subject>_Log/<Subject>_StepByStep.docx`
   (the builder embeds any images referenced in the markdown). Keep the two in sync.
   If the doc is open in Word the write fails with EBUSY/EPERM — ask the user to close
   it, or write to a temp name and tell them.
5. **At session end**, update `log.md` and note progress in the project handoff.

## log.md format the builder understands
- `# Title` (first H1 = document title), `## Section`, `### Subsection`
- `- bullet` items; blank line = paragraph break; `**bold**` inline
- Leading status tokens are colorized: `[DONE]`, `[PENDING]`, `[EXPECTED]`, `[FAIL]`
- Images: `![caption|w=380](screenshots_annotated/03_pair.jpg)`
- Simple pipe tables: a header row `| a | b |` then `| --- | --- |` then rows

## Accuracy rules
- Never invent UI labels or values — if something isn't visible/confirmed, write
  "(confirm on screen)". Distinguish diagnostic steps from final configuration.
- Capture identifiers exactly (serial numbers, IPs, part numbers, channel mappings).

## Annotation helper
`scripts/annotate_screenshot.py INPUT OUT --box "x,y,w,h,color,label" --arrow "x1,y1,x2,y2,color" --label "x,y,color,text"`
(pixels on the input image; multiple allowed; needs Pillow — `pip install pillow`).
Zoom into the saved screenshot first (Read the image) to get pixel coordinates right;
re-check the annotated output visually before embedding it.

## Environment / first-run bootstrap (any machine)
- **Node deps**: the docx builder needs the `docx` package. If
  `scripts/node_modules` is missing, run `npm install` once in
  `~/.claude/skills/commissioning-logger/scripts/`. Always invoke the builder
  by absolute path to `scripts/build_log_docx.js` so it resolves its own deps from
  any working folder.
- **Python**: needs Pillow. `python3` is normally fine; if Pillow is missing the
  script prints the install command. On Windows, beware that a bare `python` on PATH
  may be the Microsoft Store stub, which fails silently — point at a real interpreter.

## Handoff obligation
Reference this logger in the project handoff so future sessions keep it going.
