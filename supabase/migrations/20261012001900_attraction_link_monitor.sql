-- Weekly check that every official attraction link still answers.
create extension if not exists pg_cron;

create table private.attraction_link_checks (
  attraction_id uuid primary key references public.attractions (id) on delete cascade,
  request_id bigint not null,
  sent_at timestamptz not null default now()
);

create function private.send_attraction_link_checks() returns void
language sql security definer set search_path = ''
as $$
  insert into private.attraction_link_checks (attraction_id, request_id, sent_at)
  select a.id, net.http_get(
      url := a.official_url,
      headers := '{"User-Agent":"Mozilla/5.0 (compatible; WRLD link check; +https://wrldtrips.com)","Accept":"text/html"}'::jsonb,
      timeout_milliseconds := 25000),
    now()
  from public.attractions a
  on conflict (attraction_id) do update set request_id = excluded.request_id, sent_at = excluded.sent_at;
$$;

-- Status -1 means no answer (DNS, TLS or timeout).
create function private.collect_attraction_link_checks() returns void
language sql security definer set search_path = ''
as $$
  update public.attractions a
  set link_status = coalesce(r.status_code, -1), link_checked_at = c.sent_at
  from private.attraction_link_checks c
  join net._http_response r on r.id = c.request_id
  where c.attraction_id = a.id;
$$;

revoke all on function private.send_attraction_link_checks() from public, anon, authenticated;
revoke all on function private.collect_attraction_link_checks() from public, anon, authenticated;

select cron.schedule('attraction-links-send', '0 6 * * 1', $$select private.send_attraction_link_checks()$$);
select cron.schedule('attraction-links-collect', '20 6 * * 1', $$select private.collect_attraction_link_checks()$$);
