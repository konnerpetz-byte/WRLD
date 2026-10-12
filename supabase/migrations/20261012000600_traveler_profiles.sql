-- =====================================================================
-- 06 · Traveler profiles, travel-type compass, memory, recommendations
--
-- The compass has two axes (each −10 … +10):
--   X  Culture (−)  ↔  Nature (+)          where you want to be
--   Y  Relaxing (−) ↔  Active (+)          how much energy you want to spend
--
-- Quadrants → travel types (computed by the database from x/y):
--   Culture + Active    → The Itinerary Athlete
--   Culture + Relaxing  → The Flâneur
--   Nature  + Active    → The Trailblazer
--   Nature  + Relaxing  → The Sunset Collector
--   Near the center          → The Wildcard
--
-- The quiz itself (questions, scoring) lives in
-- src/features/traveler-profile/quiz.ts so it can change without a migration.
-- =====================================================================

create type public.travel_archetype as enum (
  'itinerary_athlete', 'flaneur', 'trailblazer', 'sunset_collector', 'wildcard'
);
create type public.interest_source as enum ('quiz', 'manual', 'learned');
create type public.recommendation_status as enum ('new', 'saved', 'added', 'dismissed');

-- ---------------------------------------------------------------------
-- Interest tags: the shared vocabulary for people AND activities.
-- compass_x / compass_y say how a tag leans (−2 … +2).
-- ---------------------------------------------------------------------
create table public.interest_tags (
  slug       text primary key check (slug ~ '^[a-z0-9_]+$'),
  label      text not null,
  category   text not null,                                          -- outdoors, culture, food, nightlife, wellness
  compass_x  smallint not null default 0 check (compass_x between -2 and 2),
  compass_y  smallint not null default 0 check (compass_y between -2 and 2)
);

alter table public.interest_tags enable row level security;
create policy "tags: anyone reads" on public.interest_tags for select to anon, authenticated using (true);

insert into public.interest_tags (slug, label, category, compass_x, compass_y) values
  ('hiking',          'Hiking',               'outdoors',   2,  2),
  ('viewpoints',      'Viewpoints',           'outdoors',   1,  1),
  ('camping',         'Camping',              'outdoors',   2,  1),
  ('kayaking',        'Kayaking & paddling',  'outdoors',   2,  1),
  ('water_sports',    'Surfing & diving',     'outdoors',   2,  2),
  ('wildlife',        'Wildlife',             'outdoors',   2,  0),
  ('road_trips',      'Road trips',           'outdoors',   1,  1),
  ('beaches',         'Beaches',              'outdoors',   2, -2),
  ('stargazing',      'Stargazing',           'outdoors',   2, -1),
  ('scenic_journeys', 'Scenic trains & ferries', 'outdoors', 1, -1),
  ('picnics',         'Picnics & parks',      'outdoors',   1, -2),
  ('museums',         'Museums',              'culture',   -2,  1),
  ('landmarks',       'Famous landmarks',     'culture',   -2,  2),
  ('history',         'History',              'culture',   -2,  0),
  ('art',             'Art & galleries',      'culture',   -2,  0),
  ('architecture',    'Architecture',         'culture',   -1,  0),
  ('walking_tours',   'Walking tours',        'culture',   -2,  1),
  ('shopping',        'Shopping',             'culture',   -2,  1),
  ('markets',         'Markets',              'culture',   -1,  0),
  ('bookstores',      'Bookstores',           'culture',   -1, -2),
  ('neighborhoods',   'Wandering neighborhoods', 'culture', -1, -1),
  ('cafes',           'Cafés',                'food',      -1, -2),
  ('street_food',     'Street food',          'food',      -1,  0),
  ('fine_dining',     'Fine dining',          'food',      -2,  0),
  ('wine',            'Wine & tastings',      'food',      -1, -1),
  ('cooking_classes', 'Cooking classes',      'food',      -1, -1),
  ('nightlife',       'Nightlife',            'nightlife', -2,  2),
  ('live_music',      'Live music & shows',   'nightlife', -2,  1),
  ('wellness',        'Spas & hot springs',   'wellness',   1, -2),
  ('relaxation',      'Doing nothing, well',  'wellness',   1, -2);

-- ---------------------------------------------------------------------
-- Traveler profile (one per user)
-- ---------------------------------------------------------------------
create table public.traveler_profiles (
  user_id            uuid primary key references public.profiles (id) on delete cascade,
  compass_x          numeric(3, 1) check (compass_x between -10 and 10),
  compass_y          numeric(3, 1) check (compass_y between -10 and 10),
  archetype          public.travel_archetype,                        -- set by trigger
  quiz_version       smallint,
  quiz_answers       jsonb not null default '{}',                    -- { questionId: optionId }
  quiz_completed_at  timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint traveler_profiles_both_axes check ((compass_x is null) = (compass_y is null))
);

create table public.traveler_interests (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  tag_slug    text not null references public.interest_tags (slug) on delete cascade,
  weight      smallint not null default 1 check (weight between -2 and 3),  -- negative = "not for me"
  source      public.interest_source not null default 'manual',
  updated_at  timestamptz not null default now(),
  primary key (user_id, tag_slug)
);
create index traveler_interests_tag_idx on public.traveler_interests (tag_slug);

create or replace function private.archetype_for(p_x numeric, p_y numeric)
returns public.travel_archetype
language sql
immutable
set search_path = ''
as $$
  select case
    when p_x is null or p_y is null           then null
    when sqrt(p_x * p_x + p_y * p_y) < 2.5    then 'wildcard'
    when p_x <  0 and p_y >= 0                then 'itinerary_athlete'
    when p_x <  0 and p_y <  0                then 'flaneur'
    when p_x >= 0 and p_y >= 0                then 'trailblazer'
    else                                           'sunset_collector'
  end::public.travel_archetype;
$$;

create or replace function private.set_archetype()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.archetype := private.archetype_for(new.compass_x, new.compass_y);
  return new;
end;
$$;

create trigger set_archetype
  before insert or update of compass_x, compass_y on public.traveler_profiles
  for each row execute function private.set_archetype();

create trigger set_updated_at before update on public.traveler_profiles
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.traveler_interests
  for each row execute function private.set_updated_at();

-- Every new user gets an empty traveler profile.
create or replace function private.create_traveler_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.traveler_profiles (user_id) values (new.id);
  return new;
end;
$$;

create trigger create_traveler_profile
  after insert on public.profiles
  for each row execute function private.create_traveler_profile();

-- ---------------------------------------------------------------------
-- Memory: ratings on things the user did
-- ---------------------------------------------------------------------
create table public.experience_ratings (
  user_id            uuid not null references public.profiles (id) on delete cascade,
  itinerary_item_id  uuid not null references public.itinerary_items (id) on delete cascade,
  rating             smallint not null check (rating between 1 and 5),
  would_repeat       boolean,
  created_at         timestamptz not null default now(),
  primary key (user_id, itinerary_item_id)
);
create index experience_ratings_item_idx on public.experience_ratings (itinerary_item_id);

-- Everything booked on trips the user belongs to, newest first.
-- Feeds the "Past trips" screen and the recommender.
create view public.my_booking_history
with (security_invoker = true) as
select i.trip_id, t.title as trip_title, t.destination, t.destination_country, t.end_date as trip_end_date,
       'activity'::text as booking_type, i.id as booking_id, i.title, i.tags,
       i.provider, i.provider_ref, i.cost, i.currency,
       r.rating, r.would_repeat
from public.itinerary_items i
join public.trips t on t.id = i.trip_id
left join public.experience_ratings r on r.itinerary_item_id = i.id and r.user_id = (select auth.uid())
where i.booking_status = 'booked'
union all
select l.trip_id, t.title, t.destination, t.destination_country, t.end_date,
       'lodging', l.id, l.name, '{}'::text[], l.provider, l.provider_ref, l.cost, l.currency,
       null, null
from public.lodging l
join public.trips t on t.id = l.trip_id
where l.booking_status = 'booked'
union all
select s.trip_id, t.title, t.destination, t.destination_country, t.end_date,
       s.mode::text, s.id,
       concat_ws(' ', s.carrier, s.service_number, s.origin_code || '→' || s.destination_code),
       '{}'::text[], s.provider, s.provider_ref, s.cost, s.currency, null, null
from public.transit_segments s
join public.trips t on t.id = s.trip_id
where s.booking_status = 'booked';

-- ---------------------------------------------------------------------
-- Recommendations (generated by the server per trip and traveler)
-- ---------------------------------------------------------------------
create table public.trip_recommendations (
  id                       uuid primary key default gen_random_uuid(),
  trip_id                  uuid not null references public.trips (id) on delete cascade,
  user_id                  uuid not null references public.profiles (id) on delete cascade,
  provider                 text not null,                            -- 'viator', ...
  provider_ref             text not null,
  title                    text not null,
  summary                  text,
  image_url                text,
  tags                     text[] not null default '{}',
  duration_minutes         integer check (duration_minutes > 0),
  price                    numeric(12, 2) check (price >= 0),
  currency                 text references public.currencies (code),
  provider_rating          numeric(2, 1),
  booking_url              text,
  score                    numeric(5, 2) not null,                   -- 0–100
  reasons                  text[] not null default '{}',             -- "You loved hiking in Banff"
  suggested_time_block_id  uuid references public.time_blocks (id) on delete set null,
  status                   public.recommendation_status not null default 'new',
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint trip_recommendations_unique unique (trip_id, user_id, provider, provider_ref)
);
create index trip_recommendations_user_idx  on public.trip_recommendations (user_id, trip_id, score desc);
create index trip_recommendations_block_idx on public.trip_recommendations (suggested_time_block_id)
  where suggested_time_block_id is not null;

create trigger set_updated_at before update on public.trip_recommendations
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.traveler_profiles    enable row level security;
alter table public.traveler_interests   enable row level security;
alter table public.experience_ratings   enable row level security;
alter table public.trip_recommendations enable row level security;

-- Trip-mates can see each other's travel type (fun for group trips).
create policy "traveler: read self and trip-mates" on public.traveler_profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or private.shares_trip_with(user_id));
create policy "traveler: update self" on public.traveler_profiles
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "interests: own all" on public.traveler_interests
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "ratings: own all" on public.experience_ratings
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "recs: own read" on public.trip_recommendations
  for select to authenticated
  using (user_id = (select auth.uid()) and private.is_trip_member(trip_id));
create policy "recs: own status update" on public.trip_recommendations
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and private.is_trip_member(trip_id));
-- Inserts come from the server's recommender (service role).
