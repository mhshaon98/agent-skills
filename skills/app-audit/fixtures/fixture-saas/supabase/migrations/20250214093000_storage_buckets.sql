-- Storage buckets for Notably.
--
-- note-attachments : PRIVATE. User-uploaded files attached to a note.
-- brand-assets     : PUBLIC. Marketing logos and wordmarks only (see
--                    supabase/storage/brand-assets/MANIFEST.md). No user data
--                    is ever written to this bucket; uploads are done by hand
--                    by the founder from the Supabase dashboard.

insert into storage.buckets (id, name, public, file_size_limit)
values ('note-attachments', 'note-attachments', false, 26214400)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit)
values ('brand-assets', 'brand-assets', true, 5242880)
on conflict (id) do nothing;

create policy "attachment objects readable by owner"
  on storage.objects for select
  using (
    bucket_id = 'note-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "attachment objects writable by owner"
  on storage.objects for insert
  with check (
    bucket_id = 'note-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "brand assets are world readable"
  on storage.objects for select
  using (bucket_id = 'brand-assets');

-- Metadata sidecar so we can list a note's attachments without hitting the
-- storage API on every render.
create table if not exists public.note_attachments (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  byte_size bigint not null,
  content_type text,
  created_at timestamptz not null default now()
);

create index if not exists note_attachments_note_id_idx
  on public.note_attachments (note_id);

-- FIXME(nbly-198): tidy up this table's grants the way we did for notes.
-- Ran out of time in this PR.
