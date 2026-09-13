# Token Efficiency Playbook

*Distilled from a multi-agent review (official docs / community evidence / workflow
patterns) plus a community sweep. Load on demand — never quote wholesale into
`CLAUDE.md`. Confidence tags mark evidence quality; figures are indicative and drift
with tool versions, so re-measure before quoting them.*

Core equation: **burn = fixed context × round-trips**. Cut the standing tax first, then
the trip count, then output size.

## Tier 1 — Fixed-context tax (biggest measured levers, 30–95% swings)

1. **Tool Search / deferred MCP schemas is the single biggest win — keep it on.**
   Deferred tool schemas cost ~0 until used (check `/context`: deferred connectors show
   no token cost). Reported elsewhere: a few vendor MCPs 12k → ~600 tokens; 50+ tools
   77k → 8.7k (85–95%). Don't disable tool search. [measured]
2. **Disable idle plugins/connectors, don't just ignore them.** A handful of idle plugins
   can cost tens of thousands of tokens before the first prompt, and plugin skills inject
   their descriptions every session. Telling the agent "don't use plugin X" in
   `CLAUDE.md` mostly fails — only actually disabling it works. A good standing policy:
   keep rarely-used plugins off globally and re-enable per project via that project's
   `.claude/settings.json`. [measured + corroborated]
3. **Prefer CLI tools over MCP servers for the same service** (gh, wrangler,
   supabase CLI): CLIs add zero per-tool listing tax. Official docs guidance.
   [first-party]
4. **`CLAUDE.md`: every always-loaded line is paid every turn.** Official target
   <200 lines; one benchmark cut a ~3.8k-token file to ~300 tokens (≈92% context cut)
   with no quality regression. Keep a small core and move playbooks/skills to
   on-demand loading, with a byte budget enforced. [measured]
5. **Skill descriptions load every session** — keep frontmatter descriptions to ≤2
   sentences and prune skills you don't use. Measure rather than guess; this read-only
   command (run from your skills directory) totals description bytes (≈4 bytes/token):
   [verified locally]

   ```bash
   python -c "import os,io,re;t=0;n=0
   for d in sorted(os.listdir('.')):
       p=os.path.join(d,'SKILL.md')
       if not os.path.isfile(p): continue
       m=re.match(r'^---\r?\n(.*?)\r?\n---', io.open(p,encoding='utf-8').read(), re.S)
       if not m: continue
       dm=re.search(r'^description:\s*(.*(?:\n[ \t]+.*)*)', m.group(1), re.M)
       if not dm: continue
       n+=1; t+=len(dm.group(1).strip().strip('\"').strip(\"'\").encode('utf-8'))
   print(n,'skills',t,'bytes')"
   ```

## Tier 2 — Round-trips and session shape

6. **/clear between unrelated tasks; new topic = new session.** Docs call
   never-cleared long sessions the top cause of surprise spend. A handoff system is the
   stronger version: wrap → next-session prompt → fresh small session instead of a
   300k+ mega-session. Trigger proactively, not at the ceiling.
   [first-party + corroborated]
7. **Custom /compact instructions** at natural boundaries (`/compact keep only
   code changes and test results`) beat naive auto-compact. Handoff-file
   cold-start still beats /compact for cross-session continuity. [corroborated]
8. **Plan-then-execute for anything touching >2 files.** Unscoped "investigate
   X" prompts trigger open-ended file reads; a committed plan file lets
   implementation run without re-exploration (reported case: 90 files changed, no
   window over 50k). Front-loaded spec prompts reportedly save ~70% vs
   conversational back-and-forth. [corroborated/anecdote]
9. **Subagents multiply, don't divide, cost** — 3 subagents ≈ 4x one focused
   pass (each cold-starts the fixed context). Use them ONLY to quarantine
   verbose work (exploration, logs, scraping) where just the report returns;
   route them to cheaper models. Trap: the `CLAUDE_CODE_SUBAGENT_MODEL` env var
   silently overrides frontmatter model routing. Agent Teams cost several times a
   standard session (official figure) — avoid on plan-limited accounts. [measured]
10. **Diagnostics are not free:** each `/context` run pastes ~12–15k into the
    transcript. Run it once at session start, not mid-session. [verified locally]
11. **/btw for side questions** — the answer never enters history; meaningful
    savings in question-heavy sessions per community tracking. [corroborated]

## Tier 3 — Per-operation size

12. **Hooks to trim noisy output:** a PreToolUse/PostToolUse hook that greps test/
    build logs to FAIL/ERROR lines — tens of thousands of tokens → hundreds
    (official docs example; community: 80–99% on log compression). [first-party]
13. **Clean extraction over raw fetch:** markdown extraction (e.g. the defuddle CLI)
    uses far fewer input tokens than raw HTML (vendor figure ~94%, directionally
    right). [vendor-measured]
14. **DOM/text verification over screenshots for routine checks** (~300–800
    tokens vs 1.5–3k), BUT screenshots are cheaper than folklore says (real ≈ 1.2k;
    the estimator overstates them). The real killer is the unbounded verify loop
    (documented at millions of tokens in minutes) — cap iterations, prefer
    deterministic asserts. [measured]
15. **Read targeted, not whole files:** Grep/Glob + line-ranged Reads; never
    re-Read a file just edited (the harness tracks state). Maintain folder-map/
    index files so agents jump instead of walking trees. [first-party + pattern]
16. **Output discipline:** terse no-preamble responses, diffs over full-file
    restatements; output tokens bill 3–5x input. [corroborated]

## Cache mechanics (why gaps and edits cost)

- Prompt-cache TTL varies by plan and billing mode (e.g. 1h vs 5min); check current
  docs and any env var that restores the longer TTL. A return-after-gap miss
  reprocesses the ENTIRE context at full input price — wrap sessions rather than
  leaving them idle-open. [first-party]
- Keep the prefix stable: no live timestamps in prompts/`CLAUDE.md`, no mid-
  session tool toggling, no mid-session model switching in the main thread
  (each invalidates cache; a 90%-off read becomes a 125% write). [corroborated]

## Anti-slop filter

The viral "5 must-have plugins" genre is mostly noise. Evaluate on mechanism, not
vibes. A red-flag example: "token-saving" local proxies that repoint
`ANTHROPIC_BASE_URL` at themselves and forward to hundreds of third-party providers.
That means client code and prompts leave to unvetted providers (a data-exfiltration
path for any confidential or client work), models get silently swapped (defeating any
model-pinning policy), and such packages have shipped with supply-chain flags, default
admin passwords, and clone repos. Adding plugins to save tokens is usually backwards:
plugins ARE the tax — which is why disabling idle ones (#2) is the real lever.
