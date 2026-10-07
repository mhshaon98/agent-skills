// Flow charts shown when a skill is opened on the catalog page. One entry per skill
// in skills.json: `when` is the trigger, `steps` run in order, `out` is the result.
// A step is [label, note] or [label, note, "check", backLabel] for a decision.
// Keep labels to a few words; a skill with no entry falls back to a generic flow.
window.SKILL_FLOWS = {
  "bug-ledger": {
    when: "A bug is reported",
    steps: [
      ["Open BUG_LIST.md first", "Many \"new\" bugs are old ones coming back"],
      ["Seen it before?", "A fixed entry that matches means a regression", "check", "yes: reopen that entry"],
      ["Triage", "Reproduce and narrow it before writing anything"],
      ["Debug by the rules", "One change at a time, evidence for each"],
      ["Record the fix", "Cause, fix and how it was verified"]
    ],
    out: "A ledger the next session can trust"
  },
  "call-handoff": {
    when: "A session starts",
    steps: [
      ["Run one script", "Syncs, finds the newest handoff, open bugs, next prompt"],
      ["Reconcile", "Handoff older than the commits? Say so, trust git"],
      ["Brief in 200 words", "What it is, where it stopped, what is open"],
      ["Tidy session titles", "Topic and date, so the list sorts"]
    ],
    out: "Oriented in two round-trips, then it waits for you"
  },
  "new-project": {
    when: "A new project begins",
    steps: [
      ["Scaffold continuity", "Handoff, bug ledger and instructions from day one"],
      ["Interview", "One question at a time"],
      ["Plan vertical slices", "Written to tasks/plan.md before any code"],
      ["Pick architecture", "Proven defaults for the project type"],
      ["Choose storage", "From a decision table, not habit"]
    ],
    out: "A project that is ready to build and easy to resume"
  },
  "session-start": {
    when: "The old name is called",
    steps: [
      ["Point to call-handoff", "The start ritual lives there now"]
    ],
    out: "Run call-handoff instead"
  },
  "update-handoff": {
    when: "A session is ending",
    steps: [
      ["Gather", "One call: git state, changed files, open items"],
      ["Sweep the context", "Nothing said in the session is allowed to slip"],
      ["Decide what changes", "Nothing is written yet"],
      ["Write in one batch", "Handoff, lessons, memory, bug ledger, next prompt"],
      ["Closing checklist", "Each item done, or a reason why not"]
    ],
    out: "The next session can start cold"
  },
  "app-audit": {
    when: "\"Audit this app\"",
    steps: [
      ["Read the mode", "Default, full, launch, or a focused mode"],
      ["Profile the app", "Stack, data flows, trust boundaries, processors"],
      ["Route the domains", "Only the specialists this app needs"],
      ["Read-only specialists", "Security, privacy, payments, data, ops, AI"],
      ["Fresh research", "Law and store policy from primary sources"],
      ["Attack the findings", "Adversarial review, optional Codex peer review"]
    ],
    out: "One consolidated report with evidence"
  },
  "compliance-check": {
    when: "Before a store submission",
    steps: [
      ["Inventory what is live", "Store listing, policies, backend, deletion jobs"],
      ["Check each surface", "The live thing against the code and the words"],
      ["Reconcile", "Statuses drift faster than code"],
      ["Report what is left", "Open items, ranked"],
      ["Work the runbook", "Closeout mode fixes them one by one"]
    ],
    out: "What you say matches what you ship"
  },
  "pre-release-review": {
    when: "\"Ship it\"",
    steps: [
      ["Spawn a fresh reviewer", "No author context, so no author bias"],
      ["Review the full changed surface", "Everything since the last review, not just the last diff"],
      ["Run the release checklist", "Alongside the review"],
      ["Findings?", "Anything real gets fixed", "check", "yes: fix, then re-verify"]
    ],
    out: "A release someone else has checked"
  },
  "safe-data-write": {
    when: "About to write user data",
    steps: [
      ["Back up first", "Before the first byte changes"],
      ["Look at the target", "Know what will be overwritten or deleted"],
      ["Write", "The smallest change that does the job"],
      ["Audit the result", "Counts and samples, not a guess"],
      ["Keep the rollback", "Until the result is proven"]
    ],
    out: "No data lost, and a way back if it was"
  },
  "security-pass": {
    when: "Touching auth, keys or personal data",
    steps: [
      ["Secrets hygiene", "Nothing secret in code, logs or the client"],
      ["Backend policies", "Row-level rules on every table that needs them"],
      ["Client boundaries", "Permissions and privacy the app actually holds to"],
      ["Runaway limits", "Caps on processes and memory"],
      ["Checklist", "Every rule traces to a real production finding"]
    ],
    out: "A pass you can point to before release"
  },
  "verify-work": {
    when: "About to say \"done\"",
    steps: [
      ["Climb the ladder", "Compiles, tests, runs, seen working"],
      ["Actually run it", "Reading the diff is not a test"],
      ["Write the ledger", "Verified, and NOT verified, both listed"],
      ["Honesty rules", "Failures reported with their output"]
    ],
    out: "A completion claim that is true"
  },
  "antigravity-bridge": {
    when: "\"Ask Gemini\"",
    steps: [
      ["Check it is installed", "Every time, before promising anything"],
      ["Go through the wrapper", "The only entry point"],
      ["Pick the model", "By policy, light work only"],
      ["Ask before writes", "Write access needs a yes each time"],
      ["Watch the quota", "It is the real limit"]
    ],
    out: "A third opinion your agent then verifies"
  },
  "astra-conductor": {
    when: "The session model is GPT-6-Astra",
    steps: [
      ["Plan as architect", "Astra does not execute"],
      ["Write the brief", "Subagents start cold"],
      ["Spawn with a pinned model", "Or the child silently inherits Astra"],
      ["Verify end to end", "The one job never delegated"],
      ["Goal reached?", "The loop stands for the whole session", "check", "no: plan the next step"]
    ],
    out: "Expensive model thinks, cheaper models do"
  },
  "codex-bridge": {
    when: "\"Ask Codex\"",
    steps: [
      ["Check it is installed", "First, every time"],
      ["Read the job's reference", "Running exec, image generation and Windows each have one"],
      ["Send the task", "Long jobs go to the background"],
      ["Take the result back", "Your agent stays responsible for it"]
    ],
    out: "A second opinion from another provider"
  },
  "cowork-relay": {
    when: "Work spans Cowork and Code",
    steps: [
      ["Do all this side can", "Each tool has things only it can reach"],
      ["Write the relay prompt", "Copy-paste ready, required at session end"],
      ["Paste it across", "The other side picks up from there"],
      ["Receive and continue", "Same rules on both sides"]
    ],
    out: "One project, two tools, nothing dropped between them"
  },
  "fable-conductor": {
    when: "The session model is Fable-class",
    steps: [
      ["Plan", "The top model decides what to do"],
      ["Brief", "Written for an agent that knows nothing yet"],
      ["Delegate the doing", "Opus, Sonnet or Haiku subagents execute"],
      ["Verify end to end", "Never handed off"],
      ["Goal reached?", "The loop stands for the whole session", "check", "no: plan the next step"]
    ],
    out: "Top-tier judgment without top-tier bills"
  },
  "spawn-agent": {
    when: "About to spawn a subagent",
    steps: [
      ["Worth spawning?", "Only if the gate says so", "check", "no: do it inline"],
      ["Route the model tier", "Usage limits are a real budget"],
      ["Write the brief", "Goal, what is ruled out, where to look"],
      ["Orchestrate", "Parallel where independent, verify what returns"]
    ],
    out: "Fewer agents, each one worth its tokens"
  },
  "apply-richformat": {
    when: "\"This is text vomit\"",
    steps: [
      ["Name the medium", "Screen, document, chat and CLI differ"],
      ["Obey the design system", "For UI, the project's rules come first"],
      ["Inventory the information", "What kinds of thing are on the page"],
      ["Apply the seven moves", "Rank, group, separate"],
      ["Restraint gate", "Formatting is not decoration"],
      ["Verify by looking", "At the render, not the diff"]
    ],
    out: "Rank and separation you can see at a glance"
  },
  "doc-metadata": {
    when: "The agent makes an Office or PDF file",
    steps: [
      ["Ask whose name", "Once per project, then remembered"],
      ["Stamp the file", "Author and company set properly"],
      ["Strip fingerprints", "No \"python-docx\", no \"generated by\""]
    ],
    out: "A file that looks like you made it"
  },
  "eng-report": {
    when: "A document has to look like a vendor manual",
    steps: [
      ["Brand profile on file?", "Company name, logo and colours, saved once", "check", "no: ask for the logo and colours"],
      ["Pick the skeleton", "Test report, memo, procedure, manual, specification"],
      ["Fix the content", "Safety notices before their steps, one action per step, tables for data"],
      ["Run the engine", "Numbered headings, notice panels, header, footer, cover"],
      ["Check and render", "Rule check, then look at every page"]
    ],
    out: "A Word document in your branding, with document control on every page"
  },
  "slop-clean": {
    when: "You run /slop-clean",
    steps: [
      ["Capture the before", "Authorities, linter and screenshots"],
      ["Deterministic sweep", "Code finds the hits, not a model"],
      ["Classify every hit", "Slop, or a deliberate choice with evidence"],
      ["Report, then fix", "You see the list first"],
      ["Verify", "Including a check that character survived"]
    ],
    out: "Slop gone, deliberate boldness kept"
  },
  "client-cms": {
    when: "\"Add an admin panel\"",
    steps: [
      ["Inspect the site", "Mandatory, before deciding anything"],
      ["Inventory the content", "What a client should be able to edit"],
      ["Let the site pick the stack", "Architecture follows what is there"],
      ["Auth and security", "Who can change what"],
      ["Admin experience", "Built for nontechnical staff"],
      ["Migrate safely", "Existing content moves without loss"],
      ["Verify end to end", "Before claiming done"]
    ],
    out: "Clients edit content without touching source"
  },
  "commissioning-logger": {
    when: "\"Log this\"",
    steps: [
      ["Open a workspace", "One folder per subject"],
      ["Log as you go", "Each step into log.md, as it happens"],
      ["Annotate screenshots", "Arrows and labels on the evidence"],
      ["Build the Word doc", "From the log, not from memory"],
      ["Hand off", "So the next session can continue it"]
    ],
    out: "A write-up of what was really done"
  },
  "usage-here": {
    when: "\"What did this session cost?\"",
    steps: [
      ["Run the report", "Reads the session's own transcript"],
      ["Tokens and dollars", "Split by model"],
      ["Share of your limits", "The 5-hour block and the week"],
      ["Top three prompts", "Where the spend went"],
      ["State the caveats", "What the numbers cannot know"]
    ],
    out: "A straight answer on cost"
  }
};
