-- Counters for free-tier quota (usage:<app_user_id>:<YYYY-MM>) and per-IP daily limits (ip:<ip>:<YYYY-MM-DD>).
-- No dream text is ever stored server-side.
create table if not exists public.usage_counters (
  key text primary key,
  count integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.entitlement_cache (
  app_user_id text primary key,
  active boolean not null,
  checked_at timestamptz not null default now()
);

-- Only the edge function (service role) touches these; RLS on with no policies blocks public access.
alter table public.usage_counters enable row level security;
alter table public.entitlement_cache enable row level security;

create or replace function public.increment_usage(p_key text)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.usage_counters (key, count) values (p_key, 1)
  on conflict (key) do update set count = usage_counters.count + 1, updated_at = now()
  returning count;
$$;

revoke all on function public.increment_usage(text) from public, anon, authenticated;
