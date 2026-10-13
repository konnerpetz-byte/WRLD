-- =====================================================================
-- Award engine, part 1: the cache, its history, the route planner and
-- the demand log. Data sources plug in through the award-refresh worker
-- (Edge Function); nothing here depends on which source is used.
-- See docs/AWARD-ENGINE.md.
-- =====================================================================

-- One row per seat offer: route, date, program and cabin, from one data source.
create table public.award_availability (
  id            bigint generated always as identity primary key,
  origin        text not null check (origin ~ '^[A-Z]{3}$'),
  destination   text not null check (destination ~ '^[A-Z]{3}$'),
  travel_date   date not null,
  program       text not null check (program ~ '^[a-z0-9_]{2,40}$'),
  cabin         text not null check (cabin in ('economy', 'premium', 'business', 'first')),
  miles         integer not null check (miles > 0 and miles < 2000000),
  taxes         numeric(10, 2) check (taxes is null or taxes >= 0),
  tax_currency  text check (tax_currency is null or tax_currency ~ '^[A-Z]{3}$'),
  seats         smallint check (seats is null or seats between 0 and 99),
  airlines      text not null default '' check (length(airlines) <= 80),
  direct        boolean not null default false,
  data_source   text not null check (data_source ~ '^[a-z0-9_]{2,40}$'),
  first_seen_at timestamptz not null default now(),
  seen_at       timestamptz not null default now(),
  -- Set when the source stops showing the seat; cleared if it comes back.
  closed_at     timestamptz,
  unique (data_source, origin, destination, travel_date, program, cabin)
);
create index award_availability_explore on public.award_availability (origin, cabin, travel_date, destination) where closed_at is null;
comment on table public.award_availability is 'Award seat cache. Written only by the award-refresh worker; read by the Points explorer.';

-- What changed at each refresh, for alerts ("opened today") and price history.
create table public.award_availability_history (
  id             bigint generated always as identity primary key,
  origin         text not null,
  destination    text not null,
  travel_date    date not null,
  program        text not null,
  cabin          text not null,
  data_source    text not null,
  change         text not null check (change in ('opened', 'cheaper', 'pricier', 'closed')),
  miles          integer,
  previous_miles integer,
  seats          smallint,
  observed_at    timestamptz not null default now()
);
create index award_history_route on public.award_availability_history (origin, destination, cabin, observed_at desc);

-- Route planner: which routes to refresh, and how often.
create table public.award_routes (
  origin            text not null check (origin ~ '^[A-Z]{3}$'),
  destination       text not null check (destination ~ '^[A-Z]{3}$'),
  cabin             text not null check (cabin in ('economy', 'premium', 'business', 'first')),
  demand            numeric not null default 0,
  refresh_every     interval not null default interval '1 day',
  next_check_at     timestamptz not null default now(),
  last_checked_at   timestamptz,
  last_result_count integer,
  requested_at      timestamptz,
  primary key (origin, destination, cabin),
  check (origin <> destination)
);
create index award_routes_due on public.award_routes (next_check_at);

-- Demand signal: every explorer search.
create table public.award_searches (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  origin       text not null check (origin ~ '^[A-Z]{3}$'),
  destinations text[] not null check (cardinality(destinations) between 1 and 60),
  cabin        text not null check (cabin in ('economy', 'premium', 'business', 'first')),
  month        date not null,
  via          text check (via is null or length(via) <= 60),
  created_at   timestamptz not null default now()
);
create index award_searches_recent on public.award_searches (created_at desc);
create index award_searches_user on public.award_searches (user_id);

-- ---------------------------------------------------------------------
-- Access: seat data is shared market data (read-only for signed-in
-- people); routes are worker-only; searches belong to their author.
-- ---------------------------------------------------------------------
alter table public.award_availability enable row level security;
alter table public.award_availability_history enable row level security;
alter table public.award_routes enable row level security;
alter table public.award_searches enable row level security;

revoke all on public.award_availability, public.award_availability_history, public.award_routes, public.award_searches from anon;
revoke all on public.award_availability, public.award_availability_history, public.award_routes, public.award_searches from authenticated;
grant select on public.award_availability, public.award_availability_history to authenticated;
grant select, insert on public.award_searches to authenticated;

create policy "signed-in people read seats" on public.award_availability for select to authenticated using (true);
create policy "signed-in people read seat history" on public.award_availability_history for select to authenticated using (true);
create policy "log my own searches" on public.award_searches for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "see my own searches" on public.award_searches for select to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- Explorer → planner. Adds routes nobody has asked for yet (checked within
-- minutes), marks existing ones as wanted, and reports which destinations
-- the cache has already covered so the explorer knows what it can trust.
-- ---------------------------------------------------------------------
create function public.request_award_routes(p_origin text, p_destinations text[], p_cabin text)
returns table (destination text, checked_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if p_origin !~ '^[A-Z]{3}$' or p_cabin not in ('economy', 'premium', 'business', 'first')
     or cardinality(p_destinations) not between 1 and 60 then
    raise exception 'Invalid route request' using errcode = '22023';
  end if;

  insert into public.award_routes as r (origin, destination, cabin, requested_at, next_check_at, refresh_every)
  select distinct p_origin, d, p_cabin, now(), now(), interval '1 day'
  from unnest(p_destinations) as d
  where d ~ '^[A-Z]{3}$' and d <> p_origin
  on conflict (origin, destination, cabin) do update
    set requested_at = now(),
        next_check_at = case when r.last_checked_at is null then least(r.next_check_at, now()) else r.next_check_at end;

  return query
  select r.destination, r.last_checked_at
  from public.award_routes r
  where r.origin = p_origin and r.cabin = p_cabin and r.destination = any (p_destinations);
end;
$$;
revoke execute on function public.request_award_routes(text, text[], text) from public, anon;
grant execute on function public.request_award_routes(text, text[], text) to authenticated;

-- ---------------------------------------------------------------------
-- Worker API (service role only).
-- ---------------------------------------------------------------------

-- Hand the worker the routes that are due, leasing them for 10 minutes
-- so two runs never fetch the same route.
create function public.claim_award_routes(p_limit integer default 20)
returns table (origin text, destination text, cabin text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select r.origin, r.destination, r.cabin
    from public.award_routes r
    where r.next_check_at <= now()
    order by r.requested_at desc nulls last, r.demand desc, r.next_check_at
    limit greatest(1, least(p_limit, 100))
    for update skip locked
  )
  update public.award_routes r
     set next_check_at = now() + interval '10 minutes'
    from due
   where r.origin = due.origin and r.destination = due.destination and r.cabin = due.cabin
  returning r.origin, r.destination, r.cabin;
end;
$$;

-- Normalized incoming rows: one per program and date (the cheapest), valid values only.
create function private.award_incoming(p_rows jsonb, p_start date, p_end date)
returns table (travel_date date, program text, miles integer, taxes numeric, tax_currency text, seats smallint, airlines text, direct boolean)
language sql
immutable
set search_path = ''
as $$
  select distinct on (r.program, r.travel_date)
         r.travel_date, r.program, r.miles, r.taxes, upper(r.tax_currency),
         least(greatest(r.seats, 0), 99)::smallint, left(coalesce(r.airlines, ''), 80), coalesce(r.direct, false)
  from jsonb_to_recordset(p_rows) as r(travel_date date, program text, miles integer, taxes numeric, tax_currency text, seats integer, airlines text, direct boolean)
  where r.travel_date between p_start and p_end
    and r.miles > 0 and r.miles < 2000000
    and r.program ~ '^[a-z0-9_]{2,40}$'
    and (r.tax_currency is null or upper(r.tax_currency) ~ '^[A-Z]{3}$')
  order by r.program, r.travel_date, r.miles
$$;
revoke execute on function private.award_incoming(jsonb, date, date) from public, anon, authenticated;

-- Store one fetched batch for a route and cabin over a date window:
-- records what opened, got cheaper or pricier, or closed; then upserts.
-- Closed seats are marked (closed_at), not removed, so they can reopen.
create function public.ingest_award_batch(
  p_source text, p_origin text, p_destination text, p_cabin text,
  p_start date, p_end date, p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start date := greatest(p_start, current_date);
  v_opened integer := 0;
  v_changed integer := 0;
  v_closed integer := 0;
  v_total integer := 0;
begin
  if p_source !~ '^[a-z0-9_]{2,40}$' or p_origin !~ '^[A-Z]{3}$' or p_destination !~ '^[A-Z]{3}$'
     or p_cabin not in ('economy', 'premium', 'business', 'first') or p_end < p_start
     or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 5000 then
    raise exception 'Invalid batch' using errcode = '22023';
  end if;

  insert into public.award_availability_history (origin, destination, travel_date, program, cabin, data_source, change, miles, seats)
  select p_origin, p_destination, i.travel_date, i.program, p_cabin, p_source, 'opened', i.miles, i.seats
  from private.award_incoming(p_rows, v_start, p_end) i
  where not exists (
    select 1 from public.award_availability a
    where a.data_source = p_source and a.origin = p_origin and a.destination = p_destination
      and a.cabin = p_cabin and a.program = i.program and a.travel_date = i.travel_date
      and a.closed_at is null);
  get diagnostics v_opened = row_count;

  insert into public.award_availability_history (origin, destination, travel_date, program, cabin, data_source, change, miles, previous_miles, seats)
  select p_origin, p_destination, i.travel_date, i.program, p_cabin, p_source,
         case when i.miles < a.miles then 'cheaper' else 'pricier' end, i.miles, a.miles, i.seats
  from private.award_incoming(p_rows, v_start, p_end) i
  join public.award_availability a
    on a.data_source = p_source and a.origin = p_origin and a.destination = p_destination
   and a.cabin = p_cabin and a.program = i.program and a.travel_date = i.travel_date
  where a.miles <> i.miles and a.closed_at is null;
  get diagnostics v_changed = row_count;

  with incoming as (select * from private.award_incoming(p_rows, v_start, p_end)),
  gone as (
    update public.award_availability a set closed_at = now()
    where a.data_source = p_source and a.origin = p_origin and a.destination = p_destination
      and a.cabin = p_cabin and a.travel_date between v_start and p_end and a.closed_at is null
      and not exists (select 1 from incoming i where i.program = a.program and i.travel_date = a.travel_date)
    returning a.travel_date, a.program, a.miles
  )
  insert into public.award_availability_history (origin, destination, travel_date, program, cabin, data_source, change, previous_miles)
  select p_origin, p_destination, g.travel_date, g.program, p_cabin, p_source, 'closed', g.miles from gone g;
  get diagnostics v_closed = row_count;

  insert into public.award_availability as a
    (origin, destination, travel_date, program, cabin, miles, taxes, tax_currency, seats, airlines, direct, data_source)
  select p_origin, p_destination, i.travel_date, i.program, p_cabin, i.miles, i.taxes, i.tax_currency, i.seats, i.airlines, i.direct, p_source
  from private.award_incoming(p_rows, v_start, p_end) i
  on conflict (data_source, origin, destination, travel_date, program, cabin) do update
    set miles = excluded.miles, taxes = excluded.taxes, tax_currency = excluded.tax_currency,
        seats = excluded.seats, airlines = excluded.airlines, direct = excluded.direct, seen_at = now(),
        closed_at = null,
        first_seen_at = case when a.closed_at is not null then now() else a.first_seen_at end;
  get diagnostics v_total = row_count;

  update public.award_routes
     set last_checked_at = now(), last_result_count = v_total, next_check_at = now() + refresh_every
   where origin = p_origin and destination = p_destination and cabin = p_cabin;

  return jsonb_build_object('seats', v_total, 'opened', v_opened, 'changed', v_changed, 'closed', v_closed);
end;
$$;

-- When a source fails, try that route again later instead of every run.
create function public.defer_award_route(p_origin text, p_destination text, p_cabin text, p_minutes integer default 60)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.award_routes
     set next_check_at = now() + make_interval(mins => greatest(5, least(p_minutes, 1440)))
   where origin = p_origin and destination = p_destination and cabin = p_cabin;
$$;

revoke execute on function public.claim_award_routes(integer) from public, anon, authenticated;
revoke execute on function public.ingest_award_batch(text, text, text, text, date, date, jsonb) from public, anon, authenticated;
revoke execute on function public.defer_award_route(text, text, text, integer) from public, anon, authenticated;
grant execute on function public.claim_award_routes(integer) to service_role;
grant execute on function public.ingest_award_batch(text, text, text, text, date, date, jsonb) to service_role;
grant execute on function public.defer_award_route(text, text, text, integer) to service_role;

-- ---------------------------------------------------------------------
-- Planner: turn searches into demand and refresh intervals; tidy up.
-- Runs hourly from pg_cron.
-- ---------------------------------------------------------------------
create function private.plan_award_routes()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Demand: recent searches count most (one-week half-life), last 30 days.
  with recent as (
    select s.origin, d as destination, s.cabin,
           sum(power(0.5, extract(epoch from (now() - s.created_at)) / 604800.0)) as demand
    from public.award_searches s, unnest(s.destinations) as d
    where s.created_at > now() - interval '30 days' and d <> s.origin
    group by 1, 2, 3
  )
  insert into public.award_routes as r (origin, destination, cabin, demand, next_check_at)
  select origin, destination, cabin, demand, now() from recent
  on conflict (origin, destination, cabin) do update set demand = excluded.demand;

  -- Routes nobody searched lately lose their demand.
  update public.award_routes r set demand = 0
  where r.demand > 0 and not exists (
    select 1 from public.award_searches s
    where s.origin = r.origin and s.cabin = r.cabin and r.destination = any (s.destinations)
      and s.created_at > now() - interval '30 days');

  -- Busy routes refresh often; quiet ones rarely.
  update public.award_routes set refresh_every = case
      when demand >= 5 then interval '1 hour'
      when demand >= 1 then interval '6 hours'
      when demand > 0 or requested_at > now() - interval '14 days' then interval '1 day'
      else interval '7 days'
    end
  where refresh_every is distinct from case
      when demand >= 5 then interval '1 hour'
      when demand >= 1 then interval '6 hours'
      when demand > 0 or requested_at > now() - interval '14 days' then interval '1 day'
      else interval '7 days'
    end;

  -- Past dates are filtered out on read (travel_date >= today). Purge old rows
  -- from the dashboard when storage matters: past travel dates, history older
  -- than 180 days, and routes with no demand for 60 days.
end;
$$;
revoke execute on function private.plan_award_routes() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Schedule: pg_cron calls the award-refresh Edge Function every 15
-- minutes with a token kept in Vault; the planner runs hourly.
-- ---------------------------------------------------------------------
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'award_refresh_token', 'pg_cron -> award-refresh edge function');

create function public.award_cron_token_ok(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'award_refresh_token' and decrypted_secret = p_token
  );
$$;
revoke execute on function public.award_cron_token_ok(text) from public, anon, authenticated;
grant execute on function public.award_cron_token_ok(text) to service_role;

create function private.run_award_refresh()
returns bigint
language sql
security definer
set search_path = ''
as $$
  select net.http_post(
    url := 'https://zzbbjhokowvmpuuzsbjq.supabase.co/functions/v1/award-refresh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-wrld-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'award_refresh_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$;
revoke execute on function private.run_award_refresh() from public, anon, authenticated;

select cron.schedule('award-refresh', '*/15 * * * *', $$select private.run_award_refresh()$$);
select cron.schedule('award-plan-routes', '7 * * * *', $$select private.plan_award_routes()$$);
