-- Real-world trip cost data for the planner.
-- cost_per_diem: U.S. government per diem rates by location and season (public domain).
--   source 'state': State Department foreign rates (monthly Excel at allowances.state.gov)
--   source 'gsa':   GSA rates for U.S. cities (api.gsa.gov, needs a free api.data.gov key)
-- Loaded by the costs-refresh Edge Function (supabase/functions/costs-refresh).
create table public.cost_per_diem (
  source text not null check (source in ('state', 'gsa')),
  location_code text not null,
  country text not null,
  location text not null,
  state text,
  season_start date not null,
  season_end date not null,
  lodging numeric(10,2) not null check (lodging >= 0),
  mie numeric(10,2) not null check (mie >= 0),
  effective date,
  source_file text not null,
  fetched_at timestamptz not null default now(),
  primary key (source, location_code, season_start)
);
create index cost_per_diem_country_idx on public.cost_per_diem (source, upper(country));
alter table public.cost_per_diem enable row level security;
create policy "Signed-in users read per diem rates" on public.cost_per_diem for select to authenticated using (true);

-- What leisure travelers really pay, as a share of per diem. Starts at WRLD's
-- assumption and is recomputed from costs travelers log on their trips.
create table public.cost_calibration (
  kind text primary key check (kind in ('lodging', 'day')),
  factor numeric(5,3) not null check (factor > 0 and factor < 3),
  default_factor numeric(5,3) not null,
  samples integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.cost_calibration enable row level security;
create policy "Signed-in users read calibration" on public.cost_calibration for select to authenticated using (true);
insert into public.cost_calibration (kind, factor, default_factor) values ('lodging', 0.55, 0.55), ('day', 0.60, 0.60);

-- Refresh log, so the worker can skip work and the admin page can show status.
create table public.cost_refresh_runs (
  id bigint generated always as identity primary key,
  source text not null,
  source_file text,
  rows integer not null default 0,
  ok boolean not null,
  note text,
  ran_at timestamptz not null default now()
);
alter table public.cost_refresh_runs enable row level security;
create policy "Admins read cost refresh runs" on public.cost_refresh_runs for select to authenticated using ((select private.is_admin()));

-- Recompute calibration from real trip costs (needs 10+ matched samples; otherwise keeps the default).
-- Matches through public.countries names, so countries missing there (or named differently) don't count yet.
create or replace function private.recompute_cost_calibration()
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  l_factor numeric; l_n integer;
  d_factor numeric; d_n integer;
begin
  -- Lodging: nightly cost in USD vs the per diem lodging for the stop's city (or the country's [Other] rate).
  with stays as (
    select l.id,
      (l.cost / nullif(greatest(1, (l.check_out_at::date - l.check_in_at::date)), 0))
        / coalesce((select r.rate from public.exchange_rates r where r.quote = l.currency order by r.as_of desc limit 1), case when l.currency = 'USD' then 1 end) as nightly_usd,
      s.city, c.name as country, l.check_in_at::date as night
    from public.lodging l
    join public.trip_stops s on s.trip_id = l.trip_id and l.check_in_at::date between coalesce(s.arrive_date, l.check_in_at::date) and coalesce(s.leave_date, l.check_in_at::date)
    join public.countries c on c.code = s.country_code
    where l.cost > 0 and l.check_in_at is not null and l.check_out_at is not null and l.points_used is null
  ),
  matched as (
    select st.nightly_usd / nullif(p.lodging, 0) as ratio
    from stays st
    cross join lateral (
      select pd.lodging from public.cost_per_diem pd
      where upper(pd.country) = upper(st.country)
        and st.night between pd.season_start and pd.season_end
        and (pd.location ilike st.city || '%' or pd.location = '[Other]')
      order by (pd.location = '[Other]'), pd.fetched_at desc
      limit 1
    ) p
    where st.nightly_usd is not null
  )
  select percentile_cont(0.5) within group (order by ratio), count(*) into l_factor, l_n
  from matched where ratio between 0.05 and 3;

  -- Day costs: food, local transit, activities per traveler per day vs per diem M&IE.
  with trip_days as (
    select e.trip_id, s.city, c.name as country, s.arrive_date, s.leave_date,
      sum(coalesce(e.amount_in_trip_currency, e.amount)) filter (where e.category in ('food', 'transit', 'activities')) as spent,
      (select count(*) from public.trip_members m where m.trip_id = e.trip_id) as people,
      greatest(1, s.leave_date - s.arrive_date + 1) as days,
      t.currency
    from public.expenses e
    join public.trips t on t.id = e.trip_id
    join public.trip_stops s on s.trip_id = e.trip_id and e.incurred_on between s.arrive_date and s.leave_date
    join public.countries c on c.code = s.country_code
    group by e.trip_id, s.id, s.city, c.name, s.arrive_date, s.leave_date, t.currency
  ),
  matched as (
    select (td.spent / nullif(coalesce((select r.rate from public.exchange_rates r where r.quote = td.currency order by r.as_of desc limit 1), case when td.currency = 'USD' then 1 end), 0))
             / nullif(td.people * td.days, 0) / nullif(p.mie, 0) as ratio
    from trip_days td
    cross join lateral (
      select pd.mie from public.cost_per_diem pd
      where upper(pd.country) = upper(td.country)
        and td.arrive_date between pd.season_start and pd.season_end
        and (pd.location ilike td.city || '%' or pd.location = '[Other]')
      order by (pd.location = '[Other]'), pd.fetched_at desc
      limit 1
    ) p
    where td.spent > 0
  )
  select percentile_cont(0.5) within group (order by ratio), count(*) into d_factor, d_n
  from matched where ratio between 0.05 and 3;

  update public.cost_calibration set
    factor = case when l_n >= 10 then round(l_factor, 3) else default_factor end,
    samples = coalesce(l_n, 0), updated_at = now()
  where kind = 'lodging';
  update public.cost_calibration set
    factor = case when d_n >= 10 then round(d_factor, 3) else default_factor end,
    samples = coalesce(d_n, 0), updated_at = now()
  where kind = 'day';
end;
$$;
revoke all on function private.recompute_cost_calibration() from public, anon, authenticated;

-- Worker call, same pattern and Vault token as the other refresh jobs.
create or replace function private.run_costs_refresh()
returns bigint
language sql
security definer
set search_path to ''
as $$
  select net.http_post(
    url := 'https://zzbbjhokowvmpuuzsbjq.supabase.co/functions/v1/costs-refresh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-wrld-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'award_refresh_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$$;
revoke all on function private.run_costs_refresh() from public, anon, authenticated;

-- Daily: the State Department posts new rates monthly; the worker skips a file it already loaded.
select cron.schedule('costs-refresh', '41 7 * * *', 'select private.run_costs_refresh()');
select cron.schedule('costs-calibrate', '11 8 * * *', 'select private.recompute_cost_calibration()');
