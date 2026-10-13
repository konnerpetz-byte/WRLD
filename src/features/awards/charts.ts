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

export type Alliance = "star" | "oneworld" | "skyteam";

export type ChartProgram = {
  source: string; // matches SOURCE_PROGRAM keys
  name: string;
  /** Airlines whose flights this chart prices (by operating airline name) */
  covers: (airline: string) => boolean;
  /** Airlines bookable with this program but priced dynamically (shown, never estimated) */
  dynamic?: (airline: string) => boolean;
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
  covers: (a) => allianceOf(a) === "star" && !/^(air canada|united)/i.test(a),
  dynamic: (a) => /^(air canada|united)/i.test(a),
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

/**
 * Alliance by operating airline, as named in airport route lists. Regional
 * brands fly for their mainline partner (United Express → United).
 * Membership as of October 2026: SAS is SkyTeam (since September 2024).
 */
const STAR = /^(aegean|air canada|air china|air india(?! express)|air new zealand|all nippon|ana\b|asiana|austrian|avianca|brussels airlines|copa|croatia airlines|egyptair|ethiopian|eva air|lot\b|lot polish|lufthansa|shenzhen airlines|singapore airlines|south african airways|swiss|tap\b|tap air portugal|tap express|thai airways|turkish airlines|united)/i;
const ONEWORLD = /^(american airlines|american eagle|alaska airlines|horizon air|british airways|ba cityflyer|ba euroflyer|cathay pacific|finnair|iberia|japan airlines|j-air|malaysia airlines|qantas|qatar airways|royal air maroc|royal jordanian|srilankan|fiji airways)/i;
const SKYTEAM = /^(aerol[ií]neas argentinas|aerom[eé]xico|air europa|air france|hop!|china airlines|china eastern|delta|garuda|kenya airways|klm|korean air|middle east airlines|saudia|sas\b|scandinavian airlines|tarom|vietnam airlines|virgin atlantic|xiamenair|xiamen airlines)/i;

export function allianceOf(airline: string): Alliance | null {
  if (STAR.test(airline)) return "star";
  if (ONEWORLD.test(airline)) return "oneworld";
  if (SKYTEAM.test(airline)) return "skyteam";
  return null;
}

export type ChartPrice = {
  source: string;
  program: string;
  points: number;
  miles: number;
  appliesTo: string;
  checkedOn: string;
  /** How WRLD knows a partner flies it: "route" (route network) or "distance" (route not checked yet) */
  basis: "route" | "distance";
  /** The partner itinerary priced: airlines and the connection, if any */
  via?: string | null;
  airlines?: string[];
  seasonal?: boolean;
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
    out.push({ source: p.source, program: p.name, points: band[cabin], miles, appliesTo: p.appliesTo, checkedOn: p.checkedOn, basis: "distance" });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Route-aware prices: only where a partner actually flies (nonstop or one stop)
// ---------------------------------------------------------------------------
export type RouteEdge = { origin: string; destination: string; airline: string; seasonal: boolean };

/** Who flies where, for one search: routes out of the origin and into each destination. */
export type Network = { known: Set<string>; edges: RouteEdge[] };

const milesBetween = (x: string, y: string) => {
  const a = airportByCode(x);
  const b = airportByCode(y);
  return a && b ? Math.round(distanceKm(a, b) / KM_PER_MILE) : null;
};

type Leg = { from: string; to: string; airlines: string[]; seasonal: boolean };

function legs(network: Network, from: string, to: string, accept: (airline: string) => boolean): Leg | null {
  // Routes are listed on both airports' pages; either direction is evidence of the flight.
  const hits = network.edges.filter(
    (e) => ((e.origin === from && e.destination === to) || (e.origin === to && e.destination === from)) && accept(e.airline),
  );
  if (!hits.length) return null;
  return { from, to, airlines: [...new Set(hits.map((h) => h.airline))], seasonal: hits.every((h) => h.seasonal) };
}

/**
 * Chart prices using the route network. Picks the shortest partner itinerary
 * (nonstop first, then one connection) and prices its flown distance, the way
 * distance-based charts do. When neither airport's routes have been read yet,
 * falls back to the nonstop distance and says so. When the routes are known
 * and no partner flies it, returns nothing for that program: no false hope.
 */
export function routeAwareChartPrices(network: Network, origin: string, destination: string, cabin: Cabin): ChartPrice[] {
  const routesKnown = network.known.has(origin) || network.known.has(destination);
  if (!routesKnown) return chartPrices(origin, destination, cabin);
  // Only conclude "no partner flies this" when both airports' route lists have been read.
  const bothKnown = network.known.has(origin) && network.known.has(destination);
  const fallback = chartPrices(origin, destination, cabin);
  const a = airportByCode(origin);
  const b = airportByCode(destination);
  if (!a || !b || cabin === "premium") return [];
  const out: ChartPrice[] = [];
  for (const p of CHART_PROGRAMS) {
    const za = p.zoneOf(a.country);
    const zb = p.zoneOf(b.country);
    if (!za || !zb) continue;
    const bands = p.bands[`${za}-${zb}`] ?? p.bands[`${zb}-${za}`];
    if (!bands) continue;

    let best: { miles: number; via: string | null; airlines: string[]; seasonal: boolean } | null = null;
    const nonstop = legs(network, origin, destination, p.covers);
    const direct = milesBetween(origin, destination);
    if (nonstop && direct) best = { miles: direct, via: null, airlines: nonstop.airlines, seasonal: nonstop.seasonal };
    if (!best) {
      const hubs = new Set<string>();
      for (const e of network.edges) {
        if (e.origin === origin) hubs.add(e.destination);
        if (e.destination === origin) hubs.add(e.origin);
      }
      for (const h of hubs) {
        if (h === destination) continue;
        const first = legs(network, origin, h, p.covers);
        const second = first && legs(network, h, destination, p.covers);
        const m1 = milesBetween(origin, h);
        const m2 = milesBetween(h, destination);
        if (!first || !second || m1 == null || m2 == null) continue;
        const total = m1 + m2;
        // Skip big detours (more than 40% longer than flying straight).
        if (direct && total > direct * 1.4) continue;
        if (!best || total < best.miles) {
          best = { miles: total, via: h, airlines: [...new Set([...first.airlines, ...second.airlines])], seasonal: first.seasonal || second.seasonal };
        }
      }
    }
    if (!best) {
      if (!bothKnown) out.push(...fallback.filter((f) => f.source === p.source));
      continue;
    }
    const band = bands.find((x) => best!.miles <= x.upTo);
    if (!band) continue;
    out.push({
      source: p.source,
      program: p.name,
      points: band[cabin],
      miles: best.miles,
      appliesTo: p.appliesTo,
      checkedOn: p.checkedOn,
      basis: "route",
      via: best.via,
      airlines: best.airlines,
      seasonal: best.seasonal,
    });
  }
  return out;
}
