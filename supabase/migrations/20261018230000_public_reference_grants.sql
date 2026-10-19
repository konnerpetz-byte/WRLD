-- Public reference data read by the signed-out planner (/plan). Row-level policies for anon
-- already exist; the table grants were missing, so anon reads failed with "permission denied".
grant select on public.cost_per_diem to anon;
grant select on public.cost_calibration to anon;
grant select on public.airport_routes to anon;
