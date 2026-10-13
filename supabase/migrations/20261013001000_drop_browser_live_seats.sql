-- Automated live searches from the browser button were withdrawn: the button only
-- shares pages a traveler opened. Nobody can call the ingest function any more.
revoke all on function public.ingest_browser_seats(text, text, jsonb) from public, anon, authenticated;
