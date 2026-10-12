-- =====================================================================
-- 03 · Arrival-aware day grid
--
-- 1. Days + Morning/Afternoon/Evening blocks are created from the trip dates.
-- 2. Each block knows its real clock window in the trip's timezone.
-- 3. Transit legs mark time as busy:
--      * everything before the last OUTBOUND arrival (+ after-buffer)
--      * everything after the first RETURN departure (− before-buffer)
--      * each leg itself, padded by its buffers
-- 4. Each block then gets: available minutes, first/last free moment,
--    status (open / limited / unavailable) and why (arrival / departure / in_transit).
--
-- Example: land in Lisbon at 11:00 PM → Day 1 morning and afternoon are
-- unavailable, the evening block is "unavailable · arrival", and the UI
-- shows "Arrive 11:00 PM — check in at <hotel>" there instead of activities.
-- =====================================================================

-- Block windows, local time. Evening runs to midnight.
create or replace function private.block_window(p_date date, p_slot public.time_block_slot, p_tz text)
returns tstzrange
language sql
stable
set search_path = ''
as $$
  select tstzrange(
    (p_date + case p_slot when 'morning' then time '06:00' when 'afternoon' then time '12:00' else time '17:00' end)
      at time zone p_tz,
    case p_slot
      when 'morning'   then (p_date + time '12:00') at time zone p_tz
      when 'afternoon' then (p_date + time '17:00') at time zone p_tz
      else ((p_date + 1) + time '00:00') at time zone p_tz
    end
  );
$$;

-- Recalculate availability for every block in a trip.
create or replace function private.refresh_trip_availability(p_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_free_from  timestamptz;   -- traveler is free after landing + buffer
  v_free_until timestamptz;   -- traveler must leave for the trip home
  v_busy       tstzmultirange;
begin
  select max(s.arrive_at + make_interval(mins => s.buffer_after_minutes))
    into v_free_from
  from public.transit_segments s
  where s.trip_id = p_trip_id and s.direction = 'outbound' and s.booking_status <> 'cancelled';

  select min(s.depart_at - make_interval(mins => s.buffer_before_minutes))
    into v_free_until
  from public.transit_segments s
  where s.trip_id = p_trip_id and s.direction = 'return' and s.booking_status <> 'cancelled';

  select coalesce(
           range_agg(tstzrange(
             s.depart_at - make_interval(mins => s.buffer_before_minutes),
             s.arrive_at + make_interval(mins => s.buffer_after_minutes))),
           '{}'::tstzmultirange)
    into v_busy
  from public.transit_segments s
  where s.trip_id = p_trip_id and s.booking_status <> 'cancelled';

  if v_free_from is not null then
    v_busy := v_busy + tstzmultirange(tstzrange(null, v_free_from));
  end if;
  if v_free_until is not null then
    v_busy := v_busy + tstzmultirange(tstzrange(v_free_until, null));
  end if;

  with free as (
    select b.id,
           b.starts_at,
           b.ends_at,
           tstzmultirange(tstzrange(b.starts_at, b.ends_at)) - v_busy as free_time
    from public.time_blocks b
    where b.trip_id = p_trip_id
  ),
  measured as (
    select f.*,
           coalesce((select sum(extract(epoch from upper(r) - lower(r))) from unnest(f.free_time) as r), 0) / 60
             as free_minutes,
           extract(epoch from f.ends_at - f.starts_at) / 60 as total_minutes
    from free f
  )
  update public.time_blocks b
  set available_minutes = m.free_minutes::integer,
      available_from    = lower(m.free_time),
      available_until   = upper(m.free_time),
      status = case
                 when m.free_minutes < 45                      then 'unavailable'
                 when m.free_minutes < m.total_minutes * 0.75  then 'limited'
                 else 'open'
               end::public.block_status,
      travel_event = (
        select case
                 when bool_or(s.direction = 'outbound' and s.arrive_at >= m.starts_at and s.arrive_at < m.ends_at)
                   then 'arrival'
                 when bool_or(s.direction = 'return' and s.depart_at >= m.starts_at and s.depart_at < m.ends_at)
                   then 'departure'
                 when bool_or(s.depart_at < m.ends_at and s.arrive_at > m.starts_at)
                   then 'in_transit'
               end::public.travel_event
        from public.transit_segments s
        where s.trip_id = p_trip_id and s.booking_status <> 'cancelled'
      )
  from measured m
  where b.id = m.id;
end;
$$;

-- Make days + blocks match the trip's dates and timezone, then recalculate.
-- NOTE: shrinking the date range deletes the removed days and everything
-- planned on them. The app must confirm with the user before saving that.
create or replace function private.sync_trip_schedule(p_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip public.trips;
begin
  select * into v_trip from public.trips where id = p_trip_id;

  delete from public.trip_days
  where trip_id = p_trip_id
    and (date < v_trip.start_date or date > v_trip.end_date);

  insert into public.trip_days (trip_id, date)
  select p_trip_id, d::date
  from generate_series(v_trip.start_date, v_trip.end_date, interval '1 day') as d
  on conflict (trip_id, date) do nothing;

  insert into public.time_blocks (trip_id, day_id, slot, starts_at, ends_at)
  select p_trip_id, td.id, s.slot,
         lower(private.block_window(td.date, s.slot, v_trip.timezone)),
         upper(private.block_window(td.date, s.slot, v_trip.timezone))
  from public.trip_days td
  cross join unnest(enum_range(null::public.time_block_slot)) as s (slot)
  where td.trip_id = p_trip_id
  on conflict (day_id, slot) do update
    set starts_at = excluded.starts_at,
        ends_at   = excluded.ends_at;

  perform private.refresh_trip_availability(p_trip_id);
end;
$$;

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------
create or replace function private.on_trip_schedule_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.sync_trip_schedule(new.id);
  return new;
end;
$$;

create trigger sync_schedule_on_create
  after insert on public.trips
  for each row execute function private.on_trip_schedule_change();

create trigger sync_schedule_on_change
  after update of start_date, end_date, timezone on public.trips
  for each row
  when (old.start_date is distinct from new.start_date
     or old.end_date   is distinct from new.end_date
     or old.timezone   is distinct from new.timezone)
  execute function private.on_trip_schedule_change();

create or replace function private.on_transit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform private.refresh_trip_availability(old.trip_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.trip_id <> old.trip_id) then
    perform private.refresh_trip_availability(new.trip_id);
  end if;
  return null;
end;
$$;

create trigger refresh_availability
  after insert or update or delete on public.transit_segments
  for each row execute function private.on_transit_change();

revoke all on function
  private.block_window(date, public.time_block_slot, text),
  private.refresh_trip_availability(uuid),
  private.sync_trip_schedule(uuid),
  private.on_trip_schedule_change(),
  private.on_transit_change()
from public;
