-- =====================================================================
-- Private group budget: each traveler says, privately, what they're
-- comfortable spending per person on this trip. The group only ever sees
-- the lowest answer, rounded down to $25, and only once at least two
-- people have answered, so nobody has to say a number out loud.
-- =====================================================================
create table public.trip_budget_comfort (
  trip_id    uuid not null references public.trips (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amount     numeric(12, 2) not null check (amount > 0 and amount < 10000000),
  updated_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

alter table public.trip_budget_comfort enable row level security;
revoke all on public.trip_budget_comfort from anon, authenticated;
grant select, insert, update on public.trip_budget_comfort to authenticated;

-- Only your own answer, and only on trips you belong to.
create policy "comfort: read own" on public.trip_budget_comfort for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "comfort: add own" on public.trip_budget_comfort for insert to authenticated
  with check ((select auth.uid()) = user_id and private.is_trip_member(trip_id));
create policy "comfort: change own" on public.trip_budget_comfort for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and private.is_trip_member(trip_id));

-- What the group is allowed to know.
create function public.trip_budget_comfort_summary(p_trip_id uuid)
returns table (responses integer, members integer, comfortable numeric, mine numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_members integer;
  v_responses integer;
  v_min numeric;
  v_mine numeric;
begin
  if (select auth.uid()) is null or not private.is_trip_member(p_trip_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select count(*) into v_members from public.trip_members m where m.trip_id = p_trip_id;
  select count(*), min(c.amount) into v_responses, v_min
    from public.trip_budget_comfort c
    join public.trip_members m on m.trip_id = c.trip_id and m.user_id = c.user_id
   where c.trip_id = p_trip_id;
  select c.amount into v_mine from public.trip_budget_comfort c
   where c.trip_id = p_trip_id and c.user_id = (select auth.uid());

  return query select
    v_responses,
    v_members,
    case
      when v_members <= 1 then v_mine
      when v_responses >= 2 then floor(v_min / 25) * 25
      else null
    end,
    v_mine;
end;
$$;
revoke execute on function public.trip_budget_comfort_summary(uuid) from public, anon;
grant execute on function public.trip_budget_comfort_summary(uuid) to authenticated;
