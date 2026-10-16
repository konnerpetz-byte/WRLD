-- Planner usage: one event per planner run. provider = how it was started:
-- 'explore' (budget first, "where can I go"), 'trip' (destination first, from a trip), 'trip_nobudget'.
-- count = trips that fit (capped at 50).
alter table public.app_events drop constraint app_events_kind_check;
alter table public.app_events add constraint app_events_kind_check check (kind = any (array['booking_click', 'suggestions_shown', 'planner_run']));
