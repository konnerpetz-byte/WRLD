-- =====================================================================
-- Traveler-reported award seats: WRLD's own availability data, built
-- from what travelers find on airline sites themselves. Reports go into
-- the award cache as data_source 'community' and are shown with their
-- age; the explorer hides reports older than three days.
-- =====================================================================
create table public.award_reports (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  origin      text not null check (origin ~ '^[A-Z]{3}$'),
  destination text not null check (destination ~ '^[A-Z]{3}$'),
  travel_date date not null,
  program     text not null check (program ~ '^[a-z0-9_]{2,40}$'),
  cabin       text not null check (cabin in ('economy', 'premium', 'business', 'first')),
  miles       integer not null check (miles between 1000 and 1000000),
  direct      boolean not null default false,
  created_at  timestamptz not null default now(),
  check (origin <> destination)
);
create index award_reports_user_recent on public.award_reports (user_id, created_at desc);

alter table public.award_reports enable row level security;
revoke all on public.award_reports from anon, authenticated;
grant select on public.award_reports to authenticated;
create policy "reports: see my own" on public.award_reports for select to authenticated using ((select auth.uid()) = user_id);

create function public.report_award_seat(
  p_origin text, p_destination text, p_date date, p_program text, p_cabin text, p_miles integer, p_direct boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if p_origin !~ '^[A-Z]{3}$' or p_destination !~ '^[A-Z]{3}$' or p_origin = p_destination
     or p_program !~ '^[a-z0-9_]{2,40}$' or p_cabin not in ('economy', 'premium', 'business', 'first')
     or p_miles not between 1000 and 1000000
     or p_date < current_date or p_date > current_date + 365 then
    raise exception 'Check the route, date and points.' using errcode = '22023';
  end if;
  -- At most 20 reports a day per person.
  if (select count(*) from public.award_reports r where r.user_id = v_user and r.created_at > now() - interval '1 day') >= 20 then
    raise exception 'That''s 20 reports today. Thank you! Try again tomorrow.' using errcode = '54000';
  end if;

  insert into public.award_reports (user_id, origin, destination, travel_date, program, cabin, miles, direct)
  values (v_user, p_origin, p_destination, p_date, p_program, p_cabin, p_miles, coalesce(p_direct, false));

  insert into public.award_availability as a (origin, destination, travel_date, program, cabin, miles, direct, data_source)
  values (p_origin, p_destination, p_date, p_program, p_cabin, p_miles, coalesce(p_direct, false), 'community')
  on conflict (data_source, origin, destination, travel_date, program, cabin) do update
    set miles = excluded.miles, direct = excluded.direct, seen_at = now(), closed_at = null;

  insert into public.award_availability_history (origin, destination, travel_date, program, cabin, data_source, change, miles)
  values (p_origin, p_destination, p_date, p_program, p_cabin, 'community', 'opened', p_miles);
end;
$$;
revoke execute on function public.report_award_seat(text, text, date, text, text, integer, boolean) from public, anon;
grant execute on function public.report_award_seat(text, text, date, text, text, integer, boolean) to authenticated;
