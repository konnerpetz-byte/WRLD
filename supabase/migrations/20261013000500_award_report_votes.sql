-- "Still there?" votes on traveler-reported seats. A "still there" vote
-- refreshes the report; two "gone" votes (or more gone than still) close it.
create table public.award_report_votes (
  availability_id bigint not null references public.award_availability (id) on delete cascade,
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  still_there     boolean not null,
  created_at      timestamptz not null default now(),
  primary key (availability_id, user_id)
);
alter table public.award_report_votes enable row level security;
revoke all on public.award_report_votes from anon, authenticated;

create function public.vote_award_seat(p_id bigint, p_still boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_still integer;
  v_gone integer;
begin
  if v_user is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if not exists (select 1 from public.award_availability a where a.id = p_id and a.data_source = 'community' and a.closed_at is null) then
    raise exception 'That report is no longer open.' using errcode = 'P0002';
  end if;
  if (select count(*) from public.award_report_votes v where v.user_id = v_user and v.created_at > now() - interval '1 day') >= 50 then
    raise exception 'Too many votes today.' using errcode = '54000';
  end if;

  insert into public.award_report_votes (availability_id, user_id, still_there) values (p_id, v_user, p_still)
  on conflict (availability_id, user_id) do update set still_there = excluded.still_there, created_at = now();

  select count(*) filter (where still_there), count(*) filter (where not still_there)
    into v_still, v_gone from public.award_report_votes where availability_id = p_id;

  if p_still then
    update public.award_availability set seen_at = now() where id = p_id;
  end if;
  if v_gone >= 2 and v_gone > v_still then
    update public.award_availability set closed_at = now() where id = p_id;
    insert into public.award_availability_history (origin, destination, travel_date, program, cabin, data_source, change, previous_miles)
    select origin, destination, travel_date, program, cabin, data_source, 'closed', miles from public.award_availability where id = p_id;
    return 'closed';
  end if;
  return 'counted';
end;
$$;
revoke execute on function public.vote_award_seat(bigint, boolean) from public, anon;
grant execute on function public.vote_award_seat(bigint, boolean) to authenticated;
