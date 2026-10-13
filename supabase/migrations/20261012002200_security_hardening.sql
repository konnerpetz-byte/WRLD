-- Security hardening (defense in depth; RLS already guards every row).

-- 1) pg_net (outbound HTTP) is owned by the platform, so its grants can't be changed here.
--    It is safe because the `net` schema isn't exposed through the API and no public
--    function passes a caller-supplied URL to it. Keep it that way.

-- 2) Table privileges the API never needs.
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;
-- Signed-out visitors never write anything.
revoke insert, update, delete on all tables in schema public from anon;
-- Signed-out visitors can only read shared reference data.
revoke select on all tables in schema public from anon;
grant select on public.attractions, public.countries, public.currencies, public.exchange_rates,
  public.interest_tags, public.loyalty_programs, public.transfer_partners to anon;

-- Same rules for tables created later.
alter default privileges in schema public revoke truncate, trigger, references on tables from anon, authenticated;
alter default privileges in schema public revoke insert, update, delete, select on tables from anon;

-- 3) Avatars: images only, 5 MB max (matches the upload form) (blocks HTML/SVG uploads on the public bucket).
update storage.buckets
  set file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
  where id = 'avatars';

-- 4) Every stored link must be a plain http(s) URL, so no one can save a
--    "javascript:" or "data:" link that runs when a tripmate clicks it,
--    even by writing to the API directly.
alter table public.attractions        add constraint attractions_official_url_http  check (official_url is null or official_url ~* '^https?://[^[:space:]]+$');
alter table public.attractions        add constraint attractions_tickets_url_http   check (tickets_url is null or tickets_url ~* '^https?://[^[:space:]]+$');
alter table public.checklist_items    add constraint checklist_items_info_url_http  check (info_url is null or info_url ~* '^https?://[^[:space:]]+$');
alter table public.itinerary_items    add constraint itinerary_items_booking_url_http check (booking_url is null or booking_url ~* '^https?://[^[:space:]]+$');
alter table public.itinerary_items    add constraint itinerary_items_official_url_http check (official_url is null or official_url ~* '^https?://[^[:space:]]+$');
alter table public.lodging            add constraint lodging_booking_url_http       check (booking_url is null or booking_url ~* '^https?://[^[:space:]]+$');
alter table public.loyalty_programs   add constraint loyalty_programs_logo_url_http check (logo_url is null or logo_url ~* '^https?://[^[:space:]]+$');
alter table public.profiles           add constraint profiles_avatar_url_http       check (avatar_url is null or avatar_url ~* '^https?://[^[:space:]]+$');
alter table public.saved_spots        add constraint saved_spots_url_http           check (url is null or url ~* '^https?://[^[:space:]]+$');
alter table public.saved_spots        add constraint saved_spots_thumbnail_url_http check (thumbnail_url is null or thumbnail_url ~* '^https?://[^[:space:]]+$');
alter table public.transit_segments   add constraint transit_segments_booking_url_http check (booking_url is null or booking_url ~* '^https?://[^[:space:]]+$');
alter table public.trip_recommendations add constraint trip_recommendations_booking_url_http check (booking_url is null or booking_url ~* '^https?://[^[:space:]]+$');
alter table public.trip_recommendations add constraint trip_recommendations_image_url_http check (image_url is null or image_url ~* '^https?://[^[:space:]]+$');
alter table public.trips              add constraint trips_cover_image_url_http     check (cover_image_url is null or cover_image_url ~* '^https?://[^[:space:]]+$');
