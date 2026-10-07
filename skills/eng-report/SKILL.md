---
name: eng-report
description: Apply an engineering house style (modelled on Rockwell, Siemens, ABB, Schneider and Endress+Hauser technical publications) to a Word, Markdown or PDF document, in the user's own logo and colours, with ANSI safety notices and document-control blocks. Use on "/eng-report", "make this a proper engineering report", or "format this like an automation vendor manual"; on first use it asks for the company's logo and brand colours.
---

# eng-report: engineering house style, in your own branding

Industrial-automation vendors share one document discipline: identity on every page,
a fixed front-matter order, ANSI signal-word safety notices placed before the step they
govern, decimal-numbered headings, tables over prose for anything comparable, and
procedures as one-action imperative steps. This skill applies that discipline in the
user's branding. The full rule set with sources is `references/house-rules.md`; how a
brand profile works is `references/brand.md`.

Needs Python with `python-docx` (`pip install python-docx`).

## Step 1: brand profile (first run: ask the user for it)

The engine reads a brand profile: `./.eng-report/brand.json` in the project, else
`~/.eng-report/brand.json`. Check before anything else:

```bash
ls ./.eng-report/brand.json ~/.eng-report/brand.json 2>/dev/null
```

**No profile found** means there is no company data to draw on. Do not guess a name, a
logo or colours, and do not borrow them from another project. Ask the user, in one
message:

1. **Company name** as it should print, and an optional tagline.
2. **Logo**: ask them to upload or point to the file. PNG or JPG; an SVG or PDF logo has
   to be exported to PNG first, because Word cannot embed it. A wide, transparent PNG at
   least 600 px across prints cleanly.
3. **Brand colours**: the accent colour as hex (rules, header line, cover band), and
   optionally a heading colour and a link colour. If they have a brand guideline PDF or a
   website, offer to read the colours from it and confirm what you found before saving.
4. **Scope**: this project only, or every project on this machine.

Then save it:

```bash
E="$HOME/.claude/skills/eng-report/scripts/eng_report.py"; PY=$(command -v python3 || command -v python)
"$PY" "$E" brand --company "Acme Controls" --tagline "Process Automation" \
      --logo path/to/logo.png --accent 1F4E79 [--head 1A1A1A] [--link 1F4E79] [--scope project|user]
```

(Installed somewhere other than `~/.claude/skills`? Adjust the path.)

- The user has no logo, or wants none: save the profile without `--logo`; the header and
  cover then set the company name in type. Re-running `brand` to change a colour keeps
  the stored logo; `--no-logo` removes it.
- The user wants an unbranded document: skip the profile and pass `--plain` in Step 4.
- An accent close to a safety colour (red, orange, yellow, safety blue) is allowed but
  say so once: the notice panels keep their ANSI colours and must stay distinguishable
  (`references/brand.md`).
- A profile exists: use it without asking again. Ask only if the document is clearly for
  a different organisation (a customer's template, a second company).

## Step 2: identify the document

- **Document type** decides the skeleton (`house-rules.md` §1): Test report (FAT, SAT,
  commissioning), Engineering memo, Manual / user guide / work instruction, Application
  note, Specification. Another type (a proposal, a quotation): agree the section order
  with the user first.
- **Identity fields**: title, document number, revision, date (Month YYYY), author,
  classification. Never invent a document number or revision: ask, or leave the field
  out.

## Step 3: fix the content to house rules (judgement, before the engine)

The engine restyles; it does not rewrite. Edit the text first, on a COPY, never the
original:

1. Put sections in the skeleton's order; add missing required sections as headed
   placeholders marked `[TO COMPLETE]`, never invented content (no made-up results,
   test values, names or document numbers).
2. Safety: every hazard becomes a DANGER / WARNING / CAUTION / NOTICE notice with hazard
   (bold title), consequence, avoidance, placed immediately before the step it governs;
   pick the level by the ANSI definition; when several apply, the highest wins.
3. Procedures: intro sentence, "Before you begin" list, numbered imperative steps (one
   action each, at most 20 words; `check` flags a step over 25), result line.
4. Units "24 V", "65 °C", SI first with imperial in parentheses, ranges "-25 to +70 °C";
   cross-references by number ("see section 3.2", "Table 4"), never "above/below".
5. Comparisons, specs, results and parameters go in tables; captions "Table N - Title"
   above tables, "Figure N - Title" below figures.
6. Plain engineering prose. No AI label blocks ("Bottom line", "Key takeaways", "Why it
   matters"), no emoji, no marketing adjectives; a memo opens with a prose paragraph.

## Step 4: run the engine

```bash
E="$HOME/.claude/skills/eng-report/scripts/eng_report.py"; PY=$(command -v python3 || command -v python)
"$PY" "$E" check  in.docx                                   # list rule problems first
"$PY" "$E" restyle in.docx out.docx --title "..." --doc-type "Test Report" \
      --doc-no TR-XXX-001 --rev A --date "October 2026" --author "..." [--cover] [--no-numbered] [--page a4|keep]
"$PY" "$E" build   in.md   out.docx                         # Markdown + front matter -> new document
```

- `restyle` keeps the content and replaces the look: Arial type scale, decimal heading
  numbering (typed numbers are stripped so they do not double), accent-rule headings,
  charcoal table headers that repeat across pages, notice panels from "WARNING: ..." /
  "Note: ..." paragraphs, logo header, footer with doc no | rev | date | classification
  and Page X of Y. `--cover` adds a cover page. Default page is US Letter; `--page a4`
  for A4, `--page keep` leaves the original size.
- `build` takes Markdown with front matter (`title`, `subtitle`, `doc_type`, `doc_no`,
  `rev`, `date`, `author`, `classification`), notices as `> **WARNING:** Hazard. Text`,
  pipe tables, `Table:` captions, and `[[revision-history]]`, `[[sign-off]]`,
  `[[page-break]]` blocks. Starters for a test report, a memo and a procedure:
  `references/templates.md`.
- `--brand-file other.json` uses a different profile for one run; `--plain` uses none.
- PDF input: extract the text, rebuild it as Markdown, then `build`.
- Restyling a document the engine already produced: pass `--no-cover`, or it gains a
  second cover page. Its notice panels are left as they are.
- The engine refuses to overwrite its input, and stops with `NO BRAND PROFILE` when there
  is none and `--plain` was not given: go back to Step 1 and ask.

## Step 5: verify, then stamp

1. Re-run `check` on the output; fix what it lists or say why not.
2. Render to PDF (Word, or `soffice --headless --convert-to pdf`) and look at every page:
   cover, logo size, notices, tables breaking across pages, footer fields updated. Not
   rendered: say NOT-VERIFIED.
3. Set author and company in the file properties and remove library fingerprints such as
   "python-docx" (the `doc-metadata` skill does this if it is installed).

## Files

- `scripts/eng_report.py`: brand / restyle / build / check engine (python-docx).
- `references/house-rules.md`: the rule set and skeletons, with vendor sources.
- `references/brand.md`: the brand profile, default palette, type and logo rules.
- `references/templates.md`: Markdown starters per document type.
