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

type Place = { code: string; country: string };

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
  /** One-way price for the trip, or null if the chart doesn't price it. `miles` = distance flown. */
  price: (o: Place, d: Place, miles: number, cabin: Cabin, date?: string | null) => { points: number; note?: string } | null;
};

function bandPrice(zoneOf: (c: string) => Zone | null, bands: Partial<Record<`${Zone}-${Zone}`, Band[]>>) {
  return (o: Place, d: Place, miles: number, cabin: Cabin) => {
    if (cabin === "premium") return null; // premium economy isn't on the published partner chart
    const za = zoneOf(o.country);
    const zb = zoneOf(d.country);
    if (!za || !zb) return null;
    const band = (bands[`${za}-${zb}`] ?? bands[`${zb}-${za}`])?.find((x) => miles <= x.upTo);
    return band ? { points: band[cabin] } : null;
  };
}

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
  price: bandPrice((c) => (NORTH_AMERICA.has(c) ? "north_america" : ATLANTIC.has(c) ? "atlantic" : PACIFIC.has(c) ? "pacific" : null), {
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
  }),
};

// AAdvantage partner chart: one-way from the Lower 48 and Canada, by region.
// AwardFares AAdvantage guide (updated Aug 6, 2026) and AwardWallet AA award chart
// (July 2026) agree. American calls these "starting values"; American-operated
// flights are dynamic. Main Cabin to Europe is 22,500 off-peak
// (Jan 10–Mar 14 and Nov 1–Dec 14).
type AaRegion = "europe" | "asia1" | "asia2" | "middle_east" | "india" | "sa1" | "sa2" | "mexico_carib" | "hawaii" | "south_pacific" | "africa";
const AA_REGION: Record<string, AaRegion> = {};
const put = (r: AaRegion, codes: string) => codes.split(" ").forEach((c) => (AA_REGION[c] = r));
put("europe", "GB IE FR DE ES PT IT NL BE LU CH AT DK SE NO FI IS PL CZ SK HU GR HR SI RO BG MT CY EE LV LT");
put("asia1", "JP KR");
put("asia2", "CN HK MO TW SG TH VN PH MY ID KH");
put("middle_east", "AE QA BH KW OM SA JO IL LB");
put("india", "IN LK BD NP MV");
put("sa1", "CO EC PE VE");
put("sa2", "AR BR CL UY PY BO");
put("mexico_carib", "MX BS JM DO HT PR VI CU KY TC BB AG LC GD VC KN DM TT AW CW SX BQ MQ GP BM CR PA GT BZ HN NI SV");
put("south_pacific", "AU NZ PF");
put("africa", "ZA KE MA NG ET TZ GH SN RW UG");
const AA_CHART: Record<AaRegion, [number, number, number]> = {
  // economy, business, first
  europe: [30000, 57500, 85000],
  asia1: [35000, 60000, 80000],
  asia2: [37500, 70000, 110000],
  middle_east: [40000, 70000, 115000],
  india: [40000, 70000, 115000],
  sa1: [20000, 30000, 55000],
  sa2: [30000, 57500, 85000],
  mexico_carib: [17500, 27500, 52500],
  hawaii: [22500, 55000, 80000],
  south_pacific: [40000, 80000, 110000],
  africa: [40000, 75000, 120000],
};
const HAWAII = new Set(["HNL", "OGG", "KOA", "LIH", "ITO", "MKK", "LNY"]);
const ALASKA = new Set(["ANC", "FAI", "JNU", "KTN", "SIT", "BET", "OME", "OTZ", "ADQ", "CDV", "SCC", "AKN", "DLG", "YAK", "WRG", "PSG"]);
const lower48OrCanada = (p: Place) => (p.country === "US" && !HAWAII.has(p.code) && !ALASKA.has(p.code)) || p.country === "CA";
const aaRegion = (p: Place): AaRegion | null => (p.country === "US" && HAWAII.has(p.code) ? "hawaii" : (AA_REGION[p.country] ?? null));
const offPeak = (date: string) => {
  const md = date.slice(5);
  return (md >= "01-10" && md <= "03-14") || (md >= "11-01" && md <= "12-14");
};

const AADVANTAGE: ChartProgram = {
  source: "american",
  name: "American AAdvantage",
  appliesTo: "oneworld partner flights (British Airways, Iberia, Finnair, Japan Airlines, Qatar, Cathay Pacific, Qantas and others). American-operated flights are priced dynamically.",
  covers: (a) => allianceOf(a) === "oneworld" && !/^american/i.test(a),
  dynamic: (a) => /^american/i.test(a),
  checkedOn: "2026-10-13",
  sources: ["https://awardfares.com/blog/aadvantage-guide/", "https://awardwallet.com/airlines/american-aadvantage/aa-award-chart/"],
  price: (o, d, _miles, cabin, date) => {
    if (cabin === "premium") return null; // premium economy starting values come from one source only
    const home = lower48OrCanada(o) ? d : lower48OrCanada(d) ? o : null;
    const region = home ? aaRegion(home) : null;
    if (!region) return null;
    const [eco, biz, first] = AA_CHART[region];
    if (cabin === "economy" && region === "europe") {
      if (date && offPeak(date)) return { points: 22500, note: "off-peak" };
      if (!date) return { points: eco, note: "22,500 off-peak (Jan 10–Mar 14, Nov 1–Dec 14)" };
    }
    return { points: cabin === "economy" ? eco : cabin === "business" ? biz : first };
  },
};

export const CHART_PROGRAMS: ChartProgram[] = [AEROPLAN, AADVANTAGE];

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
  /** Price note, e.g. "off-peak" */
  note?: string;
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

const milesBetween = (x: string, y: string) => {
  const a = airportByCode(x);
  const b = airportByCode(y);
  return a && b ? Math.round(distanceKm(a, b) / KM_PER_MILE) : null;
};

/** Chart prices by nonstop distance only (no route check). */
export function chartPrices(origin: string, destination: string, cabin: Cabin, date?: string | null): ChartPrice[] {
  const a = airportByCode(origin);
  const b = airportByCode(destination);
  const miles = milesBetween(origin, destination);
  if (!a || !b || miles == null) return [];
  const out: ChartPrice[] = [];
  for (const p of CHART_PROGRAMS) {
    const price = p.price(a, b, miles, cabin, date);
    if (price) out.push({ source: p.source, program: p.name, points: price.points, note: price.note, miles, appliesTo: p.appliesTo, checkedOn: p.checkedOn, basis: "distance" });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Route-aware prices: only where a partner actually flies (nonstop or one stop)
// ---------------------------------------------------------------------------
export type RouteEdge = { origin: string; destination: string; airline: string; seasonal: boolean };

/** Who flies where, for one search: routes out of the origin and into each destination. */
export type Network = { known: Set<string>; edges: RouteEdge[] };

type Leg = { from: string; to: string; airlines: string[]; seasonal: boolean };

// Index of the network by airport pair and by airport, built once per search.
const indexes = new WeakMap<Network, { pairs: Map<string, RouteEdge[]>; near: Map<string, Set<string>> }>();
function indexOf(network: Network) {
  let ix = indexes.get(network);
  if (!ix) {
    const pairs = new Map<string, RouteEdge[]>();
    const near = new Map<string, Set<string>>();
    for (const e of network.edges) {
      const key = e.origin < e.destination ? `${e.origin}|${e.destination}` : `${e.destination}|${e.origin}`;
      const list = pairs.get(key);
      if (list) list.push(e);
      else pairs.set(key, [e]);
      if (!near.has(e.origin)) near.set(e.origin, new Set());
      if (!near.has(e.destination)) near.set(e.destination, new Set());
      near.get(e.origin)!.add(e.destination);
      near.get(e.destination)!.add(e.origin);
    }
    ix = { pairs, near };
    indexes.set(network, ix);
  }
  return ix;
}

function legs(network: Network, from: string, to: string, accept: (airline: string) => boolean): Leg | null {
  // Routes are listed on both airports' pages; either direction is evidence of the flight.
  const key = from < to ? `${from}|${to}` : `${to}|${from}`;
  const hits = (indexOf(network).pairs.get(key) ?? []).filter((e) => accept(e.airline));
  if (!hits.length) return null;
  return { from, to, airlines: [...new Set(hits.map((h) => h.airline))], seasonal: hits.every((h) => h.seasonal) };
}

/**
 * Chart prices using the route network. Picks the shortest partner itinerary
 * (nonstop first, then one connection) and prices its flown distance, the way
 * distance-based charts do. When neither airport's routes have been read yet,
 * falls back to the nonstop distance and says so. When both airports' routes
 * are known and no partner flies it, returns nothing for that program.
 */
export function routeAwareChartPrices(network: Network, origin: string, destination: string, cabin: Cabin, date?: string | null): ChartPrice[] {
  const routesKnown = network.known.has(origin) || network.known.has(destination);
  if (!routesKnown) return chartPrices(origin, destination, cabin, date);
  const bothKnown = network.known.has(origin) && network.known.has(destination);
  const a = airportByCode(origin);
  const b = airportByCode(destination);
  const direct = milesBetween(origin, destination);
  if (!a || !b || direct == null) return [];
  const out: ChartPrice[] = [];
  for (const p of CHART_PROGRAMS) {
    // Does the chart price this market at all?
    if (!p.price(a, b, direct, cabin, date)) continue;

    let best: { miles: number; via: string | null; airlines: string[]; seasonal: boolean } | null = null;
    const nonstop = legs(network, origin, destination, p.covers);
    if (nonstop) best = { miles: direct, via: null, airlines: nonstop.airlines, seasonal: nonstop.seasonal };
    if (!best) {
      const hubs = indexOf(network).near.get(origin) ?? new Set<string>();
      for (const h of hubs) {
        if (h === destination) continue;
        const first = legs(network, origin, h, p.covers);
        const second = first && legs(network, h, destination, p.covers);
        const m1 = milesBetween(origin, h);
        const m2 = milesBetween(h, destination);
        if (!first || !second || m1 == null || m2 == null) continue;
        const total = m1 + m2;
        // Skip big detours (more than 40% longer than flying straight).
        if (total > direct * 1.4) continue;
        if (!best || total < best.miles) {
          best = { miles: total, via: h, airlines: [...new Set([...first.airlines, ...second.airlines])], seasonal: first.seasonal || second.seasonal };
        }
      }
    }
    if (!best) {
      if (!bothKnown) {
        const price = p.price(a, b, direct, cabin, date)!;
        out.push({ source: p.source, program: p.name, points: price.points, note: price.note, miles: direct, appliesTo: p.appliesTo, checkedOn: p.checkedOn, basis: "distance" });
      }
      continue;
    }
    const price = p.price(a, b, best.miles, cabin, date);
    if (!price) continue;
    out.push({
      source: p.source,
      program: p.name,
      points: price.points,
      note: price.note,
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
