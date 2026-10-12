-- Travel types of everyone on a trip, for the Group fit tab. Only trip
-- members can call it, and only for trips they're on.
create function public.trip_travel_types(p_trip_id uuid)
returns table (user_id uuid, display_name text, avatar_url text, compass_x numeric, compass_y numeric, archetype text, interests jsonb)
language sql stable security definer set search_path = ''
as $$
  select m.user_id, p.display_name, p.avatar_url, tp.compass_x, tp.compass_y, tp.archetype::text,
    coalesce((select jsonb_object_agg(ti.tag_slug, ti.weight) from public.traveler_interests ti where ti.user_id = m.user_id and ti.weight > 0), '{}'::jsonb)
  from public.trip_members m
  join public.profiles p on p.id = m.user_id
  left join public.traveler_profiles tp on tp.user_id = m.user_id
  where m.trip_id = p_trip_id and private.is_trip_member(p_trip_id)
  order by m.created_at
$$;
revoke all on function public.trip_travel_types(uuid) from public, anon;
grant execute on function public.trip_travel_types(uuid) to authenticated;

-- Travel documents live on the trip checklist with a reminder date.
alter table public.checklist_items drop constraint if exists checklist_items_list_check;
alter table public.checklist_items add constraint checklist_items_list_check check (list in ('packing', 'todo', 'documents'));
alter table public.checklist_items
  add column remind_on date,
  add column doc_key text check (char_length(doc_key) <= 60),
  add column info_url text check (info_url ~ '^https://' and char_length(info_url) <= 500);
create unique index checklist_items_doc_unique on public.checklist_items (trip_id, doc_key, assigned_to) where doc_key is not null;
create index checklist_items_remind on public.checklist_items (remind_on) where remind_on is not null and not done;
