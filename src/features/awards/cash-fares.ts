import "server-only";

import { cacheLife } from "next/cache";

import { env } from "@/lib/env";

/**
 * Today's cheapest cash fares, free: the Aviasales Data API (Travelpayouts),
 * which shares fares Aviasales travelers found in the last 48 hours. It's a
 * documented, free API for Travelpayouts partners (token in the Travelpayouts
 * profile), called only from WRLD's server: nothing loads on WRLD's pages.
 *
 * WRLD turns these fares into points two ways, both bookable for any seat
 * that has a cash fare:
 *   - card travel portals: Chase, Amex, Capital One and Citi points at 1 cent
 *   - revenue-based airline programs: Southwest and JetBlue, priced from the fare
 *
 * Setup: TRAVELPAYOUTS_TOKEN in Vercel (Travelpayouts › Profile › API token).
 */

export type CashFare = {
  origin: string;
  destination: string;
  date: string; // YYYY-MM-DD
  price: number; // USD, one way, economy, taxes included
  airline: string; // IATA code
  flight: string;
  stops: number;
  durationMin: number | null;
};

type Row = {
  origin?: string;
  destination?: string;
  origin_airport?: string;
  destination_airport?: string;
  price?: number;
  airline?: string;
  flight_number?: string | number;
  departure_at?: string;
  transfers?: number;
  duration_to?: number;
  duration?: number;
};

const IATA = /^[A-Z]{3}$/;

export const cashFaresEnabled = () => Boolean(env("TRAVELPAYOUTS_TOKEN"));

/** One month of the cheapest one-way fare to every destination from an airport (cached for an hour). */
async function monthFares(origin: string, month: string, direct: boolean): Promise<CashFare[]> {
  "use cache";
  cacheLife("hours");
  const token = env("TRAVELPAYOUTS_TOKEN");
  if (!token) return [];
  // Two passes: one fare per destination (reach), then every cheap fare (more airlines and dates per route).
  const pass = async (unique: boolean): Promise<Row[]> => {
    const u = new URL("https://api.travelpayouts.com/aviasales/v3/prices_for_dates");
    u.search = new URLSearchParams({
      origin,
      departure_at: month,
      one_way: "true",
      direct: String(direct),
      unique: String(unique),
      sorting: "price",
      currency: "usd",
      market: "us",
      limit: "1000",
    }).toString();
    try {
      const res = await fetch(u, { headers: { "X-Access-Token": token, "Accept-Encoding": "gzip, deflate" }, signal: AbortSignal.timeout(12000) });
      if (!res.ok) return [];
      const body = (await res.json()) as { success?: boolean; data?: Row[] };
      return body.success && Array.isArray(body.data) ? body.data : [];
    } catch {
      return [];
    }
  };
  try {
    const rows = (await Promise.all([pass(true), pass(false)])).flat();
    const seen = new Set<string>();
    const out: CashFare[] = [];
    for (const r of rows) {
      const dest = String(r.destination_airport ?? r.destination ?? "").toUpperCase();
      const date = String(r.departure_at ?? "").slice(0, 10);
      const price = Number(r.price);
      if (!IATA.test(dest) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(price) || price <= 0 || price > 20000) continue;
      const k = `${dest}|${date}|${r.airline}|${r.flight_number}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({
        origin: String(r.origin_airport ?? origin).toUpperCase(),
        destination: dest,
        date,
        price,
        airline: String(r.airline ?? "").toUpperCase().slice(0, 3),
        flight: `${r.airline ?? ""}${r.flight_number ?? ""}`.slice(0, 10),
        stops: Number(r.transfers) || 0,
        durationMin: Number(r.duration_to ?? r.duration) || null,
      });
    }
    return out;
  } catch {
    return [];
  }
}

/** Cheapest fares from each origin in the search window, one per destination and date. */
export async function cashFares(q: { origins: string[]; months: string[]; start: string; end: string; directOnly: boolean }): Promise<CashFare[]> {
  if (!cashFaresEnabled()) return [];
  const months = q.months.length ? q.months : monthsBetween(q.start, q.end);
  const all = await Promise.all(q.origins.flatMap((o) => months.slice(0, 6).map((m) => monthFares(o, m, q.directOnly))));
  return all.flat().filter((f) => f.date >= q.start && f.date <= q.end);
}

function monthsBetween(start: string, end: string) {
  const out: string[] = [];
  let [y, m] = start.slice(0, 7).split("-").map(Number);
  const last = end.slice(0, 7);
  for (let i = 0; i < 13; i++) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    out.push(key);
    if (key >= last) break;
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

// ---------------------------------------------------------------- Points for a cash fare
/**
 * Card travel portals: points pay for any fare at a fixed value. 1 cent per
 * point at Chase, Amex (flights), Capital One and Citi: point.me "How much are
 * Chase points worth" (Sept 2026) and US Credit Cards 101 points valuations
 * (Aug 2026); Chase dropped its 1.25/1.5 cent guarantee in October 2025.
 * Bilt is left out: no stable published portal rate in 2026.
 */
export const PORTALS = [
  { bank: "chase", name: "Chase Travel", site: "chase.com/travel" },
  { bank: "amex", name: "Amex Travel", site: "amextravel.com" },
  { bank: "capitalone", name: "Capital One Travel", site: "travel.capitalone.com" },
  { bank: "citi", name: "Citi Travel", site: "travel.citi.com" },
] as const;
export const PORTAL_CENTS = 1;

/**
 * Revenue-based programs price awards from the cash fare. Typical value per
 * point (US Credit Cards 101, Aug 2026): Southwest 1.2 to 1.4 cents, JetBlue
 * 1.3 to 1.5 cents. Award taxes are the U.S. security fee ($5.60 one way).
 */
export const REVENUE_PROGRAMS: Record<string, { source: string; low: number; high: number }> = {
  WN: { source: "southwest", low: 1.2, high: 1.4 },
  B6: { source: "jetblue", low: 1.3, high: 1.5 },
};

/**
 * Dynamic-priced programs: no chart, the airline sets the miles price for its
 * own flights largely from the cash fare. WRLD predicts it from today's fare.
 * Starting values bracket NerdWallet's 2026 medians (Delta and United 1.2
 * cents, American 1.7, Alaska 1.4); WRLD replaces them with what its own
 * travelers' saved prices show once there are enough (award_fare_rates).
 */
export const PREDICTED_PROGRAMS: Record<string, { source: string; low: number; high: number }> = {
  DL: { source: "delta", low: 1.0, high: 1.4 },
  UA: { source: "united", low: 1.0, high: 1.4 },
  AA: { source: "american", low: 1.3, high: 1.9 },
  AS: { source: "alaska", low: 1.2, high: 1.6 },
};
export const CARRIER_OF: Record<string, string> = Object.fromEntries(
  Object.entries({ ...REVENUE_PROGRAMS, ...PREDICTED_PROGRAMS }).map(([code, p]) => [p.source, code]),
);
