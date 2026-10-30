# House rules: how automation vendors write technical documents

Researched 2026-10-06 from real vendor PDFs: Rockwell 1756-UM001Q-EN-P / 1756-RM003Z /
1756-IN101L, Siemens SIMATIC IFP Basic A5E46178354-AD, ABB 2PAA110888-517, Schneider
EIO0000004254.00, Endress+Hauser BA01316D, Omron E346-E1-06, Emerson 00809-0100-4774;
Keyence from its web manual only; ANSI Z535.6 and ASD-STE100 from secondary sources.
This house style is a hybrid: Siemens numbering and legal order, ANSI four-level
notices (Siemens/Schneider/ABB/E+H/Keyence), Rockwell per-page identity, Endress+Hauser
procedure grammar.

## 1. Skeletons by document type

**Manual / user guide / work instruction**: Cover → Legal & disclaimer page (qualified
personnel, intended use, liability, trademarks, copyright) → Revision history → Contents
(to level 3) → Preface / About this document (purpose, audience, prerequisite knowledge,
scope with model or part numbers, conventions, related documents table) → 1 Safety →
2 Overview → Installation → Commissioning → Operation → Maintenance → Troubleshooting →
Technical data → Appendix A, B, C → Glossary / abbreviations.

**Test report (FAT / SAT / commissioning)**: Cover → Revision history + approval →
1 Summary (result in the first sentence: "passed 11 of 12 tests; 1 deviation open") →
2 Scope and objectives (included / excluded) → 3 References → 4 Equipment under test →
5 Method and acceptance criteria → 6 Results (Test ID | Description | Expected | Actual |
Pass/Fail | Deviation) → 7 Deviations and punch list (ID | Description | Severity | Owner |
Status | Disposition) → 8 Conclusions → 9 Sign-off (Role | Name | Company | Signature |
Date, supplier and customer witness) → Appendices (raw data, calibration certificates).

**Engineering memo**: header block (To / From / Date / Subject / Ref) or cover-less
title → prose opening paragraph stating purpose and the answer → Background → Findings
(tables for data) → Recommendation / actions (owner, date) → References. No label grids
at the top.

**Application note / technical note**: Cover → Summary → Applicable products (model
table) → Background → Solution / configuration (numbered procedures) → Results /
limitations → References.

**Specification**: Cover → Revision history → 1 Scope → 2 References and standards →
3 Definitions → 4 Requirements (numbered, one "shall" each, uniquely identified) →
5 Verification (requirement → method: inspection / test / analysis / demonstration) →
Appendices.

## 2. Document identity

1. The cover carries title, product or system, document type, document number, revision,
   date (Month YYYY) and organisation (all vendors).
2. Every page footer repeats document number, revision, date and Page X of Y (Rockwell,
   Siemens). The header repeats the title or chapter.
3. Document numbers follow one scheme per project (Rockwell `<family>-<TYPE><NNN><REV>`,
   Siemens `A5E…-AD`); the skill never invents one.
4. Revision history table: Rev | Date | Description of change | By, before the contents
   (Siemens preface "History", Rockwell "Summary of Changes").
5. Related documents: a two-column table, Resource | Description, each title followed by
   its document number (Rockwell "Additional Resources").

## 3. Safety notices (ANSI Z535.6 / ISO 3864)

6. Exactly four levels: **DANGER** (will result in death or serious injury), **WARNING**
   (could result in death or serious injury), **CAUTION** (could result in minor or
   moderate injury), **NOTICE** (property damage, not personal injury). Wording from
   Schneider/ABB; Siemens and E+H agree.
7. DANGER white on red, WARNING black on orange, CAUTION black on yellow, NOTICE white
   italic on blue. The alert triangle appears on the first three, never on NOTICE.
8. Each notice has three parts: hazard as a bold title, consequence, avoidance action
   (Siemens, Emerson, Rockwell all follow this).
9. A notice sits immediately before the step or paragraph it governs; a notice for a
   whole procedure goes before step 1 (Rockwell).
10. Several hazards in one place: use the highest level (Siemens rule).
11. Non-hazard information uses Note / Tip / Important in a neutral grey panel; never
    reuse a signal word for it.
12. Rockwell's set (WARNING = explosion hazard, ATTENTION, IMPORTANT) is only used when
    writing for a Rockwell-documented system and the customer asks for it.

## 4. Layout and typography

13. Decimal headings 1 / 1.1 / 1.1.1, appendices lettered A, B, C (Siemens, E+H).
14. Sentence-case headings (Siemens, Emerson) unless the customer template says Title Case.
15. Sans-serif body 10–11 pt; tables 9–9.5 pt (manuals and guides: header 9.5 pt, body 8.5 pt,
    for dense callout and step tables); footer 8 pt.
16. Table header row shaded with bold text, repeated on every page; units in the header or
    label ("Weight, approx. (kg)"); footnotes directly below in smaller type (Siemens).
17. Captions: "Table N - Title" above tables (Rockwell), "Figure N - Title" below figures.
18. Figure callouts numbered 1, 2, 3 with a legend; views lettered A, B, C (E+H). How to
    draw them is §6.

## 5. Writing

19. Procedures: intro sentence ("Complete these steps to …"), "Before you begin"
    prerequisites, numbered imperative steps with one action each, a result line at the
    end (Rockwell, E+H).
20. Optional Simplified Technical English limits: 20 words per procedural sentence, 25 per
    descriptive sentence, one instruction per sentence, at most six sentences per
    paragraph (ASD-STE100, secondary source).
21. Values: number, space, unit ("24 V DC", "65 °C", "2.7 kg"); SI first, imperial in
    parentheses; ranges "-25 to +70 °C"; tolerances "12 to 24 V DC ±10%".
22. UI elements and parameters in bold; menu paths with arrows ("Setup → Device tag"); tag
    names and code in a monospaced face.
23. Cross-references by number ("see section 3.2", "Table 4", "(page 14)"), never
    "above/below".
24. Tables for comparisons, specifications, parameter lists and results; lists for
    features and prerequisites; prose for reasoning.
25. Define abbreviations on first use and list them in an appendix.
26. Results are stated, not sold: no marketing adjectives, no emoji, no AI label blocks.
27. Manuals are lean and visual. One callout row per object with a tag and basis on every
    row makes a manual too long to use. A lean manual has:
    - a navigation map;
    - one full screenshot per screen with a short callout table;
    - cropped, labelled close-ups of the panels the text discusses;
    - P&ID crops tied to tags and I/O;
    - a separate "assumed logic" section whose entries are cross-referenced to the
      project's assumptions list.
    For process engineers and operators, write screen words only (no PLC tags, no rung
    references). Say once that the captures come from a simulated controller.
28. Open questions go to the engineer, not into the text. Where the document has to say
    that something is unknown, it says so once, in an open-items table with an owner.

## 6. Figures and callouts

29. Size markers from the PRINTED figure, never in screenshot pixels. At a fixed 15 px
    radius, a 1920 px screenshot printed 6.5 in wide gives about 2.5 mm markers, which are
    unreadable on paper. Use a 0.26 in (6.6 mm) disc with a digit of about 10 pt. In
    pixels: `r = 0.13 × image_width_px / print_width_in`. `callouts.py` does this; its
    `print_in` must equal the `{width=}` the figure gets in the document.
30. Marker style: yellow disc (#FDC418), black ring, thin white halo, bold black digit. It
    reads on dark HMI fills and in black-and-white print. Use one marker style per
    document; mixed styles read as an error.
31. A marker never covers text. Put it in clear space and run a leader line from it to a
    small black end dot on the control's EDGE, never on its caption or value. Leaders do
    not cross each other or pass through another target. Pin each marker by hand (the
    `marker` field) wherever automatic placement lands it on text.
32. Check legibility at page size before building: `callouts.py --proof` renders each
    figure at its print width at 100 dpi. Two thresholds:
    - text the reader must read in a crop prints at 7 pt or larger. A very wide, short
      crop (for example 1580×165 px at 6.7 in) prints its labels at 3–4 pt;
    - if a crop is too wide for its text, crop tighter or stack the labels; never shrink.
33. Crop so that sheet text the figure relies on is inside the frame (no labels cut at the
    edge). A 2 px grey frame separates a screenshot from the page.
34. Every image sits on the same page as its caption. A figure caption binds only to a
    table that follows it, and the reader should never be left with a near-empty page.
    The engine sets these rules; check them in the rendered PDF.
35. One numbering source: figure numbers on the picture, callout table rows and the text
    references come from one spec, not from three hand-kept lists.
