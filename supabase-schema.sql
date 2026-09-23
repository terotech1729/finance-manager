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


-- ---------------------------------------------------------------------------
-- Keep-alive heartbeat
-- ---------------------------------------------------------------------------
-- Supabase pauses a free project after 7 days without database activity. The app
-- only talks to Supabase while a signed-in tab is open, so a quiet week is enough
-- to get the project paused even though you're still using the portal locally.
--
-- A scheduled job writes one row here every day and deletes anything older than a
-- fortnight, which is real database traffic that cannot grow unbounded. The table
-- holds nothing but timestamps.

create table if not exists public.keepalive (
  id        bigint generated always as identity primary key,
  pinged_at timestamptz not null default now(),
  source    text
);

create index if not exists keepalive_pinged_at_idx on public.keepalive (pinged_at);

alter table public.keepalive enable row level security;

-- Deliberately open to the anon role, unlike finance_data. Two reasons this is
-- safe: the table contains only timestamps, and the anon key is already public in
-- the browser bundle. Worst case someone adds junk rows, which the prune below
-- clears out. Grant nothing else to anon.
drop policy if exists "keepalive insert" on public.keepalive;
create policy "keepalive insert" on public.keepalive
  for insert to anon, authenticated with check (true);

drop policy if exists "keepalive select" on public.keepalive;
create policy "keepalive select" on public.keepalive
  for select to anon, authenticated using (true);

-- Deletes are limited to rows that are already stale, so a caller can prune but
-- can't wipe the recent history you'd use to check the heartbeat is running.
drop policy if exists "keepalive prune" on public.keepalive;
create policy "keepalive prune" on public.keepalive
  for delete to anon, authenticated using (pinged_at < now() - interval '14 days');

-- Policies decide which rows are visible; grants decide whether the role may touch
-- the table at all. Stated explicitly rather than relying on default privileges.
grant select, insert, delete on public.keepalive to anon, authenticated;
