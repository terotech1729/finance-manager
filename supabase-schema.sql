-- Personal Finance Manager — Supabase schema
-- Run this once in the Supabase dashboard → SQL Editor → New query → Run.
-- It creates a single per-user JSON blob table with row-level security so each
-- signed-in user can only read/write their OWN row.

create table if not exists public.finance_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.finance_data enable row level security;

-- Each user can only see and modify their own row.
drop policy if exists "own row select" on public.finance_data;
create policy "own row select" on public.finance_data
  for select using (auth.uid() = user_id);

drop policy if exists "own row insert" on public.finance_data;
create policy "own row insert" on public.finance_data
  for insert with check (auth.uid() = user_id);

drop policy if exists "own row update" on public.finance_data;
create policy "own row update" on public.finance_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
