-- =====================================================================
-- 08 · Automatic activity pricing
--
-- Activities store a ticket price (unit_price) and the database works out
-- the total cost:  cost = unit_price × quantity
--   * quantity null  → the whole party (trips.party_size), kept in sync
--     when the party size changes
--   * quantity set   → the user overrode it ("only 1 ticket")
--
-- Where prices come from (price_source):
--   provider → added from a recommendation or search result (exact price)
--   estimate → typed in by name; the server matched it to a provider listing
--   manual   → the user entered or edited the price
--
-- The budget views (migration 07) read `cost`, so totals update on their own.
-- =====================================================================

create type public.price_source as enum ('provider', 'estimate', 'manual');

alter table public.itinerary_items
  add column unit_price        numeric(12, 2) check (unit_price >= 0),
  add column quantity          smallint check (quantity between 1 and 50),
  add column price_source      public.price_source,
  add column price_checked_at  timestamptz;

create or replace function private.compute_item_cost()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.unit_price is not null then
    new.cost := new.unit_price * coalesce(
      new.quantity,
      (select t.party_size from public.trips t where t.id = new.trip_id),
      1
    );
  end if;
  return new;
end;
$$;

create trigger compute_item_cost
  before insert or update of unit_price, quantity on public.itinerary_items
  for each row execute function private.compute_item_cost();

-- Party size changed → re-total every "whole party" ticket.
create or replace function private.recompute_party_costs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.itinerary_items i
  set cost = i.unit_price * new.party_size
  where i.trip_id = new.id
    and i.unit_price is not null
    and i.quantity is null;
  return null;
end;
$$;

create trigger recompute_party_costs
  after update of party_size on public.trips
  for each row
  when (old.party_size is distinct from new.party_size)
  execute function private.recompute_party_costs();

-- ---------------------------------------------------------------------
-- One call to put a recommendation on the itinerary, price included.
-- Runs as the caller, so normal access rules apply.
-- ---------------------------------------------------------------------
create or replace function public.add_recommendation_to_trip(
  p_recommendation_id uuid,
  p_time_block_id     uuid default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_rec     public.trip_recommendations;
  v_block   uuid;
  v_item_id uuid;
begin
  select * into v_rec from public.trip_recommendations where id = p_recommendation_id;
  if v_rec.id is null then
    raise exception 'recommendation not found';
  end if;

  v_block := coalesce(p_time_block_id, v_rec.suggested_time_block_id);
  if v_block is null then
    raise exception 'pick a time block for this activity';
  end if;

  insert into public.itinerary_items (
    trip_id, time_block_id, kind, title, description, tags,
    provider, provider_ref, booking_url,
    unit_price, currency, price_source, price_checked_at, created_by
  ) values (
    v_rec.trip_id, v_block, 'activity', v_rec.title, v_rec.summary, v_rec.tags,
    v_rec.provider, v_rec.provider_ref, v_rec.booking_url,
    v_rec.price, v_rec.currency, case when v_rec.price is null then null else 'provider' end::public.price_source,
    case when v_rec.price is null then null else now() end, (select auth.uid())
  )
  returning id into v_item_id;

  update public.trip_recommendations set status = 'added' where id = v_rec.id;
  return v_item_id;
end;
$$;

grant execute on function public.add_recommendation_to_trip(uuid, uuid) to authenticated;
