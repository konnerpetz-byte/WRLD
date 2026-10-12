-- =====================================================================
-- WRLD: finish database setup (last step)
-- Run once in Supabase → SQL Editor → New query → Run.
-- Builds each trip's days and time blocks, and locks down internal access.
-- Everything else is already live. Runs as one transaction.
-- =====================================================================
begin;

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

-- ---------------------------------------------------------------------
-- Lockdown: internal functions aren't callable by app users directly,
-- except the few that access rules and triggers need.
-- ---------------------------------------------------------------------
revoke all on all functions in schema private from public;

grant execute on function
  private.is_trip_member(uuid),
  private.can_edit_trip(uuid),
  private.is_trip_owner(uuid),
  private.shares_trip_with(uuid),
  private.usd_rate(text, date),
  private.archetype_for(numeric, numeric)
to authenticated;
grant execute on function private.usd_rate(text, date) to anon;

-- Wallet tokens: only the server (service role) may read these.
revoke all on private.wallet_connection_tokens from public, anon, authenticated;

commit;
