-- The group's private max is shown only when everyone on the trip has answered, or when an
-- organizer chooses to go ahead without the rest. Revealing it after two answers let people work
-- out each other's numbers as it changed. Members can see who has answered, never what.
alter table public.trips add column if not exists comfort_released_at timestamptz;

create or replace function public.trip_budget_comfort_summary(p_trip_id uuid)
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
  v_released boolean;
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
  select t.comfort_released_at is not null into v_released from public.trips t where t.id = p_trip_id;

  return query select
    v_responses,
    v_members,
    case
      when v_members <= 1 then v_mine
      when v_responses >= 2 and (v_responses >= v_members or v_released) then floor(v_min / 25) * 25
      else null
    end,
    v_mine;
end;
$$;

-- Who has answered (names only), for the trip's members.
create or replace function public.trip_budget_comfort_answered(p_trip_id uuid)
returns table (user_id uuid, name text, answered boolean, is_me boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.is_trip_member(p_trip_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
    select m.user_id,
           coalesce(nullif(trim(p.display_name), ''), 'A traveler'),
           exists (select 1 from public.trip_budget_comfort c where c.trip_id = p_trip_id and c.user_id = m.user_id),
           m.user_id = (select auth.uid())
      from public.trip_members m
      left join public.profiles p on p.id = m.user_id
     where m.trip_id = p_trip_id
     order by m.created_at;
end;
$$;
revoke execute on function public.trip_budget_comfort_answered(uuid) from public, anon;
grant execute on function public.trip_budget_comfort_answered(uuid) to authenticated;

-- Organizer: show the group number now, with the answers so far (at least two).
create or replace function public.release_comfort_budget(p_trip_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.can_edit_trip(p_trip_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.trips set comfort_released_at = now() where id = p_trip_id and comfort_released_at is null;
  return true;
end;
$$;
revoke execute on function public.release_comfort_budget(uuid) from public, anon;
grant execute on function public.release_comfort_budget(uuid) to authenticated;
