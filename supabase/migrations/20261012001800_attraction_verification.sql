-- pg_net lets the database itself check that official links answer.
-- private.attraction_staging holds candidates while they're checked
-- (see scripts/attractions/README.md).
create extension if not exists pg_net;

create table private.attraction_staging (
  slug text primary key,
  name text not null,
  wiki_title text not null,
  city text not null,
  country_code text,
  latitude double precision not null,
  longitude double precision not null,
  official_url text not null,
  tickets_url text,
  timed_entry boolean not null,
  best_slot public.time_block_slot,
  suggested_start time,
  duration_minutes smallint,
  tags text[] not null default '{}',
  lean_x smallint not null default 0,
  lean_y smallint not null default 0,
  visit_note text,
  aliases text[] not null default '{}',
  wikidata_id text,
  wikidata_websites text[],
  wikidata_lat double precision,
  wikidata_lng double precision,
  url_request bigint,
  url_status int,
  tickets_request bigint,
  tickets_status int
);

alter table public.attractions
  add column if not exists link_status int,
  add column if not exists link_checked_at timestamptz;
