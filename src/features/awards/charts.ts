import "server-only";

import { airportByCode } from "@/features/places/airports";
import { distanceKm } from "@/lib/geo";

import type { Cabin } from "./regions";

/**
 * Published award charts: what a program charges for a route, worked out
 * from its own zones and distance bands. No outside data, no availability:
 * it answers "what would this cost if a seat is open?", which the explorer
 * pairs with traveler-reported seats and a link to search the program.
 *
 * Only values confirmed in two independent sources are entered, with where
 * they came from and when. Programs change charts; re-check every quarter.
 */

type Zone = "north_america" | "atlantic" | "pacific";
type Band = { upTo: number; economy: number; business: number; first: number };

export type ChartProgram = {
  source: string; // matches SOURCE_PROGRAM keys
  name: string;
  /** Who operates the flights this chart prices */
  appliesTo: string;
  checkedOn: string;
  sources: string[];
  zoneOf: (country: string) => Zone | null;
  bands: Partial<Record<`${Zone}-${Zone}`, Band[]>>;
};

// Aeroplan zones, kept to countries whose zone is unambiguous.
const NORTH_AMERICA = new Set(["US", "CA"]);
const ATLANTIC = new Set([
  "GB", "IE", "FR", "DE", "ES", "PT", "IT", "NL", "BE", "LU", "CH", "AT", "DK", "SE", "NO", "FI", "IS", "PL", "CZ", "SK", "HU",
  "GR", "HR", "SI", "RO", "BG", "MT", "CY", "EE", "LV", "LT",
]);
const PACIFIC = new Set(["JP", "KR", "CN", "TW", "HK", "MO", "SG", "TH", "VN", "PH", "MY", "ID", "KH"]);

/** Aeroplan partner chart, for bookings made on or after June 1, 2026 (one way, points). */
const AEROPLAN: ChartProgram = {
  source: "aeroplan",
  name: "Air Canada Aeroplan",
  appliesTo: "Star Alliance partner flights (Lufthansa, SWISS, Austrian, ANA, EVA, TAP and others). Air Canada and United flights are priced dynamically and can cost more.",
  checkedOn: "2026-10-13",
  sources: [
    "https://princeoftravel.com/news/aeroplan-flight-reward-chart-june-2026/",
    "https://onemileatatime.com/news/aeroplan-updating-award-chart-devaluation/",
  ],
  zoneOf: (c) => (NORTH_AMERICA.has(c) ? "north_america" : ATLANTIC.has(c) ? "atlantic" : PACIFIC.has(c) ? "pacific" : null),
  bands: {
    "north_america-atlantic": [
      { upTo: 4000, economy: 32500, business: 60000, first: 90000 },
      { upTo: 6000, economy: 42500, business: 75000, first: 120000 },
      { upTo: 8000, economy: 60000, business: 90000, first: 150000 },
      { upTo: Infinity, economy: 75000, business: 110000, first: 165000 },
    ],
    "north_america-pacific": [
      { upTo: 5000, economy: 32500, business: 55000, first: 90000 },
      { upTo: 7500, economy: 50000, business: 85000, first: 120000 },
      { upTo: 11000, economy: 65000, business: 102500, first: 140000 },
      { upTo: Infinity, economy: 70000, business: 115000, first: 150000 },
    ],
    "atlantic-pacific": [
      { upTo: 2500, economy: 25000, business: 47500, first: 55000 },
      { upTo: 5000, economy: 40000, business: 75000, first: 95000 },
      { upTo: 7000, economy: 60000, business: 92500, first: 120000 },
      { upTo: Infinity, economy: 75000, business: 130000, first: 150000 },
    ],
    "atlantic-atlantic": [
      { upTo: 1000, economy: 7500, business: 12500, first: 25000 },
      { upTo: 2000, economy: 15000, business: 22500, first: 40000 },
      { upTo: 4000, economy: 30000, business: 40000, first: 75000 },
      { upTo: 6000, economy: 42500, business: 70000, first: 100000 },
      { upTo: Infinity, economy: 50000, business: 95000, first: 130000 },
    ],
    "pacific-pacific": [
      { upTo: 1000, economy: 8000, business: 20000, first: 25000 },
      { upTo: 2000, economy: 15000, business: 30000, first: 50000 },
      { upTo: 5000, economy: 30000, business: 52500, first: 60000 },
      { upTo: 7000, economy: 35000, business: 72500, first: 80000 },
      { upTo: Infinity, economy: 50000, business: 85000, first: 130000 },
    ],
  },
};

export const CHART_PROGRAMS: ChartProgram[] = [AEROPLAN];

export type ChartPrice = {
  source: string;
  program: string;
  points: number;
  miles: number;
  appliesTo: string;
  checkedOn: string;
};

const KM_PER_MILE = 1.609344;

/**
 * What each charted program charges one way for origin → destination in a
 * cabin. Distance is the straight-line (nonstop) distance; connections add
 * flown miles and can land in a higher band.
 */
export function chartPrices(origin: string, destination: string, cabin: Cabin): ChartPrice[] {
  const a = airportByCode(origin);
  const b = airportByCode(destination);
  if (!a || !b || cabin === "premium") return []; // premium economy isn't on the published partner chart
  const miles = Math.round(distanceKm(a, b) / KM_PER_MILE);
  const out: ChartPrice[] = [];
  for (const p of CHART_PROGRAMS) {
    const za = p.zoneOf(a.country);
    const zb = p.zoneOf(b.country);
    if (!za || !zb) continue;
    const bands = p.bands[`${za}-${zb}`] ?? p.bands[`${zb}-${za}`];
    const band = bands?.find((x) => miles <= x.upTo);
    if (!band) continue;
    out.push({ source: p.source, program: p.name, points: band[cabin], miles, appliesTo: p.appliesTo, checkedOn: p.checkedOn });
  }
  return out;
}
