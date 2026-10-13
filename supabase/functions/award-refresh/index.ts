// award-refresh: the award engine's fetch worker.
//
// Every 15 minutes pg_cron calls this function. It claims the routes that are
// due (the route planner decides how often each route refreshes), fetches seats
// for each from the active data source, and stores them with
// ingest_award_batch, which records what opened, changed price or closed.
//
// Data sources are adapters with the same output shape:
//   seats_aero  Seats.aero partner API (cached search). Turned on by the
//               SEATS_AERO_API_KEY secret, once Seats.aero approves commercial use.
// Without a key it does nothing: WRLD never shows made-up seats. The explorer
// runs on published award charts and traveler reports instead.
// Never add an adapter that scrapes airline sites or gets around blocking.
//
// Auth: verify_jwt is off because the caller is pg_cron; the x-wrld-cron header
// must match the token kept in Supabase Vault (checked by award_cron_token_ok).
import { createClient } from "npm:@supabase/supabase-js@2";

type Cabin = "economy" | "premium" | "business" | "first";
type Route = { origin: string; destination: string; cabin: Cabin };
type Seat = {
  travel_date: string;
  program: string;
  miles: number;
  taxes?: number | null;
  tax_currency?: string | null;
  seats?: number | null;
  airlines?: string;
  direct?: boolean;
};
type Adapter = { name: string; days: number; fetch: (r: Route, start: string, end: string) => Promise<Seat[]> };

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

// ---------------------------------------------------------------- Seats.aero
const CABIN_KEY: Record<Cabin, string> = { economy: "Y", premium: "W", business: "J", first: "F" };
function seatsAero(key: string): Adapter {
  return {
    name: "seats_aero",
    days: 330,
    async fetch(r, start, end) {
      const url = new URL("https://seats.aero/partnerapi/search");
      url.search = new URLSearchParams({
        origin_airport: r.origin,
        destination_airport: r.destination,
        start_date: start,
        end_date: end,
        cabins: r.cabin,
        take: "1000",
      }).toString();
      const res = await fetch(url, { headers: { "Partner-Authorization": key, Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
      if (res.status === 429) throw new RateLimited();
      if (!res.ok) throw new Error(`seats.aero ${res.status}`);
      const body = (await res.json()) as { data?: Record<string, unknown>[] };
      const k = CABIN_KEY[r.cabin];
      const out: Seat[] = [];
      for (const a of body.data ?? []) {
        if (!a[`${k}Available`]) continue;
        const miles = Number(a[`${k}MileageCost`]);
        if (!Number.isFinite(miles) || miles <= 0) continue;
        const taxes = Number(a[`${k}TotalTaxes`]);
        out.push({
          travel_date: String(a.Date).slice(0, 10),
          program: String(a.Source).toLowerCase().replace(/[^a-z0-9_]/g, ""),
          miles,
          taxes: Number.isFinite(taxes) ? taxes / 100 : null,
          tax_currency: typeof a.TaxesCurrency === "string" ? a.TaxesCurrency : null,
          seats: Number(a[`${k}RemainingSeats`]) || null,
          airlines: String(a[`${k}Airlines`] ?? "").slice(0, 80),
          direct: Boolean(a[`${k}Direct`]),
        });
      }
      return out;
    },
  };
}
class RateLimited extends Error {}

// ---------------------------------------------------------------- Worker
Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Use POST" });

  const url = Deno.env.get("SUPABASE_URL")!;
  let secret: string | undefined;
  try {
    secret = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default;
  } catch {
    secret = undefined;
  }
  secret ??= Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) return json(500, { error: "Not configured" });
  const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

  const token = req.headers.get("x-wrld-cron") ?? "";
  if (token.length < 32) return json(401, { error: "Unauthorized" });
  const { data: ok } = await db.rpc("award_cron_token_ok", { p_token: token });
  if (ok !== true) return json(401, { error: "Unauthorized" });

  const key = Deno.env.get("SEATS_AERO_API_KEY");
  if (!key) return json(200, { source: "none", routes: 0 });
  const adapter = seatsAero(key);
  const limit = 20;

  const { data: routes, error } = await db.rpc("claim_award_routes", { p_limit: limit });
  if (error) return json(500, { error: error.message });

  const started = Date.now();
  const results: unknown[] = [];
  for (const r of (routes ?? []) as Route[]) {
    if (Date.now() - started > 45000) {
      await db.rpc("defer_award_route", { p_origin: r.origin, p_destination: r.destination, p_cabin: r.cabin, p_minutes: 5 });
      continue;
    }
    const start = day(0);
    const end = day(adapter.days);
    try {
      const seats = await adapter.fetch(r, start, end);
      const { data, error: ingestError } = await db.rpc("ingest_award_batch", {
        p_source: adapter.name,
        p_origin: r.origin,
        p_destination: r.destination,
        p_cabin: r.cabin,
        p_start: start,
        p_end: end,
        p_rows: seats.slice(0, 5000),
      });
      if (ingestError) throw new Error(ingestError.message);
      results.push({ route: `${r.origin}-${r.destination} ${r.cabin}`, ...data });
    } catch (e) {
      const minutes = e instanceof RateLimited ? 360 : 60;
      await db.rpc("defer_award_route", { p_origin: r.origin, p_destination: r.destination, p_cabin: r.cabin, p_minutes: minutes });
      results.push({ route: `${r.origin}-${r.destination} ${r.cabin}`, error: e instanceof Error ? e.message : "failed" });
      if (e instanceof RateLimited) break;
    }
  }
  return json(200, { source: adapter.name, routes: results.length, results });
});
