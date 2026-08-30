-- Notably initial schema.

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text,
  plan text not null default 'free',
  credits integer not null default 20,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null default 'Untitled note',
  body text not null default '',
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists notes_user_id_idx on public.notes (user_id);

alter table public.users enable row level security;
alter table public.notes enable row level security;

create policy "users read own row"
  on public.users for select
  using (auth.uid() = id);

create policy "users update own row"
  on public.users for update
  using (auth.uid() = id);

create policy "notes are readable by owner"
  on public.notes for select
  using (auth.uid() = user_id);

create policy "notes are insertable by owner"
  on public.notes for insert
  with check (auth.uid() = user_id);

create policy "notes are updatable by owner"
  on public.notes for update
  using (auth.uid() = user_id);

create policy "notes are deletable by owner"
  on public.notes for delete
  using (auth.uid() = user_id);
