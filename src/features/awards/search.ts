import "server-only";

import { cacheLife } from "next/cache";

import { env } from "@/lib/env";

import { CABINS, type Cabin, SOURCE_PROGRAM } from "./regions";

/**
 * Award (points) flight availability.
 *
 *   Live:   Seats.aero Partner API cached search, when SEATS_AERO_API_KEY is
 *           set. Seats.aero allows commercial use only with written approval
 *           (email support@seats.aero); until then use your own Pro key for
 *           testing only. 1,000 calls a day, so results are cached for an hour.
 *   Sample: made-up but realistic results when PRICING_SAMPLE_DATA=true and
 *           there's no key, clearly labeled in the UI.
 */

export type AwardResult = {
  id: string;
  date: string; // YYYY-MM-DD
  origin: string;
  destination: string;
  source: string; // mileage program (Seats.aero "Source")
  cabin: Cabin;
  miles: number;
  seats: number | null;
  airlines: string;
  direct: boolean;
  updatedAt: string | null;
};

export type AwardSearch = {
  origin: string;
  destinations: string[];
  start: string;
  end: string;
  cabin: Cabin;
  directOnly: boolean;
  /** Only these mileage programs (Seats.aero source names); empty = all. */
  sources?: string[];
};

export type AwardMode = "live" | "sample" | "off";

export function awardMode(): AwardMode {
  if (env("SEATS_AERO_API_KEY")) return "live";
  if (process.env.PRICING_SAMPLE_DATA === "true") return "sample";
  return "off";
}

export async function searchAwards(q: AwardSearch): Promise<{ mode: AwardMode; results: AwardResult[]; error?: string }> {
  const mode = awardMode();
  if (mode === "off") return { mode, results: [] };
  if (mode === "sample") {
    const only = q.sources?.length ? new Set(q.sources) : null;
    return { mode, results: sampleAwards(q).filter((r) => !only || only.has(r.source)) };
  }
  try {
    return { mode, results: await seatsAeroSearch(q.origin, q.destinations.join(","), q.start, q.end, q.cabin, q.directOnly, (q.sources ?? []).join(",")) };
  } catch (e) {
    return { mode, results: [], error: e instanceof Error ? e.message : "Search failed" };
  }
}

type SeatsAvailability = Record<string, unknown> & {
  ID: string;
  Date: string;
  Source: string;
  UpdatedAt?: string;
  Route: { OriginAirport: string; DestinationAirport: string };
};

async function seatsAeroSearch(origin: string, destinations: string, start: string, end: string, cabin: Cabin, directOnly: boolean, sources: string): Promise<AwardResult[]> {
  "use cache";
  cacheLife("hours");
  const k = CABINS[cabin].key;
  const url = new URL("https://seats.aero/partnerapi/search");
  url.search = new URLSearchParams({
    origin_airport: origin,
    destination_airport: destinations,
    start_date: start,
    end_date: end,
    cabins: cabin,
    order_by: "lowest_mileage",
    take: "500",
    ...(directOnly ? { only_direct_flights: "true" } : {}),
    ...(sources ? { sources } : {}),
  }).toString();
  const response = await fetch(url, {
    headers: { "Partner-Authorization": env("SEATS_AERO_API_KEY") ?? "", Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
  });
  if (response.status === 429) throw new Error("Seats.aero's daily search limit was reached. Try again tomorrow.");
  if (!response.ok) throw new Error(`Seats.aero answered ${response.status}`);
  const body = (await response.json()) as { data?: SeatsAvailability[] };
  const out: AwardResult[] = [];
  for (const a of body.data ?? []) {
    if (!a[`${k}Available`]) continue;
    const miles = Number(a[`${k}MileageCost`]);
    if (!Number.isFinite(miles) || miles <= 0) continue;
    out.push({
      id: a.ID,
      date: a.Date.slice(0, 10),
      origin: a.Route.OriginAirport,
      destination: a.Route.DestinationAirport,
      source: a.Source,
      cabin,
      miles,
      seats: Number(a[`${k}RemainingSeats`]) || null,
      airlines: String(a[`${k}Airlines`] ?? ""),
      direct: Boolean(a[`${k}Direct`]),
      updatedAt: a.UpdatedAt ?? null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sample data: deterministic, so the same search shows the same results.
// ---------------------------------------------------------------------------
const BASE: Record<string, [number, number]> = {
  // cheapest economy, cheapest business (thousands of miles, one way)
  LHR: [26, 60], CDG: [30, 60], AMS: [30, 60], FRA: [30, 70], MUC: [30, 70], MAD: [30, 60], BCN: [30, 60], LIS: [30, 60],
  FCO: [30, 70], ATH: [35, 70], DUB: [26, 50], ZRH: [30, 70], VIE: [30, 70], CPH: [30, 60], IST: [35, 45], EDI: [26, 57],
  MXP: [30, 70], PRG: [30, 70], HND: [35, 75], NRT: [35, 75], KIX: [35, 75], ICN: [35, 75], TPE: [35, 75], HKG: [40, 85],
  SIN: [40, 85], BKK: [40, 85], MNL: [40, 85], DEL: [40, 80], CUN: [12, 25], MEX: [12, 25], SJD: [12, 25], SJU: [10, 25],
  PUJ: [12, 25], LIR: [12, 30], BOG: [15, 35], LIM: [20, 40], GRU: [30, 60], EZE: [30, 60], SCL: [30, 60], DXB: [40, 80],
  DOH: [40, 70], AUH: [40, 70], TLV: [40, 75], CAI: [40, 75], CPT: [45, 80], JNB: [45, 80], NBO: [45, 80], RAK: [35, 70],
  SYD: [45, 85], MEL: [45, 85], BNE: [45, 85], AKL: [45, 85], HNL: [20, 40], NAN: [35, 70], PPT: [35, 70],
};
const SAMPLE_SOURCES = ["united", "aeroplan", "flyingblue", "american", "delta", "british", "virginatlantic", "alaska", "turkish"];
const SAMPLE_AIRLINES: Record<string, string> = {
  united: "UA", aeroplan: "AC, LH", flyingblue: "AF, KL", american: "AA, BA", delta: "DL, VS", british: "BA", virginatlantic: "VS, DL", alaska: "AS, JL", turkish: "TK",
};
const CABIN_FACTOR: Record<Cabin, number> = { economy: 1, premium: 1.6, business: 1, first: 1.5 };

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

function sampleAwards(q: AwardSearch): AwardResult[] {
  const out: AwardResult[] = [];
  const start = new Date(`${q.start}T12:00:00Z`);
  const end = new Date(`${q.end}T12:00:00Z`);
  for (const dest of q.destinations) {
    if (dest === q.origin) continue;
    const [eco, biz] = BASE[dest] ?? [15, 40];
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const date = d.toISOString().slice(0, 10);
      for (const source of SAMPLE_SOURCES) {
        const r = hash(`${q.origin}${dest}${date}${source}${q.cabin}`);
        if (r > 0.12) continue; // ~1 in 8 program-days has space
        const base = (q.cabin === "economy" || q.cabin === "premium" ? eco : biz) * CABIN_FACTOR[q.cabin];
        const miles = Math.round((base * (1 + hash(`${dest}${date}${source}`) * 1.4)) / 2.5) * 2500;
        const direct = hash(`${dest}${source}direct`) > 0.55;
        if (q.directOnly && !direct) continue;
        out.push({
          id: `sample-${q.origin}-${dest}-${date}-${source}-${q.cabin}`,
          date,
          origin: q.origin,
          destination: dest,
          source,
          cabin: q.cabin,
          miles,
          seats: 1 + Math.floor(hash(`${date}${source}seats`) * 4),
          airlines: SAMPLE_AIRLINES[source] ?? "",
          direct,
          updatedAt: null,
        });
      }
    }
  }
  return out;
}

export function programFor(source: string) {
  return SOURCE_PROGRAM[source] ?? { name: source.charAt(0).toUpperCase() + source.slice(1), url: "" };
}
