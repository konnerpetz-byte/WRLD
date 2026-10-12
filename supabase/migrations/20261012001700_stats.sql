-- Owner stats: which days people use the app, which suggestions they see,
-- which booking links they click, and one admin-only summary function.

-- Days each person opened the app (one row per person per day).
create table public.user_activity (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  primary key (user_id, day)
);
alter table public.user_activity enable row level security;
-- No policies: written only through touch_activity(), read only by admin_stats().

-- Things that don't otherwise leave a trace in the database.
create table public.app_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('booking_click', 'suggestions_shown')),
  trip_id uuid references public.trips (id) on delete set null,
  provider text check (char_length(provider) <= 40),
  count smallint not null default 1 check (count between 1 and 50),
  created_at timestamptz not null default now()
);
create index app_events_kind_created on public.app_events (kind, created_at);
create index app_events_user on public.app_events (user_id);
create index app_events_trip on public.app_events (trip_id);
alter table public.app_events enable row level security;
create policy "Add your own events" on public.app_events
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Who can see the stats page.
create table public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.app_admins enable row level security;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.app_admins where user_id = (select auth.uid())) $$;

create function public.touch_activity() returns void
language sql security definer set search_path = ''
as $$
  insert into public.user_activity (user_id, day)
  select auth.uid(), current_date where auth.uid() is not null
  on conflict do nothing
$$;
revoke all on function public.touch_activity() from public, anon;
grant execute on function public.touch_activity() to authenticated;

create function public.is_app_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select private.is_admin() $$;
revoke all on function public.is_app_admin() from public, anon;
grant execute on function public.is_app_admin() to authenticated;

-- Everything the stats page shows, for the last p_days days.
create function public.admin_stats(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  since timestamptz := now() - make_interval(days => greatest(1, least(p_days, 3650)));
  result jsonb;
begin
  if not private.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  with new_users as (
    select id, created_at from auth.users where created_at >= since
  ),
  returned as (
    -- Signed up at least 7 days ago; came back on day 7 or later.
    select u.id,
      exists (select 1 from public.user_activity a where a.user_id = u.id and a.day >= (u.created_at + interval '7 days')::date) as came_back
    from new_users u
    where u.created_at <= now() - interval '7 days'
  ),
  invited_trips as (
    select distinct trip_id from public.trip_invites where created_at >= since
  ),
  joined as (
    select m.trip_id, count(*) as friends
    from public.trip_members m join public.trips t on t.id = m.trip_id
    where m.user_id <> t.owner_id and m.created_at >= since
    group by m.trip_id
  )
  select jsonb_build_object(
    'days', p_days,
    'totals', jsonb_build_object(
      'users', (select count(*) from auth.users),
      'trips', (select count(*) from public.trips),
      'active_7d', (select count(distinct user_id) from public.user_activity where day > current_date - 7),
      'active_30d', (select count(distinct user_id) from public.user_activity where day > current_date - 30)
    ),
    'started', jsonb_build_object(
      'new_users', (select count(*) from new_users),
      'made_a_trip', (select count(*) from new_users u where exists (select 1 from public.trips t where t.owner_id = u.id)),
      'trips_created', (select count(*) from public.trips where created_at >= since)
    ),
    'invites', jsonb_build_object(
      'trips_with_invite', (select count(*) from invited_trips),
      'trips_where_friends_joined', (select count(*) from invited_trips i where exists (select 1 from joined j where j.trip_id = i.trip_id)),
      'friends_joined', (select coalesce(sum(friends), 0) from joined),
      'invited_friends_who_were_new', (
        select count(*) from public.trip_members m
        join public.trips t on t.id = m.trip_id
        join auth.users u on u.id = m.user_id
        where m.user_id <> t.owner_id and m.created_at >= since
          and u.created_at >= m.created_at - interval '1 day'
      )
    ),
    'return', jsonb_build_object(
      'eligible', (select count(*) from returned),
      'came_back', (select count(*) from returned where came_back)
    ),
    'suggestions', jsonb_build_object(
      'shown', (select coalesce(sum(count), 0) from public.app_events where kind = 'suggestions_shown' and created_at >= since),
      'added', (select count(*) from public.itinerary_items where provider in ('viator', 'sample', 'getyourguide') and created_at >= since)
    ),
    'booking_clicks', jsonb_build_object(
      'total', (select count(*) from public.app_events where kind = 'booking_click' and created_at >= since),
      'by_provider', coalesce((
        select jsonb_object_agg(provider, n) from (
          select coalesce(provider, 'other') as provider, count(*) as n
          from public.app_events where kind = 'booking_click' and created_at >= since
          group by 1
        ) p
      ), '{}'::jsonb)
    ),
    'engagement', jsonb_build_object(
      'chat_messages', (select count(*) from public.trip_messages where created_at >= since),
      'saved_spots', (select count(*) from public.saved_spots where created_at >= since),
      'itinerary_items', (select count(*) from public.itinerary_items where created_at >= since)
    ),
    'weekly', coalesce((
      select jsonb_agg(w order by w->>'week')
      from (
        select jsonb_build_object(
          'week', to_char(wk, 'YYYY-MM-DD'),
          'signups', (select count(*) from auth.users where date_trunc('week', created_at) = wk),
          'active', (select count(distinct user_id) from public.user_activity where date_trunc('week', day::timestamptz) = wk),
          'trips', (select count(*) from public.trips where date_trunc('week', created_at) = wk)
        ) as w
        from generate_series(date_trunc('week', now()) - interval '7 weeks', date_trunc('week', now()), interval '1 week') as wk
      ) weeks
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;
revoke all on function public.admin_stats(integer) from public, anon;
grant execute on function public.admin_stats(integer) to authenticated;
