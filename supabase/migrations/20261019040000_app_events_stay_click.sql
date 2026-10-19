-- Count clicks on the planner's live-stay links (Airbnb, Booking.com, Google Hotels).
alter table public.app_events drop constraint app_events_kind_check;
alter table public.app_events add constraint app_events_kind_check check (kind = any (array['booking_click', 'suggestions_shown', 'planner_run', 'stay_click']));
