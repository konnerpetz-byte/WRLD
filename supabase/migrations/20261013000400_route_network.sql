-- =====================================================================
-- Route network: who flies nonstop where, read from each airport's
-- "Airlines and destinations" list on Wikipedia (CC BY-SA, via the
-- official API) and resolved to airport codes through Wikidata.
-- Lets award estimates apply only where a partner actually flies.
-- =====================================================================
create table public.airport_routes (
  origin      text not null check (origin ~ '^[A-Z]{3}$'),
  destination text not null check (destination ~ '^[A-Z]{3}$'),
  airline     text not null check (length(airline) between 2 and 80),
  seasonal    boolean not null default false,
  source      text not null default 'wikipedia',
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  primary key (origin, destination, airline),
  check (origin <> destination)
);
create index airport_routes_dest on public.airport_routes (destination);

-- Airports whose route lists the worker refreshes (weekly).
create table public.route_airports (
  code            text primary key check (code ~ '^[A-Z]{3}$'),
  next_check_at   timestamptz not null default now(),
  last_checked_at timestamptz,
  last_count      integer,
  last_error      text
);

alter table public.airport_routes enable row level security;
alter table public.route_airports enable row level security;
revoke all on public.airport_routes, public.route_airports from anon, authenticated;
grant select on public.airport_routes to authenticated;
create policy "routes: signed-in people read" on public.airport_routes for select to authenticated using (true);

-- Hand the worker airports that are due, leased for 15 minutes.
create function public.claim_route_airports(p_limit integer default 8)
returns setof text
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select a.code from public.route_airports a
    where a.next_check_at <= now()
    order by a.next_check_at
    limit greatest(1, least(p_limit, 25))
    for update skip locked
  )
  update public.route_airports a set next_check_at = now() + interval '15 minutes'
  from due where a.code = due.code
  returning a.code;
end;
$$;

create function public.finish_route_airport(p_code text, p_count integer, p_error text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.route_airports
     set last_checked_at = now(), last_count = p_count, last_error = left(p_error, 300),
         next_check_at = now() + case when p_error is null then interval '7 days' else interval '1 day' end
   where code = p_code;
$$;

-- Origins people care about join the list automatically.
create function private.plan_route_airports()
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.route_airports (code)
  select distinct code from (
    select s.origin as code from public.award_searches s where s.created_at > now() - interval '60 days'
    union select upper(p.home_airport) from public.profiles p where p.home_airport ~* '^[A-Z]{3}$'
    union select r.origin from public.award_routes r where r.requested_at > now() - interval '60 days'
  ) x
  where code ~ '^[A-Z]{3}$'
  on conflict (code) do nothing;
$$;

revoke execute on function public.claim_route_airports(integer) from public, anon, authenticated;
revoke execute on function public.finish_route_airport(text, integer, text) from public, anon, authenticated;
revoke execute on function private.plan_route_airports() from public, anon, authenticated;
grant execute on function public.claim_route_airports(integer) to service_role;
grant execute on function public.finish_route_airport(text, integer, text) to service_role;

-- Cache: Wikipedia article title → airport code (resolved through Wikidata).
create table public.wiki_airport_titles (
  title       text primary key check (length(title) between 1 and 300),
  iata        text check (iata is null or iata ~ '^[A-Z]{3}$'),
  resolved_at timestamptz not null default now()
);
alter table public.wiki_airport_titles enable row level security;
revoke all on public.wiki_airport_titles from anon, authenticated;

-- Airports to start with: the explorer's regions plus the big connection hubs.
insert into public.route_airports (code)
select unnest(array[
  'LHR','CDG','AMS','FRA','MUC','MAD','BCN','LIS','FCO','ATH','DUB','ZRH','VIE','CPH','IST','EDI','MXP','PRG',
  'HND','NRT','KIX','ICN','TPE','HKG','SIN','BKK','MNL','DEL','CUN','MEX','SJD','SJU','PUJ','LIR','BOG','LIM','GRU','EZE','SCL',
  'DXB','DOH','AUH','TLV','CAI','CPT','JNB','NBO','RAK','SYD','MEL','BNE','AKL','HNL','NAN','PPT',
  'JFK','LAX','SFO','ORD','MIA','BOS','SEA','DEN','LAS','MCO','YYZ','YVR','ATL','DFW','IAD','DTW',
  'EWR','IAH','MSP','PHL','CLT','SLC','YUL','YYC','PHX','BRU','ARN','HEL','OSL','WAW','LGW','ADD','PTY'
]) on conflict (code) do nothing;

create function private.run_routes_refresh()
returns bigint
language sql
security definer
set search_path = ''
as $$
  select net.http_post(
    url := 'https://zzbbjhokowvmpuuzsbjq.supabase.co/functions/v1/routes-refresh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-wrld-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'award_refresh_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 140000
  );
$$;
revoke execute on function private.run_routes_refresh() from public, anon, authenticated;

select cron.schedule('routes-refresh', '*/10 * * * *', $$select private.run_routes_refresh()$$);
select cron.schedule('routes-plan', '37 * * * *', $$select private.plan_route_airports()$$);
