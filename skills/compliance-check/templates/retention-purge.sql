-- TEMPLATE (compliance-check). Tested in production.
-- Thread-level retention: a whole thread goes N days after its LAST message; threads that
-- reference stored files are skipped here and handled by purge-files-function.ts.
-- Rename before use: dev_messages (messages table: owner, created_at, image_url),
-- chat_reads and dev_conversations (per-owner side tables), public schema.
-- Test with the rolled-back DO-block pattern in references/retention-and-deletion.md §4
-- BEFORE applying. Schedule daily after publishing the matching policy sentence:
--   select cron.schedule('purge-old-chat', '17 4 * * *', $$select * from public.purge_old_chat(90)$$);

create or replace function public.purge_old_chat(retain_days int default 90)
returns table (threads_deleted bigint, messages_deleted bigint, threads_skipped_images bigint)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  cutoff timestamptz;
  stale text[];
begin
  -- Operator error guard: a small or negative window would wipe live threads.
  if retain_days is null or retain_days < 30 then
    raise exception 'purge_old_chat: retain_days must be >= 30 (got %)', retain_days;
  end if;
  cutoff := now() - make_interval(days => retain_days);

  select count(*) filter (where has_image),
         coalesce(array_agg(owner) filter (where not has_image), '{}')
    into threads_skipped_images, stale
  from (select owner, bool_or(image_url is not null) has_image
        from public.dev_messages
        group by owner
        having max(created_at) < cutoff) t;

  -- Re-check at delete time: a thread that received a new message after the
  -- scan above is no longer stale and must survive.
  with d as (
    delete from public.dev_messages m
    where m.owner = any(stale)
      and not exists (select 1 from public.dev_messages n
                      where n.owner = m.owner and (n.created_at >= cutoff or n.image_url is not null))
    returning m.owner)
  select count(distinct owner), count(*) into threads_deleted, messages_deleted from d;

  -- Only clear side tables for owners that now have no messages at all.
  delete from public.chat_reads r
   where r.owner = any(stale)
     and not exists (select 1 from public.dev_messages m where m.owner = r.owner);
  delete from public.dev_conversations c
   where c.owner = any(stale)
     and not exists (select 1 from public.dev_messages m where m.owner = c.owner);

  return next;
end;
$$;

revoke all on function public.purge_old_chat(int) from public, anon, authenticated;

-- File-thread helpers (service_role only), used by purge-files-function.ts

create or replace function public.stale_image_threads(retain_days int default 90)
returns table (owner text, paths text[])
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if retain_days is null or retain_days < 30 then
    raise exception 'stale_image_threads: retain_days must be >= 30 (got %)', retain_days;
  end if;
  return query
    select m.owner, coalesce(array_agg(m.image_url) filter (where m.image_url is not null), '{}')
    from public.dev_messages m
    group by m.owner
    having max(m.created_at) < now() - make_interval(days => retain_days)
       and bool_or(m.image_url is not null);
end;
$$;

create or replace function public.purge_image_thread(o text, retain_days int default 90)
returns bigint
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  cutoff timestamptz;
  n bigint;
begin
  if retain_days is null or retain_days < 30 then
    raise exception 'purge_image_thread: retain_days must be >= 30 (got %)', retain_days;
  end if;
  cutoff := now() - make_interval(days => retain_days);
  with d as (
    delete from public.dev_messages m
    where m.owner = o
      and not exists (select 1 from public.dev_messages n2
                      where n2.owner = o and n2.created_at >= cutoff)
    returning 1)
  select count(*) into n from d;
  if not exists (select 1 from public.dev_messages where owner = o) then
    delete from public.chat_reads where owner = o;
    delete from public.dev_conversations where owner = o;
  end if;
  return n;
end;
$$;

revoke all on function public.stale_image_threads(int) from public, anon, authenticated;
revoke all on function public.purge_image_thread(text, int) from public, anon, authenticated;
grant execute on function public.stale_image_threads(int) to service_role;
grant execute on function public.purge_image_thread(text, int) to service_role;
