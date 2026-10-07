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
