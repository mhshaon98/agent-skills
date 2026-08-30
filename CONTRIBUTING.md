# Contributing

Pull requests are welcome — a new skill, a fix, or a sharper description.

## How a skill is structured

A skill is a single directory under `skills/<name>/` with a `SKILL.md` at its root:

- **Front-matter.** `SKILL.md` opens with YAML front-matter carrying a `name` and a
  `description`. The description tells an agent *when* to reach for the skill — write it
  as trigger conditions, not marketing.
- **Body.** After the front-matter comes the instruction content the agent follows.
- **Extra files (optional).** Scripts, templates, or reference docs live alongside the
  `SKILL.md` in the same directory.

## Rules for a PR

1. **One skill per directory.** Keep each skill self-contained under its own
   `skills/<name>/` folder.
2. **Keep `skills.json` in sync.** The manifest at the repo root is the source of truth
   for the README tables, the installers, and the web catalog. Add or update the entry
   for your skill — `name`, `description`, `category`, and `files` (the file count in the
   skill directory) — and make sure it matches what is on disk.
3. **No personal information in skill text.** No real names, personal file paths, email
   addresses, internal hostnames, or secrets — anywhere in a `SKILL.md` or its
   supporting files. Skills here are meant to be portable across any project and any
   user.
4. **Pick an existing category** where it fits (`workflow`, `safety`, `delegation`,
   `formatting`, `tooling`). Propose a new category only if none apply.

Test your entry with `python3 -m json.tool skills.json` before opening the PR to confirm
the manifest still parses.
