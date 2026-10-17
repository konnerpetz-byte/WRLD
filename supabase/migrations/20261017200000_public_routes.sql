-- The public budget planner (/plan) prices trips for visitors without an account.
-- Airline routes are public schedule data, so anyone may read them (still read-only).
create policy "routes: anyone reads" on public.airport_routes for select to anon using (true);
