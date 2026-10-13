-- "Login with Seats.aero": a traveler links their own Seats.aero Pro account
-- (official OAuth2), and the Points explorer searches live award seats with
-- their own daily allowance. Tokens are encrypted at rest with a Vault key,
-- live in the private schema (not exposed by the API), and are only reachable
-- through the functions below, each scoped to the signed-in user.

select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'seats_token_key', 'Encrypts linked Seats.aero tokens')
where not exists (select 1 from vault.secrets where name = 'seats_token_key');

create table private.seats_aero_links (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  access_token   bytea not null,
  refresh_token  bytea not null,
  expires_at     timestamptz not null,
  connected_at   timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table private.seats_aero_links enable row level security;
revoke all on private.seats_aero_links from public, anon, authenticated;

create or replace function private.seats_key() returns text
language sql stable security definer set search_path = ''
as $$ select decrypted_secret from vault.decrypted_secrets where name = 'seats_token_key' $$;
revoke all on function private.seats_key() from public, anon, authenticated;

-- Save (or replace) the signed-in user's tokens.
create or replace function public.seats_link_save(p_access text, p_refresh text, p_expires_in integer)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'Sign in first' using errcode = '28000'; end if;
  if p_access !~ '^seats:ota:' or p_refresh !~ '^seats:otr:' or length(p_access) > 2000 or length(p_refresh) > 2000
     or p_expires_in not between 60 and 31536000 then
    raise exception 'Unexpected token' using errcode = '22023';
  end if;
  insert into private.seats_aero_links (user_id, access_token, refresh_token, expires_at)
  values (v_user, extensions.pgp_sym_encrypt(p_access, private.seats_key()), extensions.pgp_sym_encrypt(p_refresh, private.seats_key()),
          now() + make_interval(secs => p_expires_in - 60))
  on conflict (user_id) do update
    set access_token = excluded.access_token, refresh_token = excluded.refresh_token,
        expires_at = excluded.expires_at, updated_at = now();
end;
$$;

-- The signed-in user's tokens (for the server to call Seats.aero on their behalf).
create or replace function public.seats_link_get()
returns table (access_token text, refresh_token text, expires_at timestamptz, connected_at timestamptz)
language sql security definer set search_path = ''
as $$
  select extensions.pgp_sym_decrypt(l.access_token, private.seats_key()),
         extensions.pgp_sym_decrypt(l.refresh_token, private.seats_key()),
         l.expires_at, l.connected_at
  from private.seats_aero_links l
  where l.user_id = (select auth.uid());
$$;

create or replace function public.seats_link_delete()
returns void
language sql security definer set search_path = ''
as $$ delete from private.seats_aero_links where user_id = (select auth.uid()); $$;

revoke all on function public.seats_link_save(text, text, integer) from public, anon;
revoke all on function public.seats_link_get() from public, anon;
revoke all on function public.seats_link_delete() from public, anon;
grant execute on function public.seats_link_save(text, text, integer) to authenticated;
grant execute on function public.seats_link_get() to authenticated;
grant execute on function public.seats_link_delete() to authenticated;
