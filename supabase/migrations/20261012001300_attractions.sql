-- =====================================================================
-- 13 · Official attractions
--
-- A hand-checked list of major sights with their OFFICIAL ticket pages,
-- timed-entry rules, opening hours, best time of day and adult price.
-- Typing "Sintra" or "Neuschwanstein" in the itinerary matches these
-- first; anything not listed falls back to Wikidata's official website.
--
-- Prices and hours change. verified_on records when each row was last
-- checked against the official site; re-check before relying on them.
-- Rows are maintained by the WRLD team (no user writes).
-- =====================================================================

alter type public.price_source add value if not exists 'official';

create table public.attractions (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  name              text not null,
  aliases           text[] not null default '{}',   -- lower-case search terms ("sintra", "pena")
  city              text not null,
  country_code      text references public.countries (code),
  latitude          double precision not null check (latitude between -90 and 90),
  longitude         double precision not null check (longitude between -180 and 180),
  address           text,
  official_url      text not null,                  -- the official info page
  tickets_url       text,                           -- the official booking page
  timed_entry       boolean not null default false, -- ticket is for a specific time
  best_slot         public.time_block_slot,
  suggested_start   time,
  duration_minutes  smallint check (duration_minutes between 15 and 720),
  hours_note        text,
  visit_note        text,
  adult_price       numeric(12, 2) check (adult_price >= 0),
  currency          text references public.currencies (code),
  price_note        text,
  verified_on       date,
  created_at        timestamptz not null default now()
);

alter table public.attractions enable row level security;
create policy "attractions: anyone reads" on public.attractions
  for select to anon, authenticated using (true);
grant select on public.attractions to anon, authenticated;

-- Remember which official listing an itinerary item came from.
alter table public.itinerary_items
  add column attraction_id uuid references public.attractions (id) on delete set null,
  add column official_url  text;
create index itinerary_items_attraction_idx on public.itinerary_items (attraction_id);

-- Prefix search over name, aliases and city.
create or replace function public.search_attractions(p_query text, p_limit int default 6)
returns setof public.attractions
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (select lower(trim(p_query)) as t)
  select a.*
  from public.attractions a, q
  where length(q.t) >= 2
    and (
      lower(a.name) like '%' || q.t || '%'
      or lower(a.city) like q.t || '%'
      or exists (select 1 from unnest(a.aliases) al where al like q.t || '%')
    )
  order by
    (lower(a.name) like q.t || '%') desc,
    exists (select 1 from unnest(a.aliases) al where al = q.t) desc,
    a.name
  limit greatest(1, least(p_limit, 20));
$$;
grant execute on function public.search_attractions(text, int) to anon, authenticated;

-- Nearby curated sights for "Explore nearby".
create or replace function public.attractions_near(p_lat double precision, p_lng double precision, p_km double precision default 30)
returns table (attraction public.attractions, km double precision)
language sql
stable
security invoker
set search_path = ''
as $$
  select a, d.km
  from public.attractions a
  cross join lateral (
    select 6371 * 2 * asin(sqrt(
      power(sin(radians(a.latitude - p_lat) / 2), 2) +
      cos(radians(p_lat)) * cos(radians(a.latitude)) * power(sin(radians(a.longitude - p_lng) / 2), 2)
    )) as km
  ) d
  where d.km <= p_km
  order by d.km
  limit 20;
$$;
grant execute on function public.attractions_near(double precision, double precision, double precision) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Starter list, checked against each official site on 2026-10-12.
-- ---------------------------------------------------------------------
insert into public.attractions
  (slug, name, aliases, city, country_code, latitude, longitude, address, official_url, tickets_url,
   timed_entry, best_slot, suggested_start, duration_minutes, hours_note, visit_note,
   adult_price, currency, price_note, verified_on)
values
  ('pena-palace', 'Park and National Palace of Pena', array['sintra', 'pena', 'pena palace', 'palacio da pena', 'palácio da pena'],
   'Sintra', 'PT', 38.7876, -9.3906, 'Estrada da Pena, 2710-609 Sintra, Portugal',
   'https://www.parquesdesintra.pt/en/plan-your-visit/tickets-palace-of-pena/',
   'https://bilheteira.parquesdesintra.pt/evento/parque-e-palacio-nacional-da-pena/263/en',
   true, 'morning', '09:30', 180,
   'Palace 9:30 AM – 6:30 PM (last admission 6 PM). Park 9 AM – 7 PM.',
   'Palace entry is only at the time on your ticket: no entry if you arrive early or late. Allow about 30 minutes to walk from the park entrance to the palace. No private cars from the historic center.',
   45.00, 'EUR', 'Park + Palace, ages 18–64. Park only is €12.', '2026-10-12'),

  ('quinta-da-regaleira', 'Quinta da Regaleira', array['sintra', 'regaleira', 'initiation well'],
   'Sintra', 'PT', 38.7959, -9.3962, 'Quinta da Regaleira 9, 2710-567 Sintra, Portugal',
   'https://www.regaleira.pt/en', 'https://regaleira.byblueticket.pt',
   true, 'afternoon', '14:00', 120,
   'Hours change by season — check the official site.',
   'Tickets have a start slot; you can enter up to 1 hour after it.',
   null, 'EUR', 'Prices changed in January 2026; see the official site.', '2026-10-12'),

  ('neuschwanstein', 'Neuschwanstein Castle', array['neuschwanstein', 'schloss neuschwanstein', 'hohenschwangau', 'fussen', 'füssen'],
   'Schwangau', 'DE', 47.5576, 10.7498, 'Ticket Center: Alpseestraße 12, 87645 Hohenschwangau, Germany',
   'https://www.neuschwanstein.de/englisch/tourist/admiss.htm', 'https://shop.ticket-center-hohenschwangau.de',
   true, 'morning', '10:00', 180,
   '28 Mar – 15 Oct: 9 AM – 6 PM. 16 Oct – 27 Mar: 10 AM – 4 PM. Closed 1 Jan and 24, 25, 31 Dec.',
   'Guided tour only (about 30 min) at the time on your ticket; late arrivals can''t join. Pick up at the Ticket Center, then allow 40+ minutes to walk up to the castle.',
   23.50, 'EUR', '€21 ticket + €2.50 online booking fee. Under-18s free (booking fee still applies).', '2026-10-12'),

  ('alhambra', 'Alhambra', array['alhambra', 'nasrid palaces', 'generalife', 'granada'],
   'Granada', 'ES', 37.1761, -3.5881, 'Calle Real de la Alhambra, 18009 Granada, Spain',
   'https://www.alhambra-patronato.es/en', 'https://tickets.alhambra-patronato.es/en/',
   true, 'morning', '08:30', 210,
   'Hours change by season — check the official site.',
   'The Nasrid Palaces are entered at the time on your ticket. Bring the ID used to book.',
   22.27, 'EUR', 'Complete visit, as listed on the official ticket site.', '2026-10-12'),

  ('louvre', 'Louvre Museum', array['louvre', 'musee du louvre', 'musée du louvre', 'mona lisa'],
   'Paris', 'FR', 48.8606, 2.3376, 'Rue de Rivoli, 75001 Paris, France',
   'https://www.louvre.fr/en/visit/hours-admission', 'https://ticket.louvre.fr/en',
   true, 'morning', '09:00', 180,
   '9 AM – 6 PM; Wed and Fri until 9 PM. Closed Tuesdays, 1 Jan, 1 May, 25 Dec. Last entry 1 hour before closing.',
   'Book a time slot in advance.',
   32.00, 'EUR', 'Non-EEA visitors. €22 for EEA residents; under-18s free.', '2026-10-12'),

  ('eiffel-tower', 'Eiffel Tower', array['eiffel', 'eiffel tower', 'tour eiffel'],
   'Paris', 'FR', 48.8584, 2.2945, 'Champ de Mars, 5 Avenue Anatole France, 75007 Paris, France',
   'https://www.toureiffel.paris/en/rates-opening-times', 'https://ticket.toureiffel.paris/en',
   true, 'evening', '19:00', 120,
   'Usually 9:30 AM – 11 PM; last lift 10:45 PM. Summit can close in bad weather.',
   'Pick a time slot when you book. Stairs tickets also need a reservation.',
   36.70, 'EUR', 'Summit by lift. 2nd floor by lift €23.50, by stairs €14.80.', '2026-10-12'),

  ('anne-frank-house', 'Anne Frank House', array['anne frank', 'anne frank house', 'anne frank huis'],
   'Amsterdam', 'NL', 52.3752, 4.8840, 'Westermarkt 20, 1016 DK Amsterdam, Netherlands',
   'https://www.annefrank.org/en/museum/tickets/', 'https://www.annefrank.org/en/museum/tickets/',
   true, 'morning', '09:00', 75,
   'Daily 9 AM – 10 PM, with some exceptions.',
   'Online only, for a set time. New tickets go on sale every Tuesday at 10 AM (Amsterdam time) for six weeks ahead.',
   16.50, 'EUR', 'Includes €1 booking fee.', '2026-10-12'),

  ('colosseum', 'Colosseum', array['colosseum', 'colosseo', 'roman forum', 'palatine'],
   'Rome', 'IT', 41.8902, 12.4922, 'Piazza del Colosseo, 00184 Rome, Italy',
   'https://colosseo.it/en/opening-times-and-tickets/', 'https://ticketing.colosseo.it/en/',
   true, 'morning', '08:30', 180,
   'Opens 8:30 AM; closing time changes by season.',
   'Book a timed entry on the official ticket site.',
   null, 'EUR', null, '2026-10-12');
