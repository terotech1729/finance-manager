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


-- ---------------------------------------------------------------------------
-- Card intelligence: daily scan output
-- ---------------------------------------------------------------------------
-- Card terms move constantly — issuers devalue rewards, raise lounge gates and
-- withdraw milestones, usually with a month's notice. Those terms live in
-- src/lib/cards.ts, which is compiled into the bundle, so keeping up used to mean
-- a code change and a redeploy every time.
--
-- These three tables move card facts to runtime:
--   scan_runs    — one row per scan, so you can see when it last ran and why it failed
--   card_intel   — what the scan found: proposed term changes, new-card candidates
--   card_overlay — accepted changes, merged over the compiled catalogue at load
--
-- The split between card_intel and card_overlay is deliberate. A scan is a language
-- model reading the web; it can be wrong. Nothing it finds touches the scoring engine
-- until it lands in card_overlay, which happens either by your approval or — for
-- changes that can't alter a recommendation — automatically.

create table if not exists public.scan_runs (
  id          bigint generated always as identity primary key,
  kind        text not null,                      -- 'terms' | 'portfolio'
  status      text not null default 'running',    -- running | ok | error
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  model       text,
  cards_scanned int,
  findings    int,
  error       text
);

create index if not exists scan_runs_started_idx on public.scan_runs (started_at desc);

create table if not exists public.card_intel (
  id             bigint generated always as identity primary key,
  -- Catalogue id for a card you hold, or a slug like "hdfc-infinia" for one you don't.
  card_id        text not null,
  card_name      text,
  kind           text not null,                   -- term_change | new_card | drop_suggestion
  -- proposed → waiting on you; applied → in card_overlay; rejected → dismissed;
  -- advisory → informational only, never touches the overlay.
  status         text not null default 'proposed',
  direction      text,                            -- devaluation | revaluation | neutral
  -- The Card field this would patch (e.g. "forexPct"). Null for advisory findings.
  field          text,
  current_value  text,
  proposed_value text,
  summary        text not null,
  detail         text,
  effective_on   date,
  -- [{ "title": ..., "url": ..., "issuer": true }]
  sources        jsonb not null default '[]'::jsonb,
  confidence     text not null default 'medium',  -- high | medium | low
  scan_run_id    bigint references public.scan_runs (id) on delete set null,
  -- Lets a re-scan recognise a finding it already reported instead of duplicating it.
  fingerprint    text unique,
  created_at     timestamptz not null default now(),
  decided_at     timestamptz
);

create index if not exists card_intel_status_idx on public.card_intel (status, created_at desc);

create table if not exists public.card_overlay (
  card_id    text primary key,
  -- Partial Card object merged over the compiled catalogue entry, e.g.
  -- { "forexPct": 1.99, "loungeRule": "2 domestic/yr" }.
  patch      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.scan_runs   enable row level security;
alter table public.card_intel  enable row level security;
alter table public.card_overlay enable row level security;

-- Card terms are public facts, not personal data — unlike finance_data, there is
-- nothing here worth hiding from a signed-in session. Reads are open; writes are
-- not, because the scan runs server-side with the service-role key, which bypasses
-- RLS. The one exception is card_intel updates, so you can accept or reject a
-- proposal straight from the browser.
drop policy if exists "intel read" on public.card_intel;
create policy "intel read" on public.card_intel
  for select to anon, authenticated using (true);

drop policy if exists "intel decide" on public.card_intel;
create policy "intel decide" on public.card_intel
  for update to authenticated using (true) with check (true);

drop policy if exists "overlay read" on public.card_overlay;
create policy "overlay read" on public.card_overlay
  for select to anon, authenticated using (true);

drop policy if exists "scan runs read" on public.scan_runs;
create policy "scan runs read" on public.scan_runs
  for select to anon, authenticated using (true);

grant select on public.card_overlay, public.scan_runs to anon, authenticated;
grant select, update on public.card_intel to anon, authenticated;
