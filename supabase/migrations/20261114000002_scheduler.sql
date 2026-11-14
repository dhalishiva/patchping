-- Scheduler: pg_cron calls the scan and notify edge functions every 6 hours.
-- The shared secret is generated inside the database and never leaves it
-- (only the service role and pg_cron can read app_config).

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table public.app_config (
  key text primary key,
  value text not null
);
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;

insert into public.app_config (key, value)
values ('cron_secret', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

create or replace function public.call_edge_function(fn text)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select net.http_post(
    url := 'https://vswctqwxvesjripvwsex.supabase.co/functions/v1/' || fn,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from public.app_config where key = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$$;
revoke execute on function public.call_edge_function(text) from public, anon, authenticated;

select cron.schedule('patchping-scan', '0 */6 * * *', $$select public.call_edge_function('scan')$$);
select cron.schedule('patchping-notify', '20 */6 * * *', $$select public.call_edge_function('notify')$$);
select cron.schedule('patchping-cleanup', '40 3 * * *',
  $$delete from public.scan_runs where started_at < now() - interval '30 days'$$);
