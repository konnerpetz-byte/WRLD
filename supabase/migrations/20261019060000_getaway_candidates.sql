-- Road-trip places harvested from Wikidata + Wikivoyage (every U.S. and Canadian town, park and
-- small region with a Wikivoyage travel guide), waiting for a person to approve them. Approved rows
-- join the hand-picked list in the planner. Filled by the places-harvest worker; reviewed at /admin/places.
create table public.getaway_candidates (
  qid text primary key check (qid ~ '^Q[0-9]+$'),
  name text not null,
  region text not null,           -- state or province code: MI, ON
  country text not null check (country in ('US', 'CA')),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  county text,
  description text,
  kind text not null check (kind in ('city', 'park', 'region')),
  quality text check (quality in ('outline', 'usable', 'guide', 'star')),
  population integer,
  wikivoyage text not null,
  wikipedia text,
  intro text,
  -- What the worker guesses; the reviewer confirms or changes these.
  suggested_vibes text[] not null default '{}',
  suggested_tier smallint check (suggested_tier between 1 and 3),
  suggested_gem boolean not null default false,
  gsa_lodging numeric,
  -- The review
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  vibes text[],
  tier smallint check (tier between 1 and 3),
  gem boolean,
  why text check (char_length(why) <= 120),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  harvested_at timestamptz not null default now()
);

create index getaway_candidates_review on public.getaway_candidates (status, region);

alter table public.getaway_candidates enable row level security;

create policy "Anyone can read approved places" on public.getaway_candidates
  for select to anon, authenticated using (status = 'approved');
create policy "Admins can read every place" on public.getaway_candidates
  for select to authenticated using ((select private.is_admin()));
create policy "Admins can review places" on public.getaway_candidates
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

grant select on public.getaway_candidates to anon, authenticated;
grant update (status, vibes, tier, gem, why, reviewed_at, reviewed_by) on public.getaway_candidates to authenticated;

-- Worker call: one batch of regions (the worker reads Wikidata one state at a time).
create or replace function private.run_places_harvest(p_regions text[])
returns bigint
language sql
security definer
set search_path to ''
as $$
  select net.http_post(
    url := 'https://zzbbjhokowvmpuuzsbjq.supabase.co/functions/v1/places-harvest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-wrld-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'award_refresh_token')
    ),
    body := jsonb_build_object('regions', to_jsonb(p_regions)),
    timeout_milliseconds := 150000
  );
$$;
revoke all on function private.run_places_harvest(text[]) from public, anon, authenticated;
