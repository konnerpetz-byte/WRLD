-- First-run tour: set when a traveler finishes or skips it, so it shows once.
alter table public.profiles add column tour_seen_at timestamptz;
-- Existing travelers already know their way around: don't interrupt them.
update public.profiles set tour_seen_at = now() where created_at < now() - interval '1 day';
