-- =====================================================================
-- 14 · Traveling together
--   trip_invites          share a link; whoever opens it joins the trip
--   trip_messages         group chat per trip (live via Supabase Realtime)
--   trip_members.last_read_at   unread counts
--   expense_participants  who an expense is split between (none = everyone)
--   settlements           "Sam paid Alex back €40"
--   checklist_items       shared packing list and to-dos
--   item_votes            thumbs-up on ideas in the itinerary
--   saved_spots           reels, TikToks and links shared into WRLD, saved
--                         to a trip's ideas (or just for you), optionally
--                         pinned to a place and linked to an itinerary item
-- =====================================================================

-- ---------------------------------------------------------------------
-- Invites
-- ---------------------------------------------------------------------
create table public.trip_invites (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips (id) on delete cascade,
  token       uuid not null unique default gen_random_uuid(),   -- the secret in the link
  role        public.trip_role not null default 'editor' check (role <> 'owner'),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '14 days',
  revoked_at  timestamptz,
  max_uses    smallint check (max_uses between 1 and 100),
  uses        smallint not null default 0
);
create index trip_invites_trip_idx on public.trip_invites (trip_id);

alter table public.trip_invites enable row level security;
create policy "invites: editors read" on public.trip_invites
  for select to authenticated using (private.can_edit_trip(trip_id));
create policy "invites: editors create" on public.trip_invites
  for insert to authenticated
  with check (private.can_edit_trip(trip_id) and created_by = (select auth.uid()));
create policy "invites: editors revoke" on public.trip_invites
  for update to authenticated
  using (private.can_edit_trip(trip_id)) with check (private.can_edit_trip(trip_id));
grant select, insert, update on public.trip_invites to authenticated;

-- What the invite page shows before you join (no member details).
create function public.invite_preview(p_token uuid)
returns table (trip_title text, destination text, start_date date, end_date date, invited_by text, role public.trip_role, valid boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select t.title, t.destination, t.start_date, t.end_date,
         coalesce(p.display_name, 'A WRLD traveler'), i.role,
         (i.revoked_at is null and i.expires_at > now() and (i.max_uses is null or i.uses < i.max_uses))
  from public.trip_invites i
  join public.trips t on t.id = i.trip_id
  left join public.profiles p on p.id = i.created_by
  where i.token = p_token;
$$;
grant execute on function public.invite_preview(uuid) to anon, authenticated;

-- Join a trip from an invite link. Returns the trip id.
create function public.accept_trip_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user   uuid := (select auth.uid());
  v_invite public.trip_invites;
begin
  if v_user is null then
    raise exception 'Sign in to join this trip' using errcode = '28000';
  end if;

  select * into v_invite from public.trip_invites where token = p_token for update;
  if not found
     or v_invite.revoked_at is not null
     or v_invite.expires_at <= now()
     or (v_invite.max_uses is not null and v_invite.uses >= v_invite.max_uses) then
    raise exception 'This invite link has expired. Ask for a new one.' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.trip_members where trip_id = v_invite.trip_id and user_id = v_user) then
    return v_invite.trip_id;  -- already on the trip; keep their current role
  end if;

  insert into public.trip_members (trip_id, user_id, role) values (v_invite.trip_id, v_user, v_invite.role);
  update public.trip_invites set uses = uses + 1 where id = v_invite.id;
  return v_invite.trip_id;
end;
$$;
grant execute on function public.accept_trip_invite(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Saved spots (shared in from TikTok, Instagram, YouTube, any link)
-- ---------------------------------------------------------------------
create table public.saved_spots (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references public.profiles (id) on delete cascade,
  trip_id            uuid references public.trips (id) on delete cascade,   -- null = saved just for me
  url                text check (url ~ '^https?://' and char_length(url) <= 2000),
  source             text not null default 'link' check (source in ('tiktok', 'instagram', 'youtube', 'maps', 'link', 'note')),
  title              text check (char_length(title) <= 300),
  author             text check (char_length(author) <= 120),
  thumbnail_url      text check (thumbnail_url ~ '^https://' and char_length(thumbnail_url) <= 2000),
  note               text check (char_length(note) <= 1000),
  place_name         text check (char_length(place_name) <= 200),
  latitude           double precision check (latitude between -90 and 90),
  longitude          double precision check (longitude between -180 and 180),
  address            text check (char_length(address) <= 300),
  attraction_id      uuid references public.attractions (id) on delete set null,
  itinerary_item_id  uuid references public.itinerary_items (id) on delete set null,
  created_at         timestamptz not null default now(),
  constraint saved_spots_has_content check (url is not null or note is not null or place_name is not null)
);
create index saved_spots_trip_idx on public.saved_spots (trip_id, created_at desc);
create index saved_spots_user_idx on public.saved_spots (user_id, created_at desc);
create index saved_spots_attraction_idx on public.saved_spots (attraction_id);
create index saved_spots_item_idx on public.saved_spots (itinerary_item_id);

alter table public.saved_spots enable row level security;
create policy "spots: mine, or my trips'" on public.saved_spots
  for select to authenticated
  using (user_id = (select auth.uid()) or (trip_id is not null and private.is_trip_member(trip_id)));
create policy "spots: save as myself" on public.saved_spots
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (trip_id is null or private.is_trip_member(trip_id)));
create policy "spots: update mine or as editor" on public.saved_spots
  for update to authenticated
  using (user_id = (select auth.uid()) or (trip_id is not null and private.can_edit_trip(trip_id)))
  with check (user_id = (select auth.uid()) or (trip_id is not null and private.can_edit_trip(trip_id)));
create policy "spots: remove mine or as editor" on public.saved_spots
  for delete to authenticated
  using (user_id = (select auth.uid()) or (trip_id is not null and private.can_edit_trip(trip_id)));
grant select, insert, update, delete on public.saved_spots to authenticated;

-- ---------------------------------------------------------------------
-- Group chat
-- ---------------------------------------------------------------------
create table public.trip_messages (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips (id) on delete cascade,
  user_id     uuid references public.profiles (id) on delete set null,
  body        text not null check (char_length(btrim(body)) between 1 and 4000),
  spot_id     uuid references public.saved_spots (id) on delete set null,  -- a shared reel/link shown as a card
  created_at  timestamptz not null default now()
);
create index trip_messages_spot_idx on public.trip_messages (spot_id);
create index trip_messages_trip_created_idx on public.trip_messages (trip_id, created_at desc);
create index trip_messages_user_idx on public.trip_messages (user_id);

alter table public.trip_messages enable row level security;
create policy "messages: members read" on public.trip_messages
  for select to authenticated using (private.is_trip_member(trip_id));
create policy "messages: members post as themselves" on public.trip_messages
  for insert to authenticated
  with check (private.is_trip_member(trip_id) and user_id = (select auth.uid()));
create policy "messages: authors remove their own" on public.trip_messages
  for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, delete on public.trip_messages to authenticated;

-- Live updates (Realtime checks the policies above for each subscriber).
alter publication supabase_realtime add table public.trip_messages;

alter table public.trip_members add column last_read_at timestamptz;

create function public.mark_chat_read(p_trip_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.trip_members
  set last_read_at = now()
  where trip_id = p_trip_id and user_id = (select auth.uid());
$$;
grant execute on function public.mark_chat_read(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Splitting costs
-- ---------------------------------------------------------------------
create table public.expense_participants (
  expense_id  uuid not null references public.expenses (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  trip_id     uuid not null references public.trips (id) on delete cascade,
  primary key (expense_id, user_id)
);
create index expense_participants_trip_idx on public.expense_participants (trip_id);
create index expense_participants_user_idx on public.expense_participants (user_id);

alter table public.expense_participants enable row level security;
create policy "expense_participants: members read" on public.expense_participants
  for select to authenticated using (private.is_trip_member(trip_id));
create policy "expense_participants: editors add" on public.expense_participants
  for insert to authenticated
  with check (
    private.can_edit_trip(trip_id)
    and exists (select 1 from public.expenses e where e.id = expense_id and e.trip_id = expense_participants.trip_id)
  );
create policy "expense_participants: editors remove" on public.expense_participants
  for delete to authenticated using (private.can_edit_trip(trip_id));
grant select, insert, delete on public.expense_participants to authenticated;

create table public.settlements (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips (id) on delete cascade,
  from_user   uuid not null references public.profiles (id) on delete cascade,
  to_user     uuid not null references public.profiles (id) on delete cascade,
  amount      numeric(12, 2) not null check (amount > 0),
  currency    text not null references public.currencies (code),
  settled_on  date not null default current_date,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint settlements_two_people check (from_user <> to_user)
);
create index settlements_trip_idx on public.settlements (trip_id);
create index settlements_from_idx on public.settlements (from_user);
create index settlements_to_idx on public.settlements (to_user);
create index settlements_created_by_idx on public.settlements (created_by);

alter table public.settlements enable row level security;
create policy "settlements: members read" on public.settlements
  for select to authenticated using (private.is_trip_member(trip_id));
-- Either person involved (or an editor) can record a payment.
create policy "settlements: record" on public.settlements
  for insert to authenticated
  with check (
    private.is_trip_member(trip_id)
    and created_by = (select auth.uid())
    and ((select auth.uid()) in (from_user, to_user) or private.can_edit_trip(trip_id))
  );
create policy "settlements: undo own" on public.settlements
  for delete to authenticated
  using (created_by = (select auth.uid()) or private.is_trip_owner(trip_id));
grant select, insert, delete on public.settlements to authenticated;

-- ---------------------------------------------------------------------
-- Packing list and to-dos (everyone on the trip can tick things off)
-- ---------------------------------------------------------------------
create table public.checklist_items (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips (id) on delete cascade,
  list         text not null check (list in ('packing', 'todo')),
  title        text not null check (char_length(btrim(title)) between 1 and 200),
  done         boolean not null default false,
  done_by      uuid references public.profiles (id) on delete set null,
  assigned_to  uuid references public.profiles (id) on delete set null,
  due_on       date,
  position     integer not null default 0,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index checklist_items_trip_idx on public.checklist_items (trip_id, list, position);
create index checklist_items_assigned_idx on public.checklist_items (assigned_to);
create index checklist_items_done_by_idx on public.checklist_items (done_by);
create index checklist_items_created_by_idx on public.checklist_items (created_by);
create trigger set_updated_at before update on public.checklist_items
  for each row execute function private.set_updated_at();

alter table public.checklist_items enable row level security;
create policy "checklist: members read" on public.checklist_items
  for select to authenticated using (private.is_trip_member(trip_id));
create policy "checklist: members add" on public.checklist_items
  for insert to authenticated with check (private.is_trip_member(trip_id));
create policy "checklist: members update" on public.checklist_items
  for update to authenticated
  using (private.is_trip_member(trip_id)) with check (private.is_trip_member(trip_id));
create policy "checklist: members remove" on public.checklist_items
  for delete to authenticated using (private.is_trip_member(trip_id));
grant select, insert, update, delete on public.checklist_items to authenticated;

-- ---------------------------------------------------------------------
-- Votes on itinerary ideas
-- ---------------------------------------------------------------------
create table public.item_votes (
  item_id     uuid not null references public.itinerary_items (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  trip_id     uuid not null references public.trips (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (item_id, user_id)
);
create index item_votes_trip_idx on public.item_votes (trip_id);
create index item_votes_user_idx on public.item_votes (user_id);

alter table public.item_votes enable row level security;
create policy "votes: members read" on public.item_votes
  for select to authenticated using (private.is_trip_member(trip_id));
create policy "votes: members vote as themselves" on public.item_votes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and private.is_trip_member(trip_id)
    and exists (select 1 from public.itinerary_items i where i.id = item_id and i.trip_id = item_votes.trip_id)
  );
create policy "votes: take back own vote" on public.item_votes
  for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, delete on public.item_votes to authenticated;

-- Joining and read-markers need a signed-in user; only the invite preview is public.
revoke execute on function public.accept_trip_invite(uuid), public.mark_chat_read(uuid) from public, anon;
grant execute on function public.accept_trip_invite(uuid), public.mark_chat_read(uuid) to authenticated;
