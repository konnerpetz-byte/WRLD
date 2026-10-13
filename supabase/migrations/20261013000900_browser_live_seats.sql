-- Live award seats a traveler looked up in their own browser with the WRLD
-- extension (e.g. Alaska's public award calendar). Shared with other travelers
-- for three days like traveler reports, labeled as live searches.
create table private.browser_search_log (
  id       bigint generated always as identity primary key,
  user_id  uuid not null references auth.users (id) on delete cascade,
  at       timestamptz not null default now()
);
create index browser_search_log_user_at on private.browser_search_log (user_id, at);
alter table private.browser_search_log enable row level security;
revoke all on private.browser_search_log from public, anon, authenticated;

create or replace function public.ingest_browser_seats(p_program text, p_cabin text, p_rows jsonb)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_count integer := 0;
  r jsonb;
begin
  if v_user is null then raise exception 'Sign in first' using errcode = '28000'; end if;
  if p_program not in ('alaska') or p_cabin not in ('economy', 'premium', 'business', 'first')
     or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 1000 then
    raise exception 'Check the search results' using errcode = '22023';
  end if;
  if (select count(*) from private.browser_search_log l where l.user_id = v_user and l.at > now() - interval '1 day') >= 100 then
    raise exception 'That''s enough live searches for today. Try again tomorrow.' using errcode = '54000';
  end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    if (r->>'origin') !~ '^[A-Z]{3}$' or (r->>'destination') !~ '^[A-Z]{3}$' or (r->>'origin') = (r->>'destination')
       or (r->>'date') !~ '^\d{4}-\d{2}-\d{2}$' or (r->>'miles') !~ '^\d{4,7}$' then
      continue;
    end if;
    begin
      if (r->>'date')::date < current_date or (r->>'date')::date > current_date + 365 or (r->>'miles')::int not between 1000 and 1000000 then
        continue;
      end if;
      insert into public.award_availability as a (origin, destination, travel_date, program, cabin, miles, direct, data_source)
      values (r->>'origin', r->>'destination', (r->>'date')::date, p_program, p_cabin, (r->>'miles')::int, false, 'browser')
      on conflict (data_source, origin, destination, travel_date, program, cabin) do update
        set miles = excluded.miles, seen_at = now(), closed_at = null;
      v_count := v_count + 1;
    exception when invalid_datetime_format or datetime_field_overflow then
      continue; -- not a real date
    end;
  end loop;
  insert into private.browser_search_log (user_id) values (v_user);
  return v_count;
end;
$$;
revoke all on function public.ingest_browser_seats(text, text, jsonb) from public, anon;
grant execute on function public.ingest_browser_seats(text, text, jsonb) to authenticated;
