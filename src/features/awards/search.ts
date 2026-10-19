import "server-only";

import { cacheLife } from "next/cache";
import { PAUSED } from "@/lib/paused";

import { env } from "@/lib/env";

import { CABINS, type Cabin, SOURCE_PROGRAM } from "./regions";

/**
 * Award (points) flight availability.
 *
 *   Live:   Seats.aero Partner API cached search, when SEATS_AERO_API_KEY is
 *           set. Seats.aero allows commercial use only with written approval
 *           (email support@seats.aero); until then use your own Pro key for
 *           testing only. 1,000 calls a day, so results are cached for an hour.
 *   Off:    no key. WRLD never shows made-up seats; the explorer uses
 *           published award charts and traveler reports instead.
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
  /** Shared by a traveler who saw it on the airline's site (not checked by WRLD) */
  reported?: boolean;
  /** Taxes and fees on top of the points, as the airline showed them */
  taxes?: number | null;
  taxCurrency?: string | null;
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

export type AwardMode = "live" | "off";

export function awardMode(): AwardMode {
  return env("SEATS_AERO_API_KEY") && !PAUSED.seatsAero ? "live" : "off";
}

export async function searchAwards(q: AwardSearch): Promise<{ mode: AwardMode; results: AwardResult[]; error?: string }> {
  const mode = awardMode();
  if (mode === "off") return { mode, results: [] };
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
      taxes: Number.isFinite(Number(a[`${k}TotalTaxes`])) ? Number(a[`${k}TotalTaxes`]) / 100 : null,
      taxCurrency: typeof a.TaxesCurrency === "string" ? a.TaxesCurrency : null,
    });
  }
  return out;
}

export function programFor(source: string) {
  return SOURCE_PROGRAM[source] ?? { name: source.charAt(0).toUpperCase() + source.slice(1), url: "" };
}
