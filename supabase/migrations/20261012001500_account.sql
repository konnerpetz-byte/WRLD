-- =====================================================================
-- 15 · Account details and profile photos
--
-- profiles (name, photo, home country/currency/airport) is visible to
-- people you share a trip with. Phone and home address are private:
-- they live in account_details, which only you can read or change.
-- Deleting your account (Edge Function delete-account) removes all of it.
-- =====================================================================

create table public.account_details (
  user_id        uuid primary key references public.profiles (id) on delete cascade,
  phone          text check (char_length(phone) <= 32),
  address_line1  text check (char_length(address_line1) <= 200),
  address_line2  text check (char_length(address_line2) <= 200),
  city           text check (char_length(city) <= 120),
  region         text check (char_length(region) <= 120),
  postal_code    text check (char_length(postal_code) <= 20),
  country_code   text references public.countries (code),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index account_details_country_idx on public.account_details (country_code);
create trigger set_updated_at before update on public.account_details
  for each row execute function private.set_updated_at();

alter table public.account_details enable row level security;
create policy "account_details: own only (read)" on public.account_details
  for select to authenticated using (user_id = (select auth.uid()));
create policy "account_details: own only (create)" on public.account_details
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "account_details: own only (change)" on public.account_details
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update on public.account_details to authenticated;

-- Profile photos: public images, each person writes only their own folder (avatars/<user id>/...).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars: read own files" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: replace own files" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: remove own files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
