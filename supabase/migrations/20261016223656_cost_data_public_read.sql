-- Public government data and a two-row factor table: readable without signing in (the planner preview and future public pages use it).
create policy "Anyone reads per diem rates" on public.cost_per_diem for select to anon using (true);
create policy "Anyone reads calibration" on public.cost_calibration for select to anon using (true);
