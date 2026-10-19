-- This week's regular gasoline prices from EIA's public weekly spreadsheet (gas-refresh worker),
-- so road trips use real prices without an EIA API key.
create table public.gas_prices (
  area text primary key check (area ~ '^[A-Z0-9]{2,5}$'), -- NUS, R20, SOH…
  week date not null,
  price numeric(6, 3) not null check (price > 0 and price < 20),
  fetched_at timestamptz not null default now()
);
alter table public.gas_prices enable row level security;
create policy "Anyone can read gas prices" on public.gas_prices for select to anon, authenticated using (true);
grant select on public.gas_prices to anon, authenticated;

create or replace function private.run_gas_refresh()
returns bigint
language sql
security definer
set search_path to ''
as $$
  select net.http_post(
    url := 'https://zzbbjhokowvmpuuzsbjq.supabase.co/functions/v1/gas-refresh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-wrld-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'award_refresh_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$;
revoke all on function private.run_gas_refresh() from public, anon, authenticated;

-- EIA posts Monday afternoon (Eastern); check Monday night and again Tuesday in case of a delay.
select cron.schedule('gas-refresh', '17 1,23 * * 1,2', 'select private.run_gas_refresh()');
