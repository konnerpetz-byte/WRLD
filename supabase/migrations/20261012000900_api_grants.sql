-- =====================================================================
-- 09 · Data API access
--
-- Newer Supabase projects may not expose new tables to the API
-- automatically. These grants make the tables reachable; row level
-- security (enabled on every table above) still decides which rows
-- each person can see or change.
-- =====================================================================

grant usage on schema public to anon, authenticated;

-- Reference data anyone can read (sign-up page needs countries/currencies)
grant select on public.currencies, public.countries, public.exchange_rates, public.interest_tags
  to anon, authenticated;

-- Read-only to signed-in users
grant select on
  public.loyalty_programs, public.transfer_partners, public.loyalty_balance_history,
  public.wallet_connections,
  public.wallet_reachable_points, public.trip_planned_costs, public.trip_budget_overview,
  public.trip_budget_by_category, public.trip_points_planned, public.my_booking_history
to authenticated;

grant delete on public.wallet_connections to authenticated;

-- Full access, limited by RLS policies
grant select, insert, update, delete on
  public.trips, public.trip_members, public.itinerary_items, public.lodging,
  public.transit_segments, public.expenses, public.loyalty_accounts,
  public.traveler_interests, public.experience_ratings
to authenticated;

grant select, update on
  public.profiles, public.trip_days, public.time_blocks,
  public.traveler_profiles, public.trip_recommendations
to authenticated;
