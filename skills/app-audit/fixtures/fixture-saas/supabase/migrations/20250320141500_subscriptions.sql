-- Stripe subscription mirror.

create table if not exists public.subscriptions (
  id text primary key,                       -- Stripe subscription id
  user_id uuid not null references public.users (id) on delete cascade,
  stripe_customer_id text not null,
  price_id text not null,
  status text not null,                      -- active | past_due | canceled ...
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists subscriptions_user_id_idx
  on public.subscriptions (user_id);

alter table public.subscriptions enable row level security;

create policy "subscriptions readable by owner"
  on public.subscriptions for select
  using (auth.uid() = user_id);

create table if not exists public.credit_ledger (
  id bigserial primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  delta integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists credit_ledger_user_id_idx
  on public.credit_ledger (user_id);

alter table public.credit_ledger enable row level security;

create policy "ledger readable by owner"
  on public.credit_ledger for select
  using (auth.uid() = user_id);
