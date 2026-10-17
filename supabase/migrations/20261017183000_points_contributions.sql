-- Fair split for points: when someone pays for part of a trip with points or miles, the group agrees what a
-- point is worth and that payment counts toward who-owes-whom, like cash. Kept apart from expenses so the
-- trip's cash budget and spending totals never include points.

-- What the group agreed a point is worth, in cents of the trip currency (1.0 = 1¢ per point).
alter table public.trips
  add column point_value_cents numeric(5, 2) not null default 1.0
    check (point_value_cents >= 0.1 and point_value_cents <= 10);

create table public.points_contributions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  -- Who spent the points. Set null if they leave the trip, like expenses.paid_by.
  paid_by uuid references public.profiles (id) on delete set null,
  description text not null check (char_length(description) between 1 and 200),
  program text check (char_length(program) <= 80),
  points integer not null check (points > 0 and points <= 10000000),
  -- Cents per point for this entry; null = the trip's agreed value at the time it's shown.
  value_cents numeric(5, 2) check (value_cents is null or (value_cents >= 0.1 and value_cents <= 10)),
  -- Who shares it; empty = everyone on the trip.
  split_with uuid[] not null default '{}',
  lodging_id uuid references public.lodging (id) on delete set null,
  transit_segment_id uuid references public.transit_segments (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index points_contributions_trip_idx on public.points_contributions (trip_id, created_at desc);
create index points_contributions_paid_by_idx on public.points_contributions (paid_by);
create index points_contributions_lodging_idx on public.points_contributions (lodging_id);
create index points_contributions_transit_idx on public.points_contributions (transit_segment_id);
create index points_contributions_created_by_idx on public.points_contributions (created_by);

create trigger set_updated_at before update on public.points_contributions
  for each row execute function private.set_updated_at();

alter table public.points_contributions enable row level security;

create policy "points_contributions: members read" on public.points_contributions
  for select to authenticated using (private.is_trip_member(trip_id));
-- Editors record them; the payer must be on the trip.
create policy "points_contributions: editors insert" on public.points_contributions
  for insert to authenticated with check (
    private.can_edit_trip(trip_id)
    and created_by = (select auth.uid())
    and exists (select 1 from public.trip_members m where m.trip_id = points_contributions.trip_id and m.user_id = points_contributions.paid_by)
  );
create policy "points_contributions: editors update" on public.points_contributions
  for update to authenticated using (private.can_edit_trip(trip_id)) with check (private.can_edit_trip(trip_id));
create policy "points_contributions: editors delete" on public.points_contributions
  for delete to authenticated using (private.can_edit_trip(trip_id));
