# Retention and deletion: making the job match the sentence

## 1. Diff the job against the published sentence

Put the exact sentence next to the implementation and answer four questions:

| Question | Example sentence | Wrong implementations seen |
|---|---|---|
| **Unit**: row, thread, account? | "deleted 90 days after the last message in the thread" | per-message age delete (kills old messages in live threads) |
| **Trigger**: age of what? | last message, not first; last activity, not signup | `created_at` of each row |
| **Scope**: which tables, buckets, third parties? | "conversations, and any image attached" | rows deleted, bucket objects orphaned; side tables (read receipts, conversation state) left |
| **Extras**: what does the job do that the sentence does not say? | tokens "removed when they stop working, or on account deletion" | tokens purged by age, silently stopping reply pushes |

Also: a daily schedule for an "N days after" promise; a `< 30`-day guard so an operator typo
cannot wipe live data; a re-check at delete time so a thread revived mid-run survives.

## 2. Order of operations

1. Publish the retention period in the policy first (the owner chooses the number).
2. Write the job to match the sentence, including stored files.
3. Test on real schema with the rolled-back pattern (section 4).
4. Apply, schedule, verify the schedule row and the first run result.
5. Compute and record the earliest date any data can qualify.

## 3. Files cannot be deleted from SQL

Supabase protects `storage.objects` with a statement trigger (`storage.protect_delete`); other
stacks have the same split between rows and object storage. Pattern:

- the SQL purge **skips** threads that reference files and counts them;
- a scheduled service-role function (edge function / worker) handles those threads:
  1. list stale file threads and their referenced paths (service-role-only SQL helper),
  2. remove those objects through the storage API,
  3. only if that succeeded, delete the rows through a helper that re-checks staleness
     atomically (a revived thread survives),
  4. only if the thread is gone, clear anything else under the owner's prefix;
  5. failures leave the thread for the next run; log counts only, never ids or paths.
- schedule it via `pg_cron` + `pg_net` with the service-role key in Vault (the key is
  written by a script that never prints it; see `templates/setup-script-skeleton.sh`).

Templates: `templates/retention-purge.sql` (thread-level purge + helpers) and
`templates/purge-files-function.ts`.

## 4. Testing without staging: the rolled-back transaction

```sql
do $t$
declare s text;
begin
  -- 1. create the candidate function in pg_temp (same body, no security definer)
  -- 2. optionally: alter table <t> disable trigger user;   (stops webhooks; rolls back too)
  -- 3. seed fake rows with clearly fake owners ('zz_test_*') covering every case:
  --    fully stale; old first + recent last; stale with a file; below-guard window
  -- 4. run it, then build a result string with counts per case and the real-row count
  raise exception '%', s;   -- forces rollback; the message carries the results
end $t$;
```
Afterwards, read-only: real row count unchanged, zero `zz_test` rows, triggers enabled
(`select tgname, tgenabled from pg_trigger where tgrelid = '<t>'::regclass and not tgisinternal`).
`pg_net` requests queued inside a rolled-back transaction are discarded.

## 5. Account deletion honesty

- Persist a deletion job BEFORE the network call; clear it only on confirmed complete success.
- Server returns structured `{ ok, failures, skipped }`. `ok` alone is not success: a listed
  failure is failure.
- **Two different "not yours" answers need different UI**:
  - `forbidden` for every id: also what a user who never used the feature gets. Treat as
    terminal and stay silent.
  - `skipped > 0` alongside a successful delete of the caller's own data: some data is owned
    by another session (another device). Tell the user before the local wipe, with what they
    can do (delete on the other device, email support, automatic retention).
- Unit-test the core with a stubbed transport: persisted-before-network, transport failure
  keeps job, partial failure keeps job, forbidden terminal, skipped reported and job cleared,
  retry ceiling.
- Every local "seen notice" / consent flag goes in the wipe list so a fresh start sees
  notices again.
