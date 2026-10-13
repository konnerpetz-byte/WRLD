-- Daily exchange rates (fx-refresh edge function, ECB data via Frankfurter).
create or replace function private.run_fx_refresh()
returns bigint
language sql
security definer
set search_path = ''
as $$
  select net.http_post(
    url := 'https://zzbbjhokowvmpuuzsbjq.supabase.co/functions/v1/fx-refresh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-wrld-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'award_refresh_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
$$;
revoke all on function private.run_fx_refresh() from public, anon, authenticated;

-- ECB publishes around 16:00 CET; run after that, and again in the morning in case one fails.
select cron.schedule('fx-refresh', '23 16,6 * * *', $$select private.run_fx_refresh()$$);
