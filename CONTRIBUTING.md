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
2. **Regenerate the catalog; never hand-edit it.** `skills.json`,
   `.claude-plugin/marketplace.json`, `llms.txt` and the README tables are generated
   from the `SKILL.md` front-matter. For a new skill, add its category to `CATEGORIES`
   in `scripts/build-catalog.py` (and to `TARGETS` if it only works in one agent), then
   run `python3 scripts/build-catalog.py`. The front-matter `name` must equal the folder
   name.
3. **No personal information in skill text.** No real names, personal file paths, email
   addresses, internal hostnames, or secrets — anywhere in a `SKILL.md` or its
   supporting files. Skills here are meant to be portable across any project and any
   user.
4. **Pick an existing category** where it fits (`workflow`, `safety`, `delegation`,
   `formatting`, `tooling`). Propose a new category only if none apply.

Before opening the PR, run `python3 scripts/build-catalog.py --check`; it exits 1 if any
generated file is stale.
