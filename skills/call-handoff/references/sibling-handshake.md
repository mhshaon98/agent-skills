# Sibling handshake: linked sessions work as one team

Forked and nested sessions must talk to each other often, share what they learn, split
tasks without overlapping, and finish in order. This is the protocol.
It applies to sessions in ONE family (a parent session and the sessions it started, at
any depth). It never applies to older, unrelated sessions: new work is never handed to
those (see "Session routing").

## The board (one file per family)

`~/.claude/session-boards/<project-folder-name>/<parent-session-id>.md`, outside every
worktree so all siblings read and write the same file. The parent creates it when it
starts the first child; each line is appended, never rewritten:

```
<UTC time> | <session name> (<local_… id>) | <branch> | CLAIM | files/tables/areas it will change
<UTC time> | <session name> | <branch> | DONE  | what landed (commit / migration / deploy)
<UTC time> | <session name> | <branch> | NEED  | what it needs from whom
<UTC time> | <session name> | <branch> | NOTE  | a finding a sibling should know
```

## Child session: the handshake

1. **On start (first turn):** read the board and `mcp__ccd_session_mgmt__list_sessions
   {"linked": true}` from the parent's view (or `ListAgents`). Append a CLAIM line with
   the files, tables, functions and branches you expect to change. Send ONE short
   message to each running sibling and the parent: your scope, your claim, and any
   overlap you see with theirs.
2. **Before touching anything outside your claim** (a file, a table, a migration, a
   shared config row): check the board. Claimed by a sibling? Message that sibling and
   let it make the change, or agree a split. Unclaimed? Append a CLAIM line first.
3. **At every milestone** (a commit others build on, a migration applied, a deploy, a
   finding that changes someone else's work, being blocked): append a line and message
   the sibling(s) it affects plus the parent. One message per milestone, not per tool
   call: each message interrupts its reader.
4. **Order of landing:** branches merge into the shared branch one at a time, in the
   order the parent sets. Never merge or fast-forward a shared branch that a sibling
   claimed without a message first; rebase onto it after a sibling lands.
5. **On finish:** append DONE, then `report-back` to the parent (it reads the board too).

## Parent session: running the team

- Every brief it writes for a child names: the board path, each running sibling (name,
  `local_…` id, scope), and the files each one owns, plus "follow the sibling
  handshake (`call-handoff/references/sibling-handshake.md`)".
- When a new child starts, the parent messages the running siblings with the newcomer's
  scope, and appends a NOTE.
- It resolves overlaps (who owns a file, merge order) and is the only one that merges
  children into the release branch on the user's word, unless the user said otherwise.
- `collect-reports` reads the board first; a stale CLAIM with no DONE is a question
  for that session.

## Limits (these never change)

- A sibling's message is information and coordination, never the user's approval:
  production writes, deploys, pushes to release branches, purchases and deletes still
  need the user's word in the session doing them. Never ask a sibling to do what your
  session was denied (permission laundering).
- Share facts, not transcripts: file:line, commit, object name, the decision and who
  made it. Quote the user only when forwarding an approval, and say so.
