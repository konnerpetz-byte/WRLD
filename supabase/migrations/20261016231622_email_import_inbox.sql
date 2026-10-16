-- Forward-to-import: each traveler gets a private address (<import_token>@<inbound domain>).
-- Forwarded confirmations land in import_inbox; nothing is added to a trip until the traveler reviews it.
alter table public.profiles add column import_token uuid not null default gen_random_uuid();
create unique index profiles_import_token_idx on public.profiles (import_token);

create table public.import_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_address text check (char_length(from_address) <= 320),
  subject text check (char_length(subject) <= 500),
  text_body text check (char_length(text_body) <= 200000),
  html_body text check (char_length(html_body) <= 400000),
  -- [{ name, mime, size, path }] in the private import-inbox bucket
  attachments jsonb not null default '[]'::jsonb,
  status text not null default 'new' check (status in ('new', 'imported', 'dismissed')),
  trip_id uuid references public.trips(id) on delete set null,
  received_at timestamptz not null default now()
);
create index import_inbox_user_idx on public.import_inbox (user_id, received_at desc);
create index import_inbox_trip_idx on public.import_inbox (trip_id);
alter table public.import_inbox enable row level security;
create policy "Travelers see their own inbox" on public.import_inbox for select to authenticated using (user_id = (select auth.uid()));
create policy "Travelers update their own inbox" on public.import_inbox for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Travelers delete from their own inbox" on public.import_inbox for delete to authenticated using (user_id = (select auth.uid()));
-- Rows are only written by the inbound-email Edge Function (service role).

insert into storage.buckets (id, name, public, file_size_limit)
values ('import-inbox', 'import-inbox', false, 10485760)
on conflict (id) do nothing;
create policy "import-inbox: read own" on storage.objects for select to authenticated
  using (bucket_id = 'import-inbox' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "import-inbox: remove own" on storage.objects for delete to authenticated
  using (bucket_id = 'import-inbox' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Shared secret for the inbound webhook URL, generated here (never typed or sent in chat).
select vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'inbound_email_secret', 'email provider -> inbound-email edge function');

create function public.inbound_email_secret_ok(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'inbound_email_secret' and decrypted_secret = p_key);
$$;
revoke execute on function public.inbound_email_secret_ok(text) from public, anon, authenticated;
grant execute on function public.inbound_email_secret_ok(text) to service_role;

-- The webhook URL to paste into the email provider; admins only (shown on /admin/stats).
create function public.inbound_email_webhook_url()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return 'https://zzbbjhokowvmpuuzsbjq.supabase.co/functions/v1/inbound-email?key='
    || (select decrypted_secret from vault.decrypted_secrets where name = 'inbound_email_secret');
end;
$$;
revoke execute on function public.inbound_email_webhook_url() from public, anon;
grant execute on function public.inbound_email_webhook_url() to authenticated;
