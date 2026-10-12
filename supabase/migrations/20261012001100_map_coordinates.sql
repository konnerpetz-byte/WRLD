-- =====================================================================
-- 11 · Coordinates for the trip map
-- Activities and stays already have latitude/longitude. This adds:
--   trips: the destination's center (map starting view, search bias)
--   transit_segments: both ends of each leg (airport/station pins and lines)
-- =====================================================================

alter table public.trips
  add column latitude  double precision check (latitude between -90 and 90),
  add column longitude double precision check (longitude between -180 and 180);

alter table public.transit_segments
  add column origin_latitude       double precision check (origin_latitude between -90 and 90),
  add column origin_longitude      double precision check (origin_longitude between -180 and 180),
  add column destination_latitude  double precision check (destination_latitude between -90 and 90),
  add column destination_longitude double precision check (destination_longitude between -180 and 180);
