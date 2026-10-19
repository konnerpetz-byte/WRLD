-- Place photos, stored instead of looked up live. Wikipedia started refusing many of the live
-- lookups from the app's servers (one per card, hundreds per search), and a refusal looked the
-- same as "no photo". Now the app asks for a title once (request_place_photos), the
-- photos-refresh worker looks titles up 50 at a time, and pages read the stored result.
create table public.place_photos (
  title text primary key check (char_length(title) between 1 and 200),
  search text check (char_length(search) <= 200),
  status text not null default 'pending' check (status in ('pending', 'found', 'none')),
  src text check (src ~ '^https://[a-z0-9.-]*wikimedia\.org/'),
  width integer,
  height integer,
  credit text,
  license text,
  page text check (page ~ '^https://commons\.wikimedia\.org/'),
  requested_at timestamptz not null default now(),
  checked_at timestamptz
);
create index place_photos_todo on public.place_photos (status, checked_at);

alter table public.place_photos enable row level security;
create policy "Anyone can read place photos" on public.place_photos for select to anon, authenticated using (true);
grant select on public.place_photos to anon, authenticated;

-- Ask for photos of places the app is about to show. New titles only; at most 100 a call.
create or replace function public.request_place_photos(p_places jsonb)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  n integer;
begin
  if jsonb_typeof(p_places) <> 'array' then
    return 0;
  end if;
  insert into public.place_photos (title, search)
  select left(trim(x ->> 'title'), 200), left(trim(coalesce(x ->> 'search', '')), 200)
  from jsonb_array_elements(p_places) with ordinality as t(x, i)
  where i <= 100 and char_length(trim(coalesce(x ->> 'title', ''))) between 1 and 200
  on conflict (title) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.request_place_photos(jsonb) from public;
grant execute on function public.request_place_photos(jsonb) to anon, authenticated;

create or replace function private.run_photos_refresh()
returns bigint
language sql
security definer
set search_path to ''
as $$
  select net.http_post(
    url := 'https://zzbbjhokowvmpuuzsbjq.supabase.co/functions/v1/photos-refresh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-wrld-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'award_refresh_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$$;
revoke all on function private.run_photos_refresh() from public, anon, authenticated;

-- Every 10 minutes: new titles get photos quickly; each run is a handful of batched requests.
select cron.schedule('photos-refresh', '*/10 * * * *', 'select private.run_photos_refresh()');
