# call-handoff: entry-point and layered project layouts

Read when the Step 1 script printed `pointer …` or `LAYERED HANDOFFS`.

- **Entry-point folder**: a project folder may hold only `WHERE-IS-THE-CODE.md` + a
  pointer `CLAUDE.md` (e.g. a cloud-synced folder whose code lives in a git clone
  elsewhere). The script detects "no handoff AND no .git", reads the first path out of
  the pointer, and `cd`s there for the rest of the run; say in the briefing which folder
  the code lives in. Every later command in the session must target that path too (the
  shell resets cwd to the entry point).
- **Layered project** (`LAYERED HANDOFFS` printed): the project `CLAUDE.md` holds a
  `## Topic table` routing each concurrent issue to its own living file in
  `handoffs/<Topic>.md`. Pick the topic from the user's args/request (or the topic
  `NEXT-SESSION-PROMPT.md` names) and Read **only that one file** — that is the one
  follow-up Read. Topic unclear ⇒ show the table's Topic/Status columns and ask; never
  read every topic file. Dated handoffs in `handoffs/archive/` are history, not state.
