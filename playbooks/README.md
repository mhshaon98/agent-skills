# Playbooks

Longer-form engineering guidance that an agent reads **on demand** — only the playbook
relevant to the task at hand, never all of them every session. Skills in this repo may
point here for detail.

| Playbook | What it is | Read it when |
|---|---|---|
| [architecture-playbook.md](architecture-playbook.md) | Architecture defaults per project type, the least-code ladder, invariants against design drift, storage decision guide | Starting a project, adding a component/dependency, or choosing storage |
| [verification-and-quality.md](verification-and-quality.md) | Verification ladder, Verified/NOT-verified ledger, debugging discipline, code-quality, refactor and release checklists | Before claiming anything is done, fixed, or ready to ship |
| [security-and-secrets.md](security-and-secrets.md) | Secrets hygiene, backend RLS/advisor rules, client permission boundaries, security-pass checklist, resource-exhaustion hardening | Touching auth, keys, policies, personal/payment data, new write endpoints, or before a release |
| [cloudflare-cost-safety.md](cloudflare-cost-safety.md) | Why spend ceilings are plan settings, one-way-door upgrade rules, KV/R2 cost-aware design rules, deploy checklist | Before creating or changing anything on Cloudflare (Workers, KV, R2, D1, Pages, DNS) |
| [model-and-agent-strategy.md](model-and-agent-strategy.md) | Model tiers, explicit model pinning, when (not) to spawn subagents, agent roster, orchestration and cost rules | Choosing a model or deciding whether and how to delegate to subagents |
| [token-efficiency.md](token-efficiency.md) | Evidence-tagged levers for cutting fixed context, round-trips, and per-operation token cost | A session or setup is burning usage faster than expected, or when tuning `CLAUDE.md`/plugins/skills |
| [communication-and-autonomy.md](communication-and-autonomy.md) | Outcome-first reporting, honesty rules, proceed-vs-ask calibration, UI iteration protocol | Any session where the agent reports to the user or must decide whether to ask first |
| [codex-image-pipeline.md](codex-image-pipeline.md) | Headless AI image generation via the Codex CLI, brief rules, mapped failure modes | A project needs generated images (marketing plates, mockup photography) |
| [social-marketing-visuals.md](social-marketing-visuals.md) | The grid-mix rule for social feeds and the production notes that travel with it | Planning or producing a batch of social/marketing tiles |
| [character-narrated-video.md](character-narrated-video.md) | Remotion pipeline for a mascot narrating a short video: measured voice timeline, spring-based rig, checks, review ritual | Building a short video where a character speaks over and reacts to the picture |
| [device-demo-video.md](device-demo-video.md) | Remotion recipe for an app shown on real device hardware in motion: recreated UI, fold/flip moves, foley, checks, deliverables | Building a device demo, feature walkthrough, or store preview video |

Video work: Remotion is the recommended framework for both video playbooks.
