# update-handoff: layered projects

Read when the gather script printed `LAYERED`, or the handoff is juggling two or more unrelated issues.

- **Layered project** (gather printed `LAYERED`): there is no dated root handoff. Edit
  in place only the topic file(s) this session touched (`handoffs/<Topic>.md`: Problem →
  History (dated) → Decisions + rejected alternatives → Verified / NOT verified → TODO →
  Notes, `Last updated:` line at the top), update that topic's row (Status, Last touched)
  in the project `CLAUDE.md` `## Topic table`, and name the topic in
  `NEXT-SESSION-PROMPT.md`. Never put session detail in `CLAUDE.md` beyond the row. A new
  topic ⇒ new file + new row. Fact spanning topics ⇒ one line in each, cross-linked.
- **Go layered when** the project is juggling ≥2 independent issues (different devices,
  vendors, customer contacts or source folders, each with its own TODO), so a cold start
  loads only the topic asked about. Offer it to the user first; on yes, in the same batch:
  - create a project `CLAUDE.md`, or add to the existing one, containing:
    - a short project line
    - the layered-handoff rules (the bullets above)
    - `## Topic table` with columns Topic | Handoff | Source docs | Status | Last touched
    - standing rules shared by all topics
  - split the current handoff's content into `handoffs/<Topic>.md`, one file per topic, keeping every fact
  - `mv` the dated root `HANDOFF-*.md` files into `handoffs/archive/` (they are history)
  - record the new layout in your assistant's memory, if you keep one
  Topics that already have their own handoff elsewhere get a row pointing at it, not a copy.
