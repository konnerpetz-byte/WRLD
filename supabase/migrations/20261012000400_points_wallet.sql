-- =====================================================================
-- 04 · Points wallet
--
-- How balances arrive (no typing numbers in):
--   1. The user clicks "Connect" → signs in with AwardWallet (OAuth).
--      AwardWallet already tracks 600+ airline, hotel and card programs.
--   2. Our server stores the token in a private table the browser can't read.
--   3. A scheduled job (and a "Refresh" button) pulls every shared account
--      and upserts loyalty_accounts. Balance changes are logged to history.
--   Manual accounts are still allowed as a fallback for programs that
--   can't be synced.
--
-- Booking with points: lodging and transit rows record which account paid,
-- how many points, and the cash portion (taxes/fees) in `cost`.
-- =====================================================================

create type public.loyalty_program_kind as enum ('airline', 'hotel', 'bank', 'car_rental', 'other');
create type public.wallet_provider      as enum ('awardwallet');
create type public.connection_status    as enum ('pending', 'active', 'needs_reauth', 'error', 'revoked');
create type public.balance_source       as enum ('connected', 'manual');

-- ---------------------------------------------------------------------
-- Catalog (shared, read-only to users)
-- ---------------------------------------------------------------------
create table public.loyalty_programs (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique check (slug ~ '^[a-z0-9_]+$'),
  name                 text not null,
  kind                 public.loyalty_program_kind not null,
  unit_name            text not null default 'points',               -- 'miles', 'points', 'Avios'
  alliance             text,                                         -- star_alliance / oneworld / skyteam
  est_cents_per_point  numeric(6, 3) check (est_cents_per_point >= 0), -- rough value for comparisons
  awardwallet_code     text unique,                                  -- provider's program id, set by sync
  logo_url             text,
  created_at           timestamptz not null default now()
);

-- e.g. a bank program → an airline program at 1:1
create table public.transfer_partners (
  from_program_id  uuid not null references public.loyalty_programs (id) on delete cascade,
  to_program_id    uuid not null references public.loyalty_programs (id) on delete cascade,
  ratio_from       integer not null default 1 check (ratio_from > 0),
  ratio_to         integer not null default 1 check (ratio_to > 0),
  min_transfer     integer check (min_transfer > 0),
  typical_wait     text,                                             -- 'instant', 'up to 48h'
  updated_at       timestamptz not null default now(),
  primary key (from_program_id, to_program_id)
);
create index transfer_partners_to_idx on public.transfer_partners (to_program_id);

-- ---------------------------------------------------------------------
-- Per-user data
-- ---------------------------------------------------------------------
create table public.wallet_connections (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  provider          public.wallet_provider not null,
  status            public.connection_status not null default 'pending',
  external_user_id  text,
  last_synced_at    timestamptz,
  last_error        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint wallet_connections_one_per_provider unique (user_id, provider)
);

-- OAuth tokens. Lives in the private schema with NO grants: only the
-- service role (server routes / scheduled jobs) can read it.
-- Production: encrypt these with Supabase Vault.
create table private.wallet_connection_tokens (
  connection_id  uuid primary key references public.wallet_connections (id) on delete cascade,
  access_token   text not null,
  refresh_token  text,
  expires_at     timestamptz,
  updated_at     timestamptz not null default now()
);
revoke all on private.wallet_connection_tokens from public, anon, authenticated;

create table public.loyalty_accounts (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles (id) on delete cascade,
  program_id           uuid not null references public.loyalty_programs (id),
  connection_id        uuid references public.wallet_connections (id) on delete cascade,
  source               public.balance_source not null,
  external_account_id  text,                                         -- provider's account id
  member_last4         text check (member_last4 ~ '^[0-9A-Za-z]{1,4}$'), -- never the full number
  display_name         text,                                         -- e.g. "Shared household account"
  balance              bigint not null default 0 check (balance >= 0),
  elite_status         text,
  points_expire_on     date,
  last_synced_at       timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint loyalty_accounts_source_matches check ((source = 'connected') = (connection_id is not null)),
  constraint loyalty_accounts_external_unique unique (connection_id, external_account_id)
);
create index loyalty_accounts_user_idx    on public.loyalty_accounts (user_id);
create index loyalty_accounts_program_idx on public.loyalty_accounts (program_id);

create table public.loyalty_balance_history (
  id           bigint generated always as identity primary key,
  account_id   uuid not null references public.loyalty_accounts (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  balance      bigint not null,
  recorded_at  timestamptz not null default now()
);
create index loyalty_balance_history_account_idx on public.loyalty_balance_history (account_id, recorded_at desc);
create index loyalty_balance_history_user_idx    on public.loyalty_balance_history (user_id);

create trigger set_updated_at before update on public.wallet_connections
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.loyalty_accounts
  for each row execute function private.set_updated_at();

create or replace function private.log_balance_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.balance is distinct from old.balance then
    insert into public.loyalty_balance_history (account_id, user_id, balance)
    values (new.id, new.user_id, new.balance);
  end if;
  return null;
end;
$$;

create trigger log_balance_change
  after insert or update of balance on public.loyalty_accounts
  for each row execute function private.log_balance_change();

-- ---------------------------------------------------------------------
-- Paying with points on bookings
-- ---------------------------------------------------------------------
alter table public.lodging
  add column loyalty_program_id  uuid references public.loyalty_programs (id),
  add column loyalty_account_id  uuid references public.loyalty_accounts (id) on delete set null,
  add column points_used         integer check (points_used >= 0);

alter table public.transit_segments
  add column loyalty_program_id  uuid references public.loyalty_programs (id),
  add column loyalty_account_id  uuid references public.loyalty_accounts (id) on delete set null,
  add column points_used         integer check (points_used >= 0);

create index lodging_loyalty_account_idx on public.lodging (loyalty_account_id) where loyalty_account_id is not null;
create index transit_loyalty_account_idx on public.transit_segments (loyalty_account_id) where loyalty_account_id is not null;

-- How many points a user can reach in each program: what they hold
-- directly plus what they could transfer in from bank programs.
create view public.wallet_reachable_points
with (security_invoker = true) as
select a.user_id,
       a.program_id          as target_program_id,
       a.program_id          as via_program_id,
       'direct'::text        as route,
       a.balance             as points
from public.loyalty_accounts a
union all
select a.user_id,
       tp.to_program_id,
       a.program_id,
       'transfer'::text,
       (a.balance / tp.ratio_from) * tp.ratio_to
from public.loyalty_accounts a
join public.transfer_partners tp on tp.from_program_id = a.program_id;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.loyalty_programs        enable row level security;
alter table public.transfer_partners       enable row level security;
alter table public.wallet_connections      enable row level security;
alter table public.loyalty_accounts        enable row level security;
alter table public.loyalty_balance_history enable row level security;

create policy "programs: signed-in read" on public.loyalty_programs
  for select to authenticated using (true);
create policy "transfers: signed-in read" on public.transfer_partners
  for select to authenticated using (true);

-- Connections are created/updated by the server during OAuth;
-- users can see theirs and disconnect.
create policy "connections: own read" on public.wallet_connections
  for select to authenticated using (user_id = (select auth.uid()));
create policy "connections: own disconnect" on public.wallet_connections
  for delete to authenticated using (user_id = (select auth.uid()));

-- Connected balances are written only by the sync job.
-- Users fully manage their own manual accounts.
create policy "accounts: own read" on public.loyalty_accounts
  for select to authenticated using (user_id = (select auth.uid()));
create policy "accounts: own manual insert" on public.loyalty_accounts
  for insert to authenticated
  with check (user_id = (select auth.uid()) and source = 'manual');
create policy "accounts: own manual update" on public.loyalty_accounts
  for update to authenticated
  using (user_id = (select auth.uid()) and source = 'manual')
  with check (user_id = (select auth.uid()) and source = 'manual');
create policy "accounts: own manual delete" on public.loyalty_accounts
  for delete to authenticated
  using (user_id = (select auth.uid()) and source = 'manual');

create policy "balance history: own read" on public.loyalty_balance_history
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Starter catalog. The sync job adds any other program it encounters.
-- Transfer ratios change often, so they're loaded by a maintained job,
-- not hard-coded here.
-- ---------------------------------------------------------------------
insert into public.loyalty_programs (slug, name, kind, unit_name, alliance) values
  ('chase_ultimate_rewards',  'Chase Ultimate Rewards',     'bank',    'points', null),
  ('amex_membership_rewards', 'Amex Membership Rewards',    'bank',    'points', null),
  ('capital_one_miles',       'Capital One Miles',          'bank',    'miles',  null),
  ('citi_thankyou',           'Citi ThankYou Points',       'bank',    'points', null),
  ('bilt_rewards',            'Bilt Rewards',               'bank',    'points', null),
  ('delta_skymiles',          'Delta SkyMiles',             'airline', 'miles',  'skyteam'),
  ('united_mileageplus',      'United MileagePlus',         'airline', 'miles',  'star_alliance'),
  ('american_aadvantage',     'American AAdvantage',        'airline', 'miles',  'oneworld'),
  ('southwest_rapid_rewards', 'Southwest Rapid Rewards',    'airline', 'points', null),
  ('jetblue_trueblue',        'JetBlue TrueBlue',           'airline', 'points', null),
  ('aircanada_aeroplan',      'Air Canada Aeroplan',        'airline', 'points', 'star_alliance'),
  ('flying_blue',             'Air France-KLM Flying Blue', 'airline', 'miles',  'skyteam'),
  ('british_airways_club',    'British Airways Club',       'airline', 'Avios',  'oneworld'),
  ('marriott_bonvoy',         'Marriott Bonvoy',            'hotel',   'points', null),
  ('hilton_honors',           'Hilton Honors',              'hotel',   'points', null),
  ('world_of_hyatt',          'World of Hyatt',             'hotel',   'points', null),
  ('ihg_one_rewards',         'IHG One Rewards',            'hotel',   'points', null);
