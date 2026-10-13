-- Points explorer: real data only, and the cash part of an award.
-- 1. Sample seats are closed (the engine no longer makes any).
-- 2. Traveler reports can include the taxes and fees the airline showed.

update public.award_availability set closed_at = now() where data_source = 'sample' and closed_at is null;

alter table public.award_reports
  add column if not exists taxes numeric(10, 2) check (taxes is null or taxes between 0 and 5000),
  add column if not exists tax_currency text check (tax_currency is null or tax_currency ~ '^[A-Z]{3}$');

alter function public.report_award_seat(text, text, date, text, text, integer, boolean) rename to report_award_seat_superseded;
revoke all on function public.report_award_seat_superseded(text, text, date, text, text, integer, boolean) from public, anon, authenticated;

create function public.report_award_seat(
  p_origin text, p_destination text, p_date date, p_program text, p_cabin text, p_miles integer,
  p_direct boolean default false, p_taxes numeric default null, p_tax_currency text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_cur text := case when p_taxes is null then null else upper(coalesce(p_tax_currency, 'USD')) end;
begin
  if v_user is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if p_origin !~ '^[A-Z]{3}$' or p_destination !~ '^[A-Z]{3}$' or p_origin = p_destination
     or p_program !~ '^[a-z0-9_]{2,40}$' or p_cabin not in ('economy', 'premium', 'business', 'first')
     or p_miles not between 1000 and 1000000
     or (p_taxes is not null and p_taxes not between 0 and 5000)
     or (v_cur is not null and v_cur !~ '^[A-Z]{3}$')
     or p_date < current_date or p_date > current_date + 365 then
    raise exception 'Check the route, date, points and taxes.' using errcode = '22023';
  end if;
  if (select count(*) from public.award_reports r where r.user_id = v_user and r.created_at > now() - interval '1 day') >= 20 then
    raise exception 'That''s 20 reports today. Thank you! Try again tomorrow.' using errcode = '54000';
  end if;

  insert into public.award_reports (user_id, origin, destination, travel_date, program, cabin, miles, direct, taxes, tax_currency)
  values (v_user, p_origin, p_destination, p_date, p_program, p_cabin, p_miles, coalesce(p_direct, false), p_taxes, v_cur);

  insert into public.award_availability as a (origin, destination, travel_date, program, cabin, miles, direct, data_source, taxes, tax_currency)
  values (p_origin, p_destination, p_date, p_program, p_cabin, p_miles, coalesce(p_direct, false), 'community', p_taxes, v_cur)
  on conflict (data_source, origin, destination, travel_date, program, cabin) do update
    set miles = excluded.miles, direct = excluded.direct, seen_at = now(), closed_at = null,
        taxes = coalesce(excluded.taxes, a.taxes), tax_currency = coalesce(excluded.tax_currency, a.tax_currency);

  insert into public.award_availability_history (origin, destination, travel_date, program, cabin, data_source, change, miles)
  values (p_origin, p_destination, p_date, p_program, p_cabin, 'community', 'opened', p_miles);
end;
$$;

revoke all on function public.report_award_seat(text, text, date, text, text, integer, boolean, numeric, text) from public, anon;
grant execute on function public.report_award_seat(text, text, date, text, text, integer, boolean, numeric, text) to authenticated;
