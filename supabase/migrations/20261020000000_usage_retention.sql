-- Retention: per-IP daily counters are only an abuse guard, so delete them after 30 days.
-- Monthly reading counts are kept 13 months; Premium cache rows older than 30 days are dropped.
create extension if not exists pg_cron;

select cron.schedule(
  'usage-retention',
  '17 3 * * *',
  $$
    delete from public.usage_counters
      where (key like 'ip:%' and updated_at < now() - interval '30 days')
         or (key like 'usage:%' and updated_at < now() - interval '13 months');
    delete from public.entitlement_cache where checked_at < now() - interval '30 days';
  $$
);
