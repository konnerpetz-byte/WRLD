-- Tickets, boarding passes and confirmations, kept with the trip (and optionally a booking).
-- Files live in the private 'trip-files' bucket at "<trip_id>/<file id>-<name>".
create table public.trip_files (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  booking_type text not null default 'trip' check (booking_type in ('trip', 'transit', 'lodging', 'item')),
  booking_id uuid,
  name text not null check (char_length(name) between 1 and 200),
  path text not null unique check (char_length(path) <= 400),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 15728640),
  mime text not null check (char_length(mime) <= 100),
  uploaded_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index trip_files_trip_idx on public.trip_files (trip_id, created_at);
create index trip_files_uploaded_by_idx on public.trip_files (uploaded_by);
alter table public.trip_files enable row level security;

create policy "Trip members see trip files" on public.trip_files for select to authenticated
  using ((select private.is_trip_member(trip_id)));
create policy "Trip editors add files" on public.trip_files for insert to authenticated
  with check ((select private.can_edit_trip(trip_id)) and uploaded_by = (select auth.uid()) and path like trip_id::text || '/%');
create policy "Uploader or trip editor removes files" on public.trip_files for delete to authenticated
  using (uploaded_by = (select auth.uid()) or (select private.can_edit_trip(trip_id)));
create policy "Trip editors relink files" on public.trip_files for update to authenticated
  using ((select private.can_edit_trip(trip_id))) with check ((select private.can_edit_trip(trip_id)));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trip-files', 'trip-files', false, 15728640,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/vnd.apple.pkpass', 'text/plain', 'message/rfc822'])
on conflict (id) do nothing;

create policy "trip-files: members read" on storage.objects for select to authenticated
  using (bucket_id = 'trip-files' and (select private.is_trip_member(((storage.foldername(name))[1])::uuid)));
create policy "trip-files: editors upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'trip-files' and (select private.can_edit_trip(((storage.foldername(name))[1])::uuid)));
create policy "trip-files: editors remove" on storage.objects for delete to authenticated
  using (bucket_id = 'trip-files' and (select private.can_edit_trip(((storage.foldername(name))[1])::uuid)));
