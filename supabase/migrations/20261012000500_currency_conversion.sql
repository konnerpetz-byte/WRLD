-- =====================================================================
-- 05 · Currency conversion
--
-- Rates: a daily scheduled job fetches USD-based rates from Frankfurter
-- (free, central-bank data, no API key) and upserts exchange_rates.
-- Every rate is "1 USD = <rate> <quote>", so any pair converts via USD.
--
-- Defaults (set in migration 02):
--   * user's home currency  ← country they signed up from (fallback USD)
--   * trip currency         ← destination country (fallback home currency)
--
-- Expenses keep the amount in the currency actually paid, plus a
-- snapshot converted into the trip currency at that day's rate, so the
-- trip budget doesn't drift as rates move.
-- =====================================================================

create table public.exchange_rates (
  quote       text not null references public.currencies (code),
  as_of       date not null,
  rate        numeric(20, 10) not null check (rate > 0),             -- 1 USD = rate × quote
  source      text not null default 'frankfurter',
  fetched_at  timestamptz not null default now(),
  primary key (quote, as_of)
);

alter table public.exchange_rates enable row level security;
create policy "rates: anyone reads" on public.exchange_rates
  for select to anon, authenticated using (true);

-- USD → code rate on (or most recently before) a date.
create or replace function private.usd_rate(p_code text, p_on date)
returns numeric
language sql
stable
set search_path = ''
as $$
  select case
    when p_code = 'USD' then 1::numeric
    else (
      select r.rate from public.exchange_rates r
      where r.quote = p_code and r.as_of <= p_on
      order by r.as_of desc
      limit 1
    )
  end;
$$;

-- convert_currency(25, 'EUR', 'USD') → amount in USD, rounded for the
-- target currency (0 decimals for JPY, etc.). Returns null if a rate is missing.
-- Callable from the app: supabase.rpc('convert_currency', {...})
create or replace function public.convert_currency(
  p_amount numeric,
  p_from   text,
  p_to     text,
  p_on     date default current_date
)
returns numeric
language sql
stable
set search_path = ''
as $$
  select case
    when p_amount is null then null
    when p_from = p_to then p_amount
    else round(
      p_amount / private.usd_rate(p_from, p_on) * private.usd_rate(p_to, p_on),
      (select c.minor_units from public.currencies c where c.code = p_to)
    )
  end;
$$;

grant execute on function private.usd_rate(text, date) to anon, authenticated;
grant execute on function public.convert_currency(numeric, text, text, date) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Expense snapshot in trip currency
-- ---------------------------------------------------------------------
alter table public.expenses
  add column amount_in_trip_currency numeric(12, 2),
  add column fx_rate                 numeric(20, 10);   -- 1 unit paid = fx_rate trip-currency units

create or replace function private.snapshot_expense_fx()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip_currency text;
begin
  select t.currency into v_trip_currency from public.trips t where t.id = new.trip_id;

  if new.currency = v_trip_currency then
    new.fx_rate := 1;
    new.amount_in_trip_currency := new.amount;
  else
    new.fx_rate := private.usd_rate(v_trip_currency, new.incurred_on)
                 / private.usd_rate(new.currency, new.incurred_on);
    new.amount_in_trip_currency := round(new.amount * new.fx_rate, 2);
    -- Both stay null if a rate is missing; the nightly rate job backfills them.
  end if;
  return new;
end;
$$;

create trigger snapshot_expense_fx
  before insert or update of amount, currency, incurred_on on public.expenses
  for each row execute function private.snapshot_expense_fx();

-- Budget totals (planned + spent) live in migration 07.
