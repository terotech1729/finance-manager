-- Checks that supabase-schema.sql grants the keep-alive heartbeat exactly the reach
-- it needs and nothing more: anon may write a heartbeat and prune stale rows, but
-- cannot wipe recent history and cannot see finance_data.
--
-- Run against a throwaway Postgres (nothing here touches your real project):
--   docker run --rm -d --name kapg -e POSTGRES_PASSWORD=x \
--     -v "$PWD:/work" postgres:16-alpine
--   sleep 8 && docker exec kapg psql -U postgres -q -f /work/scripts/keepalive-rls-check.sql
--   docker rm -f kapg

\set ON_ERROR_STOP on

-- Supabase supplies these; a vanilla Postgres doesn't.
create role anon nologin;
create role authenticated nologin;
grant usage on schema public to anon, authenticated;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;

-- Apply the real schema, unedited.
\i /work/supabase-schema.sql

-- One stale row and one fresh row, inserted as owner so RLS doesn't apply.
insert into public.keepalive (pinged_at, source) values (now() - interval '30 days', 'stale');
insert into public.keepalive (pinged_at, source) values (now(), 'recent');

set role anon;

\echo '--- anon can write a heartbeat (expect 3 rows) ---'
insert into public.keepalive (source) values ('github-actions');
select count(*) as rows_visible_to_anon from public.keepalive;

\echo '--- prune drops only rows older than 14 days (expect stale gone) ---'
delete from public.keepalive where pinged_at < now() - interval '14 days';
select source from public.keepalive order by pinged_at;

\echo '--- an unqualified delete cannot wipe recent rows (expect 2 left) ---'
delete from public.keepalive;
select count(*) as rows_left from public.keepalive;

-- Either outcome is a pass: hosted Supabase grants anon SELECT and lets RLS return
-- nothing, while a vanilla Postgres has no grant at all and refuses outright.
\echo '--- anon still cannot read finance_data ---'
do $$
declare n bigint;
begin
  select count(*) into n from public.finance_data;
  raise notice 'readable rows: % (0 = RLS blocked it)', n;
exception when insufficient_privilege then
  raise notice 'permission denied (no grant at all)';
end $$;

reset role;
\echo '--- done ---'
