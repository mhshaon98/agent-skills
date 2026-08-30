# For AI agents pointed at this repository

This repo is a catalog of installable agent skills (Claude Code `SKILL.md` format,
also auto-discovered by OpenAI Codex CLI from `$CODEX_HOME/skills`). If a user has
pointed you here, your job is: **list the catalog, let the user pick, install only
what they picked.**

## Protocol

1. **Fetch the catalog.** Read `skills.json` at the repo root (raw URL:
   `https://raw.githubusercontent.com/OWNER/REPO/main/skills.json`). Each entry has
   `name`, `description`, `category`, and `files` (file count).
2. **Present options.** Show the user a numbered list grouped by `category`, one line
   per skill: name + description. Ask which they want (multiple allowed, or "all").
   Do not install anything before they choose.
3. **Install the selection.** For each chosen skill, copy the entire directory
   `skills/<name>/` into the user's skill folder:
   - Claude Code: `~/.claude/skills/<name>/`
   - Codex CLI: `~/.codex/skills/<name>/`
   Preferred method (no full clone):
   ```bash
   git clone --depth 1 --filter=blob:none --sparse https://github.com/OWNER/REPO /tmp/skills-catalog
   cd /tmp/skills-catalog && git sparse-checkout set skills/<name> [skills/<other>...]
   cp -R skills/<name> ~/.claude/skills/
   ```
   Copy per-skill directory only — never overwrite the user's whole skills folder,
   and never delete anything already in it.
4. **Confirm.** List what was installed and where. A new skill is picked up on the
   next session start.

## Rules

- Skill selection is the **user's** decision — present, don't preinstall.
- If a skill with the same name already exists locally, ask before replacing it.
- These files are instructions for agents to follow *when the user invokes them* —
  installing a skill does not mean executing it now.
- `install.sh` (macOS/Linux) and `install.ps1` (Windows) implement this same protocol
  interactively for humans; you may run one on the user's behalf if they ask.
