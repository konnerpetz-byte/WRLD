-- =====================================================================
-- 07 · Trip budget
--
-- Adds up everything with a price in the plan, in the trip's currency:
--   activities + lodging + transit  → "planned"
--   + expenses not tied to a booking (food, shopping, taxis…) → "projected total"
--
-- Example: museum $50 + lodging $200 + flight $500 = $750 planned.
--
-- Planned costs are split by booking status so the UI can show both:
--   committed = booked or held   (money you're on the hook for)
--   ideas     = still just ideas (what the full plan would cost)
-- Cancelled items are ignored.
--
-- Expenses linked to a booking are NOT added again — the booking's
-- planned cost already counts it.
-- =====================================================================

-- How many people the trip's costs are shared across (for per-person totals).
alter table public.trips
  add column party_size smallint not null default 1 check (party_size between 1 and 50);

-- ---------------------------------------------------------------------
-- One row per priced thing in the plan
-- ---------------------------------------------------------------------
create view public.trip_planned_costs
with (security_invoker = true) as
with priced as (
  select i.trip_id,
         'activity'::text                                       as source,
         i.id                                                   as source_id,
         i.title,
         case i.kind when 'meal' then 'food' else 'activities' end::public.expense_category as category,
         i.booking_status,
         d.date                                                 as on_date,
         i.cost,
         i.currency,
         null::uuid                                             as loyalty_program_id,
         null::integer                                          as points_used
  from public.itinerary_items i
  join public.time_blocks b on b.id = i.time_block_id
  join public.trip_days   d on d.id = b.day_id
  where i.cost is not null

  union all

  select l.trip_id, 'lodging', l.id, l.name, 'lodging', l.booking_status,
         (l.check_in_at at time zone t.timezone)::date,
         l.cost, l.currency, l.loyalty_program_id, l.points_used
  from public.lodging l
  join public.trips t on t.id = l.trip_id
  where l.cost is not null or l.points_used is not null

  union all

  select s.trip_id, 'transit', s.id,
         coalesce(concat_ws(' ', s.carrier, s.service_number), s.mode::text),
         'transit', s.booking_status,
         (s.depart_at at time zone t.timezone)::date,
         s.cost, s.currency, s.loyalty_program_id, s.points_used
  from public.transit_segments s
  join public.trips t on t.id = s.trip_id
  where s.cost is not null or s.points_used is not null
)
select p.*,
       t.currency                                               as trip_currency,
       -- No currency on the item → assume it's priced in the trip currency.
       -- Planned items use the latest rate; they haven't been paid yet.
       public.convert_currency(coalesce(p.cost, 0), coalesce(p.currency, t.currency), t.currency)
                                                                as cost_in_trip_currency
from priced p
join public.trips t on t.id = p.trip_id
where p.booking_status <> 'cancelled';

-- ---------------------------------------------------------------------
-- The numbers for the Budget tab header
-- ---------------------------------------------------------------------
create view public.trip_budget_overview
with (security_invoker = true) as
with planned as (
  select pc.trip_id,
         coalesce(sum(pc.cost_in_trip_currency) filter (where pc.booking_status in ('booked', 'held')), 0) as committed,
         coalesce(sum(pc.cost_in_trip_currency) filter (where pc.booking_status = 'idea'), 0)              as ideas,
         count(*) filter (where pc.cost_in_trip_currency is null)                                          as missing_rate
  from public.trip_planned_costs pc
  group by pc.trip_id
),
spent as (
  select e.trip_id,
         coalesce(sum(e.amount_in_trip_currency), 0) as spent_total,
         coalesce(sum(e.amount_in_trip_currency)
                    filter (where num_nonnulls(e.lodging_id, e.transit_segment_id, e.itinerary_item_id) = 0), 0)
                                                     as spent_unplanned,
         count(*) filter (where e.amount_in_trip_currency is null) as missing_rate
  from public.expenses e
  group by e.trip_id
),
totals as (
  select t.id                                          as trip_id,
         t.currency,
         t.budget,
         t.party_size,
         coalesce(p.committed, 0)                      as planned_committed,
         coalesce(p.ideas, 0)                          as planned_ideas,
         coalesce(p.committed, 0) + coalesce(p.ideas, 0) as planned_total,
         coalesce(s.spent_total, 0)                    as spent_total,
         coalesce(s.spent_unplanned, 0)                as spent_unplanned,
         coalesce(p.missing_rate, 0) + coalesce(s.missing_rate, 0) as items_missing_rate
  from public.trips t
  left join planned p on p.trip_id = t.id
  left join spent   s on s.trip_id = t.id
)
select x.*,
       x.planned_committed + x.spent_unplanned               as projected_committed,  -- bookings only
       x.planned_total     + x.spent_unplanned               as projected_total,      -- incl. ideas
       round((x.planned_total + x.spent_unplanned) / x.party_size, 2) as projected_per_person,
       x.budget - (x.planned_total + x.spent_unplanned)      as remaining              -- null if no budget set
from totals x;

-- ---------------------------------------------------------------------
-- Breakdown for the category bars / donut
-- ---------------------------------------------------------------------
create view public.trip_budget_by_category
with (security_invoker = true) as
select trip_id,
       category,
       sum(committed) as committed,
       sum(ideas)     as ideas,
       sum(spent)     as spent_unplanned,
       sum(committed) + sum(ideas) + sum(spent) as total
from (
  select pc.trip_id, pc.category,
         case when pc.booking_status in ('booked', 'held') then coalesce(pc.cost_in_trip_currency, 0) else 0 end as committed,
         case when pc.booking_status = 'idea'              then coalesce(pc.cost_in_trip_currency, 0) else 0 end as ideas,
         0::numeric as spent
  from public.trip_planned_costs pc
  union all
  select e.trip_id, e.category, 0, 0, coalesce(e.amount_in_trip_currency, 0)
  from public.expenses e
  where num_nonnulls(e.lodging_id, e.transit_segment_id, e.itinerary_item_id) = 0
) parts
group by trip_id, category;

-- Points planned per program ("plus 60,000 World of Hyatt points").
create view public.trip_points_planned
with (security_invoker = true) as
select pc.trip_id,
       pc.loyalty_program_id,
       sum(pc.points_used) filter (where pc.booking_status in ('booked', 'held')) as points_committed,
       sum(pc.points_used) filter (where pc.booking_status = 'idea')              as points_ideas
from public.trip_planned_costs pc
where pc.loyalty_program_id is not null and pc.points_used is not null
group by pc.trip_id, pc.loyalty_program_id;
