-- WRLD shows every price in USD. Trips are kept in USD; amounts entered in
-- another currency (an expense paid in euros) are converted by the existing
-- cost_in_trip_currency / amount_in_trip_currency columns.
create or replace function private.default_trip_currency_home()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.currency is null then
    new.currency := 'USD';
  end if;
  return new;
end;
$$;

update public.profiles set home_currency = 'USD' where home_currency <> 'USD';
-- Only trips without a budget switch directly; a budget would need converting first.
update public.trips set currency = 'USD' where currency <> 'USD' and budget is null;
