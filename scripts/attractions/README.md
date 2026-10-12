# Official attractions: how they're verified

`public.attractions` is WRLD's hand-checked list of sights. When a traveler types
"Sagrada Familia" or "Uffizi", the itinerary fills in the **official** site,
timed-entry rules and the best time of day from this list.

## Adding attractions

1. Add rows to `major-cities.py` (one tuple per sight, with its English
   Wikipedia article title).
2. `python3 scripts/attractions/major-cities.py > staging.sql` and run it in the
   Supabase SQL editor (loads `private.attraction_staging`).
3. From the database, with `pg_net`:
   - fetch Wikidata for each article (`wbgetentities`, `sites=enwiki`): official
     website (P856) and coordinates (P625);
   - open each `official_url` and `tickets_url`.
4. A row is **verified** when:
   - its domain matches Wikidata's official website **or** a second check
     confirms the page is run by the attraction or its government body; and
   - the link answers (2xx/3xx), or answers with a bot wall (400/403/429) on a
     domain Wikidata confirms; and
   - its coordinates are within 1.5 km of Wikidata's.
5. Insert verified rows into `public.attractions` with `verified_on = today`.

Prices and opening hours are **not** filled from memory: rows say "see the
official site" until someone reads the ticket page.

## Keeping it current

`pg_cron` re-opens every official link on Mondays (06:00 UTC) and stores the
answer in `attractions.link_status`. The owner stats page lists any that stop
answering.

## October 12, 2026 run

101 candidates in 37 cities and towns. 64 passed every check on the first pass, 35 more
after fixing the URL (Wikidata or the operator pointed to a different official
domain or page). Left out: **Hagia Sophia** and **Basilica Cistern**, because
neither the domain nor the operator could be confirmed.
