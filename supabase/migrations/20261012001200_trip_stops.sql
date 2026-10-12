-- =====================================================================
-- 12 · Multi-city trips
--
-- A trip is a list of stops (cities), each with its own dates and time
-- zone: Lisbon 3 nights → Munich 4 nights. Every day is assigned to the
-- stop you sleep in that night (the last day goes to the final stop),
-- and its Morning/Afternoon/Evening windows use that stop's time zone.
--
-- trips.destination / destination_country / latitude / longitude /
-- timezone stay as a summary of the first stop so older code still works.
-- =====================================================================

create table public.trip_stops (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips (id) on delete cascade,
  position      smallint not null default 0,
  city          text not null check (char_length(city) between 1 and 120),
  country_code  text references public.countries (code),
  latitude      double precision check (latitude between -90 and 90),
  longitude     double precision check (longitude between -180 and 180),
  timezone      text not null default 'UTC',
  arrive_date   date not null,
  leave_date    date not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint trip_stops_dates_in_order check (leave_date >= arrive_date)
);
create index trip_stops_trip_idx on public.trip_stops (trip_id, position);

create trigger set_updated_at before update on public.trip_stops
  for each row execute function private.set_updated_at();

alter table public.trip_stops enable row level security;
create policy "trip_stops: members read" on public.trip_stops
  for select to authenticated using (private.is_trip_member(trip_id));
create policy "trip_stops: editors insert" on public.trip_stops
  for insert to authenticated with check (private.can_edit_trip(trip_id));
create policy "trip_stops: editors update" on public.trip_stops
  for update to authenticated
  using (private.can_edit_trip(trip_id)) with check (private.can_edit_trip(trip_id));
create policy "trip_stops: editors delete" on public.trip_stops
  for delete to authenticated using (private.can_edit_trip(trip_id));

grant select, insert, update, delete on public.trip_stops to authenticated;

-- Which stop each day belongs to, and the clock it runs on.
alter table public.trip_days
  add column stop_id  uuid references public.trip_stops (id) on delete set null,
  add column timezone text;
create index trip_days_stop_idx on public.trip_days (stop_id);

-- The stop you sleep in on a date; the final stop on the last day.
create or replace function private.stop_for_date(p_trip_id uuid, p_date date)
returns uuid
language sql
stable
set search_path = ''
as $$
  select s.id
  from public.trip_stops s
  where s.trip_id = p_trip_id
  order by
    (p_date >= s.arrive_date and p_date < s.leave_date) desc,
    (p_date between s.arrive_date and s.leave_date) desc,
    abs(p_date - s.arrive_date),
    s.position
  limit 1;
$$;

-- After the days exist, give each one its stop and that stop's clock,
-- and move its Morning/Afternoon/Evening windows to that time zone.
create or replace function private.apply_stop_timezones(p_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz text;
begin
  select timezone into v_tz from public.trips where id = p_trip_id;
  if not found then
    return;
  end if;

  update public.trip_days td
  set stop_id  = x.stop_id,
      timezone = coalesce(s.timezone, v_tz)
  from (select d.id, private.stop_for_date(p_trip_id, d.date) as stop_id
        from public.trip_days d where d.trip_id = p_trip_id) x
  left join public.trip_stops s on s.id = x.stop_id
  where td.id = x.id;

  update public.time_blocks b
  set starts_at = lower(private.block_window(td.date, b.slot, td.timezone)),
      ends_at   = upper(private.block_window(td.date, b.slot, td.timezone))
  from public.trip_days td
  where td.id = b.day_id
    and b.trip_id = p_trip_id
    and (b.starts_at, b.ends_at) is distinct from
        (lower(private.block_window(td.date, b.slot, td.timezone)), upper(private.block_window(td.date, b.slot, td.timezone)));

  perform private.refresh_trip_availability(p_trip_id);
end;
$$;

-- Trip dates/timezone changed, or stops changed: rebuild days, then apply stop clocks.
create or replace function private.on_trip_schedule_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.sync_trip_schedule(new.id);
  perform private.apply_stop_timezones(new.id);
  return new;
end;
$$;

create or replace function private.on_stops_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.sync_trip_schedule(coalesce(new.trip_id, old.trip_id));
  perform private.apply_stop_timezones(coalesce(new.trip_id, old.trip_id));
  return null;
end;
$$;

create trigger sync_schedule_on_stops
  after insert or update or delete on public.trip_stops
  for each row execute function private.on_stops_change();

revoke all on function private.stop_for_date(uuid, date), private.on_stops_change(), private.apply_stop_timezones(uuid)
  from public, anon, authenticated;

-- Existing trips become one-stop trips.
insert into public.trip_stops (trip_id, position, city, country_code, latitude, longitude, timezone, arrive_date, leave_date)
select t.id, 0, coalesce(nullif(t.destination, ''), 'Destination'), t.destination_country,
       t.latitude, t.longitude, t.timezone, t.start_date, t.end_date
from public.trips t
where not exists (select 1 from public.trip_stops s where s.trip_id = t.id);
