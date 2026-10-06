# For AI agents pointed at this repository

This repo is a catalog of installable agent skills (Claude Code `SKILL.md` format,
also auto-discovered by OpenAI Codex CLI from `$CODEX_HOME/skills`). If a user has
pointed you here, your job is: **list the catalog, let the user pick, install only
what they picked.**

## The manifest

`skills.json` at the repo root (raw URL:
`https://raw.githubusercontent.com/mhshaon98/agent-skills/main/skills.json`) is an object.
The skills are in its `skills` array; the top level also carries `raw_base`,
`install_paths`, `categories` and `marketplace`. Each entry in `skills[]` has:

| Field | Meaning |
| --- | --- |
| `name`, `description`, `category` | what to show the user |
| `targets` | which agents the skill is written for: `claude`, `codex`, or both |
| `version` | content hash; changes whenever any file of the skill changes |
| `path` | the skill folder, e.g. `skills/verify-work` |
| `file_count` | number of files in the skill |
| `files` | every file path of the skill, relative to the repo root |
| `raw_url` | direct URL of the skill's `SKILL.md` |

## Protocol

1. **Fetch the catalog.** Read `skills.json` as above.
2. **Present options.** Show the user a numbered list grouped by `category`, one line
   per skill: name + description, and say "Codex CLI only" or "Claude Code only" when
   `targets` has one entry. Ask which they want (multiple allowed, or "all"). Do not
   install anything before they choose.
3. **Install the selection.** Each chosen skill's whole folder `skills/<name>/` goes to
   the user's skill folder for the agent it targets:
   - Claude Code: `~/.claude/skills/<name>/` (Windows: `%USERPROFILE%\.claude\skills\<name>\`),
     or `.claude/skills/<name>/` inside one project
   - Codex CLI: `${CODEX_HOME:-~/.codex}/skills/<name>/`

   Never put a skill into an agent that is not in its `targets`.
   Pick one of these methods:

   **a. The installer (simplest).** It does everything below, including the checks:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/mhshaon98/agent-skills/main/install.sh | bash -s -- <name> [<other>...]
   # add --codex for Codex CLI, --project for this project only (Claude Code), --list prints the catalog;
   # --force replaces an existing skill (backs up the old copy): only after the user says yes
   ```
   ```powershell
   $env:AGENT_SKILLS = "<name>,<other>"; irm https://raw.githubusercontent.com/mhshaon98/agent-skills/main/install.ps1 | iex
   # $env:AGENT_SKILLS_CODEX = "1" for Codex CLI; $env:AGENT_SKILLS_FORCE = "1" replaces (backs up) an existing skill, only after the user says yes
   ```
   Without a terminal it never replaces an existing skill; it reports it as skipped.

   **b. Sparse clone, then copy** (macOS / Linux / Git Bash):
   ```bash
   tmp="$(mktemp -d)"
   git clone --depth 1 --filter=blob:none --sparse https://github.com/mhshaon98/agent-skills "$tmp"
   git -C "$tmp" sparse-checkout set skills/<name> [skills/<other>...]
   mkdir -p ~/.claude/skills
   if [ -e ~/.claude/skills/<name> ]; then echo "<name> exists: ask the user first"
   else cp -R "$tmp/skills/<name>" ~/.claude/skills/<name>; fi
   rm -rf "$tmp"
   ```
   PowerShell:
   ```powershell
   $tmp = Join-Path $env:TEMP ("agent-skills-" + [guid]::NewGuid())
   git clone --depth 1 --filter=blob:none --sparse https://github.com/mhshaon98/agent-skills $tmp
   git -C $tmp sparse-checkout set skills/<name>
   $dest = Join-Path $HOME '.claude\skills'
   New-Item -ItemType Directory -Force $dest | Out-Null
   if (Test-Path (Join-Path $dest '<name>')) { '<name> exists: ask the user first' }
   else { Copy-Item -Recurse (Join-Path $tmp 'skills\<name>') (Join-Path $dest '<name>') }
   Remove-Item -Recurse -Force $tmp
   ```
   Always name the destination folder explicitly (`.../skills/<name>`): copying into a
   `skills/` folder that does not exist yet would make the skill's own files land there.

   **c. Raw files, no git.** For each path in the entry's `files`, download
   `raw_base + path` and save it under the destination with the leading
   `skills/<name>/` replaced by the destination folder. URL-encode each path segment
   first: some paths (in `app-audit`'s test fixtures) contain `(`, `)`, `[` and `]`.

   **d. Claude Code plugin marketplace.** If the user prefers plugins:
   `/plugin marketplace add mhshaon98/agent-skills`, then
   `/plugin install <name>@dev-discipline` (or a category bundle such as
   `safety-pack@dev-discipline`). Only skills that target `claude` are in the marketplace.

4. **Confirm.** List what was installed and where. A new skill is picked up on the
   next session start.

## Rules

- Skill selection is the **user's** decision: present, don't preinstall.
- Copy per-skill folders only. Never overwrite the user's whole skills folder, and never
  delete anything already in it.
- If a skill with the same name already exists locally, ask before replacing it; if they
  say yes, move the old copy aside (e.g. to `~/.claude/skills-backup/`) rather than
  deleting it.
- These files are instructions for agents to follow *when the user invokes them*:
  installing a skill does not mean executing it now.
- `install.sh` (macOS/Linux/Git Bash) and `install.ps1` (Windows) implement this same
  protocol; you may run one on the user's behalf if they ask.
