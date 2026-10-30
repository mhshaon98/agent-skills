# Markdown starters for `eng_report.py build`

Copy the starter, fill it, then `build`. `[TO COMPLETE]` marks a section the author must
fill; never replace it with invented content.

## Test report (FAT / SAT / commissioning)

```markdown
---
title: <System> <Activity>
subtitle: Factory Acceptance Test Report
doc_type: Test Report
doc_no: <ask>
rev: A
author: <name>
classification: Internal
---

[[revision-history]]

# Summary
<One sentence with the result: passed N of M tests; K deviations open.>

# Scope and objectives
# References
Table: Reference documents
| Document | Number |
|---|---|

# Equipment under test
# Method and acceptance criteria
# Results
Table: Test results
| Test ID | Description | Expected | Actual | Result |
|---|---|---|---|---|

# Deviations and punch list
| ID | Description | Severity | Owner | Status |
|---|---|---|---|---|

# Conclusions
# Sign-off
[[sign-off]]
```

## Engineering memo

```markdown
---
title: <Subject>
doc_type: Engineering Memo
doc_no: <ask>
rev: A
author: <name>
---

<Opening paragraph: why this memo exists and the answer in one or two sentences.>

# Background
# Findings
# Recommendation and actions
| Action | Owner | Due |
|---|---|---|

# References
```

Memos usually skip the cover: add `--no-cover` when building.

## Procedure / work instruction

```markdown
---
title: <Task>
doc_type: Work Instruction
doc_no: <ask>
rev: A
---

# Purpose and scope
# Safety
> **WARNING:** <Hazard>. <Consequence>. <How to avoid it>.

# Before you begin
- <tools, parts, permits, isolation>

# Procedure
Complete these steps to <task>.

1. <Imperative verb, one action.>
2. <...>

Result: <what the operator sees when it worked>.

# Records
```

## Manual / user guide (with screenshots)

Build with `--cover`. Make figures and callout tables first with `scripts/callouts.py`
(`print_in` = the width used below), then `build`, then `pdf`.

```markdown
---
title: <Machine> <Topic>
subtitle: User Manual
doc_type: User Manual
doc_no: <ask>
rev: A
author: <name>
classification: Customer Use
---

# About this document
<Purpose, audience, what the reader can do after reading it. One sentence: the screenshots
come from a simulated controller, so some values are not real.>

Table: Table 1 - Related documents
| Document | Number |
|---|---|

[[revision-history]]

[[toc]]

# Safety
> **WARNING:** <Hazard>. <Consequence>. <How to avoid it>.

# Getting around
![](figs/lineview.png){width=6.5}
Figure: Figure 1 - Line View
Table: Table 2 - Line View (Figure 1)
[[include tables/lineview.md]]

# <Procedure>
Complete these steps to <task>.

1. <Imperative verb, one action.> The screen shows <result> (Figure 2).
2. <...>

Result: <what the operator sees when it worked>.

# Messages
| Message | Where | Meaning |
|---|---|---|
```

For a one- or two-page quick start, build with `--no-cover --no-numbered`. Put the steps
in a `Step | Action | You see` table with a small crop in each row
(`@@img figs/q_pump.png|1.6@@`), and add a `[[box]]` … `[[endbox]]` panel for the short
reference.
