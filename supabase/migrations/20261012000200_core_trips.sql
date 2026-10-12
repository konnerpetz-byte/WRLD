-- =====================================================================
-- 02 · Core trip planning
--
-- profiles, trips, trip_members, trip_days, time_blocks,
-- itinerary_items, lodging, transit_segments, expenses
--
-- Conventions
--   * uuid primary keys, timestamptz for moments, date for calendar days
--   * money = numeric(12,2) + currency code on the same row
--   * every trip content table carries trip_id so access checks are cheap
--   * every foreign key that parents can delete through is indexed
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.trip_status          as enum ('planning', 'booked', 'in_progress', 'completed', 'archived');
create type public.trip_role            as enum ('owner', 'editor', 'viewer');
create type public.time_block_slot      as enum ('morning', 'afternoon', 'evening');
-- How much of a block is actually usable once flights/trains are accounted for
create type public.block_status         as enum ('open', 'limited', 'unavailable');
create type public.travel_event         as enum ('arrival', 'departure', 'in_transit');
create type public.itinerary_item_kind  as enum ('activity', 'tour', 'meal', 'sightseeing', 'free_time', 'check_in', 'note');
create type public.transit_mode         as enum ('flight', 'train', 'bus', 'ferry', 'car');
-- outbound = getting to the trip, within = between stops, return = going home
create type public.transit_direction    as enum ('outbound', 'within', 'return');
create type public.booking_status       as enum ('idea', 'held', 'booked', 'cancelled');
create type public.expense_category     as enum ('lodging', 'transit', 'food', 'activities', 'shopping', 'fees', 'other');

-- ---------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- =====================================================================
-- Tables
-- =====================================================================

create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  display_name   text check (char_length(display_name) <= 80),
  avatar_url     text,
  home_country   text references public.countries (code),
  home_currency  text not null default 'USD' references public.currencies (code),
  home_airport   text check (home_airport ~ '^[A-Z]{3}$'),            -- IATA, e.g. DTW
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.trips (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null references public.profiles (id) on delete cascade,
  title                text not null check (char_length(title) between 1 and 120),
  destination          text,                                          -- display name, e.g. "Lisbon"
  destination_country  text references public.countries (code),
  start_date           date not null,
  end_date             date not null,
  timezone             text not null default 'UTC',                   -- IANA, e.g. Europe/Lisbon
  status               public.trip_status not null default 'planning',
  cover_image_url      text,
  budget               numeric(12, 2) check (budget >= 0),
  currency             text not null references public.currencies (code), -- filled by trigger if omitted
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint trips_dates_in_order check (end_date >= start_date),
  constraint trips_max_length     check (end_date - start_date <= 365)
);
create index trips_owner_id_idx on public.trips (owner_id);

create table public.trip_members (
  trip_id     uuid not null references public.trips (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        public.trip_role not null default 'viewer',
  created_at  timestamptz not null default now(),
  primary key (trip_id, user_id)
);
create index trip_members_user_id_idx on public.trip_members (user_id);

-- One row per calendar day (kept in sync with the trip dates; see migration 03).
create table public.trip_days (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips (id) on delete cascade,
  date        date not null,
  title       text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint trip_days_one_per_date unique (trip_id, date),
  constraint trip_days_id_trip_key  unique (id, trip_id)
);

-- Morning (6am–12pm) / Afternoon (12–5pm) / Evening (5pm–midnight), local time.
-- The availability columns are calculated from transit legs (migration 03);
-- the app reads them, it never writes them.
create table public.time_blocks (
  id                 uuid primary key default gen_random_uuid(),
  trip_id            uuid not null references public.trips (id) on delete cascade,
  day_id             uuid not null,
  slot               public.time_block_slot not null,
  starts_at          timestamptz not null,
  ends_at            timestamptz not null,
  status             public.block_status not null default 'open',
  available_minutes  integer not null default 0,
  available_from     timestamptz,                -- first free moment in the block
  available_until    timestamptz,                -- last free moment in the block
  travel_event       public.travel_event,        -- why the block is shortened, if it is
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint time_blocks_one_per_slot unique (day_id, slot),
  constraint time_blocks_id_trip_key  unique (id, trip_id),
  constraint time_blocks_window_order check (ends_at > starts_at),
  constraint time_blocks_day_fk foreign key (day_id, trip_id)
    references public.trip_days (id, trip_id) on delete cascade
);
create index time_blocks_trip_starts_idx on public.time_blocks (trip_id, starts_at);

create table public.itinerary_items (
  id              uuid primary key default gen_random_uuid(),
  trip_id         uuid not null references public.trips (id) on delete cascade,
  time_block_id   uuid not null,
  kind            public.itinerary_item_kind not null default 'activity',
  title           text not null check (char_length(title) between 1 and 200),
  description     text,
  start_time      time,                                               -- local to the trip timezone
  end_time        time,
  location_name   text,
  address         text,
  latitude        double precision check (latitude between -90 and 90),
  longitude       double precision check (longitude between -180 and 180),
  tags            text[] not null default '{}',                       -- interest tags, see migration 06
  booking_status  public.booking_status not null default 'idea',
  booking_url     text,
  provider        text,                                               -- e.g. 'viator'
  provider_ref    text,
  cost            numeric(12, 2) check (cost >= 0),
  currency        text references public.currencies (code),
  position        integer not null default 0,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint itinerary_items_block_fk foreign key (time_block_id, trip_id)
    references public.time_blocks (id, trip_id) on delete cascade,
  constraint itinerary_items_times_in_order
    check (start_time is null or end_time is null or end_time >= start_time)
);
create index itinerary_items_block_position_idx on public.itinerary_items (time_block_id, position);
create index itinerary_items_trip_id_idx        on public.itinerary_items (trip_id);
create index itinerary_items_created_by_idx     on public.itinerary_items (created_by);
create index itinerary_items_tags_idx           on public.itinerary_items using gin (tags);

create table public.lodging (
  id                 uuid primary key default gen_random_uuid(),
  trip_id            uuid not null references public.trips (id) on delete cascade,
  name               text not null check (char_length(name) between 1 and 200),
  address            text,
  latitude           double precision check (latitude between -90 and 90),
  longitude          double precision check (longitude between -180 and 180),
  check_in_at        timestamptz not null,
  check_out_at       timestamptz not null,
  confirmation_code  text,
  booking_status     public.booking_status not null default 'idea',
  booking_url        text,
  provider           text,
  provider_ref       text,
  cost               numeric(12, 2) check (cost >= 0),               -- cash paid (incl. taxes on award stays)
  currency           text references public.currencies (code),
  notes              text,
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint lodging_stay_in_order check (check_out_at > check_in_at)
);
create index lodging_trip_check_in_idx on public.lodging (trip_id, check_in_at);
create index lodging_created_by_idx    on public.lodging (created_by);

-- One row per leg. A connecting flight = two rows with the same direction.
create table public.transit_segments (
  id                     uuid primary key default gen_random_uuid(),
  trip_id                uuid not null references public.trips (id) on delete cascade,
  mode                   public.transit_mode not null,
  direction              public.transit_direction not null default 'within',
  carrier                text,
  service_number         text,
  origin_code            text,
  origin_name            text,
  origin_timezone        text,
  destination_code       text,
  destination_name       text,
  destination_timezone   text,
  depart_at              timestamptz not null,
  arrive_at              timestamptz not null,
  -- Time blocked off around the leg: getting to the airport/station before,
  -- and bags/customs/getting to lodging after. Defaults set by mode (trigger).
  buffer_before_minutes  integer not null check (buffer_before_minutes between 0 and 600),
  buffer_after_minutes   integer not null check (buffer_after_minutes between 0 and 600),
  cabin_class            text,
  seat                   text,
  confirmation_code      text,
  booking_status         public.booking_status not null default 'idea',
  booking_url            text,
  provider               text,
  provider_ref           text,
  cost                   numeric(12, 2) check (cost >= 0),           -- cash paid (incl. taxes on award tickets)
  currency               text references public.currencies (code),
  notes                  text,
  created_by             uuid references public.profiles (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint transit_times_in_order check (arrive_at >= depart_at)
);
create index transit_segments_trip_depart_idx on public.transit_segments (trip_id, depart_at);
create index transit_segments_created_by_idx  on public.transit_segments (created_by);

create table public.expenses (
  id                  uuid primary key default gen_random_uuid(),
  trip_id             uuid not null references public.trips (id) on delete cascade,
  paid_by             uuid references public.profiles (id) on delete set null,
  category            public.expense_category not null default 'other',
  description         text,
  amount              numeric(12, 2) not null check (amount >= 0),
  currency            text not null references public.currencies (code),
  incurred_on         date not null default current_date,
  lodging_id          uuid references public.lodging (id) on delete set null,
  transit_segment_id  uuid references public.transit_segments (id) on delete set null,
  itinerary_item_id   uuid references public.itinerary_items (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint expenses_single_link
    check (num_nonnulls(lodging_id, transit_segment_id, itinerary_item_id) <= 1)
);
create index expenses_trip_incurred_idx on public.expenses (trip_id, incurred_on);
create index expenses_paid_by_idx       on public.expenses (paid_by);
create index expenses_lodging_id_idx    on public.expenses (lodging_id)         where lodging_id is not null;
create index expenses_transit_id_idx    on public.expenses (transit_segment_id) where transit_segment_id is not null;
create index expenses_item_id_idx       on public.expenses (itinerary_item_id)  where itinerary_item_id is not null;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'trips', 'trip_days', 'time_blocks', 'itinerary_items',
    'lodging', 'transit_segments', 'expenses'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function private.set_updated_at()', t);
  end loop;
end;
$$;

-- =====================================================================
-- Automation
-- =====================================================================

-- New sign-up → profile. The app passes the visitor's country (from the
-- hosting platform's geolocation header) in signUp({ options: { data: { country } } }),
-- which sets the home currency. Falls back to USD.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_country  text := upper(nullif(new.raw_user_meta_data ->> 'country', ''));
  v_currency text;
begin
  select c.code, c.currency_code
    into v_country, v_currency
  from public.countries c
  where c.code = v_country;

  insert into public.profiles (id, display_name, avatar_url, home_country, home_currency)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    v_country,
    coalesce(v_currency, 'USD')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Trip currency: destination's currency, else the owner's home currency, else USD.
create or replace function private.default_trip_currency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.currency is null then
    select coalesce(
      (select c.currency_code from public.countries c where c.code = new.destination_country),
      (select p.home_currency from public.profiles p where p.id = new.owner_id),
      'USD'
    ) into new.currency;
  end if;
  return new;
end;
$$;

create trigger default_trip_currency
  before insert on public.trips
  for each row execute function private.default_trip_currency();

-- Owner becomes a member automatically.
create or replace function private.add_trip_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.trip_members (trip_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger add_trip_owner
  after insert on public.trips
  for each row execute function private.add_trip_owner();

-- Ownership can't change through a plain update (transfer = future RPC).
create or replace function private.prevent_owner_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'trip owner cannot be changed directly';
  end if;
  return new;
end;
$$;

create trigger prevent_owner_change
  before update of owner_id on public.trips
  for each row execute function private.prevent_owner_change();

-- Sensible buffers around each leg, by mode, unless the user set them.
create or replace function private.default_transit_buffers()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.buffer_before_minutes := coalesce(new.buffer_before_minutes, case new.mode
    when 'flight' then 120 when 'train' then 30 when 'bus' then 20 when 'ferry' then 45 else 0 end);
  new.buffer_after_minutes := coalesce(new.buffer_after_minutes, case new.mode
    when 'flight' then 90 when 'train' then 20 when 'bus' then 15 when 'ferry' then 20 else 0 end);
  return new;
end;
$$;

create trigger default_transit_buffers
  before insert on public.transit_segments
  for each row execute function private.default_transit_buffers();

-- =====================================================================
-- Row Level Security
-- =====================================================================

create or replace function private.is_trip_member(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members m
    where m.trip_id = p_trip_id
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.can_edit_trip(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members m
    where m.trip_id = p_trip_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'editor')
  );
$$;

create or replace function private.is_trip_owner(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members m
    where m.trip_id = p_trip_id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  );
$$;

create or replace function private.shares_trip_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trip_members mine
    join public.trip_members theirs on theirs.trip_id = mine.trip_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_user_id
  );
$$;

revoke all on all functions in schema private from public;
grant execute on function
  private.is_trip_member(uuid),
  private.can_edit_trip(uuid),
  private.is_trip_owner(uuid),
  private.shares_trip_with(uuid)
to authenticated;

-- profiles
alter table public.profiles enable row level security;

create policy "profiles: read self and trip-mates" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.shares_trip_with(id));

create policy "profiles: update self" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- trips
alter table public.trips enable row level security;

create policy "trips: members read" on public.trips
  for select to authenticated
  using (owner_id = (select auth.uid()) or private.is_trip_member(id));

create policy "trips: create own" on public.trips
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "trips: editors update" on public.trips
  for update to authenticated
  using (private.can_edit_trip(id))
  with check (private.can_edit_trip(id));

create policy "trips: owner deletes" on public.trips
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- trip_members
alter table public.trip_members enable row level security;

create policy "members: members read" on public.trip_members
  for select to authenticated
  using (private.is_trip_member(trip_id));

create policy "members: owner adds" on public.trip_members
  for insert to authenticated
  with check (private.is_trip_owner(trip_id) and role <> 'owner');

create policy "members: owner changes roles" on public.trip_members
  for update to authenticated
  using (private.is_trip_owner(trip_id) and role <> 'owner')
  with check (private.is_trip_owner(trip_id) and role <> 'owner');

create policy "members: owner removes, or member leaves" on public.trip_members
  for delete to authenticated
  using (
    role <> 'owner'
    and (private.is_trip_owner(trip_id) or user_id = (select auth.uid()))
  );

-- trip content: read = any member, write = owner or editor
do $$
declare t text;
begin
  foreach t in array array[
    'trip_days', 'time_blocks', 'itinerary_items',
    'lodging', 'transit_segments', 'expenses'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "%1$s: members read" on public.%1$I
         for select to authenticated using (private.is_trip_member(trip_id))', t);
    execute format(
      'create policy "%1$s: editors insert" on public.%1$I
         for insert to authenticated with check (private.can_edit_trip(trip_id))', t);
    execute format(
      'create policy "%1$s: editors update" on public.%1$I
         for update to authenticated
         using (private.can_edit_trip(trip_id)) with check (private.can_edit_trip(trip_id))', t);
    execute format(
      'create policy "%1$s: editors delete" on public.%1$I
         for delete to authenticated using (private.can_edit_trip(trip_id))', t);
  end loop;
end;
$$;

-- Days and blocks are managed by the database; users may edit their
-- title/notes but not create or delete them directly.
drop policy "trip_days: editors insert"   on public.trip_days;
drop policy "trip_days: editors delete"   on public.trip_days;
drop policy "time_blocks: editors insert" on public.time_blocks;
drop policy "time_blocks: editors delete" on public.time_blocks;
