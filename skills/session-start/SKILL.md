---
name: session-start
description: Old name for the session-start ritual, which now lives in call-handoff; run that skill instead.
---

# Session Start — now part of `call-handoff`

Run the `call-handoff` skill. It is the single session-start ritual: skills and project
sync, newest handoff, open bugs, next-session prompt, usage baseline, briefing. If
`call-handoff` already ran in this session, its briefing stands; a second run only
repeats the same reads.

Once a task is chosen, follow `call-handoff`'s last section, "When a task is chosen"
(restate the goal, inspect before changing, skim the relevant lessons, keep the phases
separate, runtime-caps check).

Legacy project with no git, handoff or structure at all? `call-handoff` reports the
missing handoff; use `new-project` for the scaffolding and create the first handoff
before the session ends (`update-handoff`).
