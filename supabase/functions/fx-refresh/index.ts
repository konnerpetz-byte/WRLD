// fx-refresh: daily exchange rates for WRLD.
//
// Reads USD-based rates from Frankfurter (European Central Bank reference
// rates; free, no key) and upserts exchange_rates ("1 USD = rate × quote").
// Used by trip budgets and by the Points explorer to show award taxes in dollars.
// Called by pg_cron with the same Vault token as the other workers.
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Use POST" });
  const url = Deno.env.get("SUPABASE_URL")!;
  let secret: string | undefined;
  try { secret = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default; } catch { secret = undefined; }
  secret ??= Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) return json(500, { error: "Not configured" });
  const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

  const token = req.headers.get("x-wrld-cron") ?? "";
  if (token.length < 32) return json(401, { error: "Unauthorized" });
  const { data: ok } = await db.rpc("award_cron_token_ok", { p_token: token });
  if (ok !== true) return json(401, { error: "Unauthorized" });

  const res = await fetch("https://api.frankfurter.dev/v1/latest?base=USD", {
    headers: { Accept: "application/json", "User-Agent": "WRLD trip planner (https://wrldtrips.com)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return json(502, { error: `frankfurter ${res.status}` });
  const body = (await res.json()) as { date?: string; rates?: Record<string, number> };
  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date) || !body.rates) return json(502, { error: "Unexpected response" });

  const { data: currencies } = await db.from("currencies").select("code");
  const known = new Set((currencies ?? []).map((c) => c.code));
  const rows = Object.entries(body.rates)
    .filter(([code, rate]) => /^[A-Z]{3}$/.test(code) && known.has(code) && Number.isFinite(rate) && rate > 0)
    .map(([quote, rate]) => ({ quote, as_of: body.date!, rate, source: "frankfurter", fetched_at: new Date().toISOString() }));
  if (known.has("USD")) rows.push({ quote: "USD", as_of: body.date, rate: 1, source: "frankfurter", fetched_at: new Date().toISOString() });
  const { error } = await db.from("exchange_rates").upsert(rows);
  if (error) return json(500, { error: error.message });
  return json(200, { as_of: body.date, rates: rows.length });
});
