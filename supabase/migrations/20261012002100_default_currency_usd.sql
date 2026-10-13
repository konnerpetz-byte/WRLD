-- New trips default to the owner's home currency, or USD.
-- Named "a_…" so it runs before the older currency trigger (triggers fire in name order).
create or replace function private.default_trip_currency_home()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.currency is null then
    select coalesce((select p.home_currency from public.profiles p where p.id = new.owner_id), 'USD') into new.currency;
  end if;
  return new;
end;
$$;

create trigger a_default_trip_currency_home
  before insert on public.trips
  for each row execute function private.default_trip_currency_home();
