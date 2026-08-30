---
name: safe-data-write
description: Use BEFORE any write, migration, or deletion touching precious user data — data stores, schemas, user-owned files (Excel workbooks, databases, documents). User data is sacred; these rules were learned from shipped data-loss bugs.
---

# Safe Writes to Precious Data

Before touching a store/schema/file that user data lives in, know the migration path
and the rollback story. If you can't state both, stop and design them first.

## Core rules

1. **Additive over destructive.** New fields optional/defaulted (`templateId:
   String?` pattern — nil-safe, zero migration risk); soft deletes (`deletedAt`)
   over hard deletes; UUID ids + `createdAt`/`updatedAt` on anything that might sync.
2. **Test the upgrade path, not just fresh install** — with existing real-shaped
   data. A store misconfiguration once silently relocated the database and shipped
   a data-loss bug that fresh-install testing could not catch.
3. **Files owned by another application** (Excel workbooks, Word docs): never
   load+save them programmatically — write **through the owning application** (e.g.
   xlwings→Excel) or don't write at all. Every naive-save approach tested (openpyxl,
   LibreOffice headless, raw-XML zip editing) corrupted the file.
4. **Every write to user data**: capability check → lock → **backup** → write →
   **audit entry** (append-only JSONL with timestamps and old/new values). Prefer
   single small writes over bulk.
5. **Never delete the last independent copy until the replacement is proven by a
   full round-trip** — a write-time checksum is not enough; the consuming app must
   actually read the new copy end-to-end. Corollary: an empty/missing folder is not
   proof of data loss — check whether it was MOVED or quarantined first; re-verify a
   path immediately before any process that initializes-if-empty points at it.
6. **Concurrency: never decrement/update a counter with read-modify-write** — push
   arithmetic into a single atomic statement (`UPDATE t SET n = GREATEST(0, n-$1)`)
   so the DB serializes. Prove with a concurrency test, not code reading.
7. **Clamp footguns at the input**: validate config values into safe ranges
   (`max_backups ≥ 1` — `list[:-0]` slices everything).
8. **Reconcile against ground truth after every change**: for data tools, totals
   must match the source exactly — ship that check as a permanent health feature.

## Destructive operations (deleting, overwriting, dropping)

- Stop and confirm with the user first unless the target was created this session.
- Look at the target before deleting — if what you find contradicts how it was
  described, surface that instead of proceeding.
- Destructive migrations require an explicit, tested rollback script.

## Test data hygiene

Never leave test rows in user datasets. Ship a health check that flags
`^\s*(test|zz\s*test|sample|dummy|asdf|xxx)\b` (case-insensitive) rather than
relying on remembering to clean up.
