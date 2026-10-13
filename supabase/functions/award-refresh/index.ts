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
//   sample      Realistic made-up seats so the engine runs end to end before a
//               licensed source exists. Labeled "Sample" in the app.
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

// ---------------------------------------------------------------- Sample
const BASE: Record<string, [number, number]> = {
  LHR: [26, 60], CDG: [30, 60], AMS: [30, 60], FRA: [30, 70], MUC: [30, 70], MAD: [30, 60], BCN: [30, 60], LIS: [30, 60],
  FCO: [30, 70], ATH: [35, 70], DUB: [26, 50], ZRH: [30, 70], VIE: [30, 70], CPH: [30, 60], IST: [35, 45], EDI: [26, 57],
  MXP: [30, 70], PRG: [30, 70], HND: [35, 75], NRT: [35, 75], KIX: [35, 75], ICN: [35, 75], TPE: [35, 75], HKG: [40, 85],
  SIN: [40, 85], BKK: [40, 85], MNL: [40, 85], DEL: [40, 80], CUN: [12, 25], MEX: [12, 25], SJD: [12, 25], SJU: [10, 25],
  PUJ: [12, 25], LIR: [12, 30], BOG: [15, 35], LIM: [20, 40], GRU: [30, 60], EZE: [30, 60], SCL: [30, 60], DXB: [40, 80],
  DOH: [40, 70], AUH: [40, 70], TLV: [40, 75], CAI: [40, 75], CPT: [45, 80], JNB: [45, 80], NBO: [45, 80], RAK: [35, 70],
  SYD: [45, 85], MEL: [45, 85], BNE: [45, 85], AKL: [45, 85], HNL: [20, 40], NAN: [35, 70], PPT: [35, 70],
};
const PROGRAMS: Record<string, string> = {
  united: "UA", aeroplan: "AC, LH", flyingblue: "AF, KL", american: "AA, BA", delta: "DL, VS", british: "BA", virginatlantic: "VS, DL", alaska: "AS, JL", turkish: "TK",
};
const FACTOR: Record<Cabin, number> = { economy: 1, premium: 1.6, business: 1, first: 1.5 };
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}
const sample: Adapter = {
  name: "sample",
  days: 120,
  async fetch(r, start, end) {
    const [eco, biz] = BASE[r.destination] ?? [15, 40];
    // A slow drift by week, so refreshes show seats opening, closing and repricing like real data.
    const week = Math.floor(Date.now() / (7 * 86400000));
    const out: Seat[] = [];
    for (let d = new Date(`${start}T12:00:00Z`); d <= new Date(`${end}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
      const date = d.toISOString().slice(0, 10);
      for (const [program, airlines] of Object.entries(PROGRAMS)) {
        if (hash(`${r.origin}${r.destination}${date}${program}${r.cabin}${week}`) > 0.12) continue;
        const base = (r.cabin === "economy" || r.cabin === "premium" ? eco : biz) * FACTOR[r.cabin];
        const miles = Math.round((base * (1 + hash(`${r.destination}${date}${program}${week}`) * 1.4)) / 2.5) * 2500;
        out.push({
          travel_date: date,
          program,
          miles,
          taxes: Math.round(hash(`${date}${program}tax`) * 250 + 6),
          tax_currency: "USD",
          seats: 1 + Math.floor(hash(`${date}${program}seats`) * 4),
          airlines,
          direct: hash(`${r.destination}${program}direct`) > 0.55,
        });
      }
    }
    return out;
  },
};

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
  const adapter = key ? seatsAero(key) : sample;
  const limit = key ? 20 : 40;

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
