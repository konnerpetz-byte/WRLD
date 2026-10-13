-- WRLD's own award price model: how many cents each point is worth against the
-- cash fare, learned from award prices travelers saved (Save to WRLD, Type it,
-- Paste) matched to the cash fare for the same flight day. Used to predict
-- dynamic-priced programs (Delta, United, American, Alaska, Southwest, JetBlue)
-- on every route WRLD has a fare for.

create table if not exists public.award_fare_observations (
  program text not null check (program ~ '^[a-z]{2,20}$'),
  origin text not null check (origin ~ '^[A-Z]{3}$'),
  destination text not null check (destination ~ '^[A-Z]{3}$'),
  travel_date date not null,
  miles integer not null check (miles between 500 and 1000000),
  fare_usd numeric(9, 2) not null check (fare_usd between 20 and 20000),
  cents_per_point numeric(6, 3) generated always as (round(fare_usd * 100 / miles, 3)) stored,
  observed_at timestamptz not null default now(),
  primary key (program, origin, destination, travel_date)
);

alter table public.award_fare_observations enable row level security;
-- No table policies: reads and writes go through the functions below.

create or replace function public.award_fare_observe(p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 200 then
    return;
  end if;
  insert into public.award_fare_observations (program, origin, destination, travel_date, miles, fare_usd)
  select r.program, r.origin, r.destination, r.travel_date, r.miles, r.fare_usd
  from jsonb_to_recordset(p_rows) as r(program text, origin text, destination text, travel_date date, miles integer, fare_usd numeric)
  where r.program in ('delta', 'united', 'american', 'alaska', 'southwest', 'jetblue')
    and r.miles between 500 and 1000000
    and r.fare_usd between 20 and 20000
    -- Throw out pairs no real program prices like this (typo or wrong match).
    and r.fare_usd * 100 / r.miles between 0.4 and 4
    and r.travel_date >= current_date
  on conflict (program, origin, destination, travel_date)
  do update set miles = excluded.miles, fare_usd = excluded.fare_usd, observed_at = now();
end;
$$;

-- Middle half of what travelers saw in the last 120 days, per program, once
-- there are at least 5 matches.
create or replace function public.award_fare_rates()
returns table (program text, low numeric, high numeric, n integer)
language sql
stable
security definer
set search_path = ''
as $$
  select o.program,
         round(percentile_cont(0.25) within group (order by o.cents_per_point)::numeric, 3),
         round(percentile_cont(0.75) within group (order by o.cents_per_point)::numeric, 3),
         count(*)::integer
  from public.award_fare_observations o
  where o.observed_at > now() - interval '120 days'
  group by o.program
  having count(*) >= 5;
$$;

revoke all on function public.award_fare_observe(jsonb) from public, anon;
revoke all on function public.award_fare_rates() from public, anon;
grant execute on function public.award_fare_observe(jsonb) to authenticated;
grant execute on function public.award_fare_rates() to authenticated;
