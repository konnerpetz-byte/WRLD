-- =====================================================================
-- 10 · Indexes covering the composite keys used when a trip is shortened
-- (days → time blocks → activities cascade). Reference-data links
-- (currencies, countries, loyalty programs) are left unindexed on purpose:
-- those rows are never deleted.
-- =====================================================================

create index time_blocks_day_trip_idx       on public.time_blocks (day_id, trip_id);
create index itinerary_items_block_trip_idx on public.itinerary_items (time_block_id, trip_id);
