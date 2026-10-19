-- Each GSA destination's hotel rate for a month against its own yearly average (1 = average).
-- The planner uses this to price hotels by month. Runs with the caller's rights, so the
-- cost_per_diem read policies apply.
create view public.cost_gsa_season with (security_invoker = true) as
select
  location,
  state,
  extract(month from season_start)::int as month,
  lodging,
  round(lodging / nullif(avg(lodging) over (partition by location_code), 0), 3) as factor
from public.cost_per_diem
where source = 'gsa';

grant select on public.cost_gsa_season to anon, authenticated;
