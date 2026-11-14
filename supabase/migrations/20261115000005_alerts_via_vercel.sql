-- Alert emails now go out from a Vercel function (Microsoft 365 SMTP on port 587,
-- which Supabase Edge Functions cannot reach). Same schedule, same secret.
create or replace function public.call_alert_sender()
returns bigint
language sql
security definer
set search_path = ''
as $$
  select net.http_post(
    url := 'https://patchping.vercel.app/api/send-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from public.app_config where key = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
$$;
revoke execute on function public.call_alert_sender() from public, anon, authenticated;

select cron.unschedule('patchping-notify');
select cron.schedule('patchping-notify', '20 */6 * * *', $$select public.call_alert_sender()$$);
