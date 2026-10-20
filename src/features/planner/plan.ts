import "server-only";

import { type CashFare, cashFares, cashFaresEnabled, PORTALS, roundTripFares } from "@/features/awards/cash-fares";
import { type Network, routeAwareChartPrices } from "@/features/awards/charts";
import { estimateFees, type Fx } from "@/features/awards/fees";
import { loadNetwork } from "@/features/awards/network";
import { AIRPORT_CITY, REGIONS, type RegionKey, SOURCE_PROGRAM } from "@/features/awards/regions";
import { BANKS } from "@/features/awards/transfers";
import { airportByCode } from "@/features/places/airports";
import { distanceKm } from "@/lib/geo";
import type { requireUserId } from "@/lib/supabase/server";

import { type CostBasis, groundCost, type Style, STYLES } from "./costs";
import { FLY_GEMS } from "./gems";
import { fareSeason, hotelSeason } from "./seasons";
import { flyMeta } from "./vibes";
import { type Factors, loadPerDiem, type PerDiem, type Place, placeForAirport } from "./per-diem";

type Supabase = Awaited<ReturnType<typeof requireUserId>>["supabase"];

/** Points by where they sit: a bank key ("chase") or an airline program ("aeroplan"). */
export type Points = Record<string, number>;

export type PlanInput = {
  home: string;
  cash: number;
  points: Points;
  nights: number;
  travelers: number;
  style: Style;
  /** "2027-03" */
  month: string;
  region: RegionKey | "anywhere";
  /** Price just this destination (a trip's airport) instead of searching */
  only?: string | null;
  /** A trip's dates: fares are looked up around these days instead of across the month */
  dates?: { start: string; end: string } | null;
  /** The trip's own first stop, priced instead of the airport's city when given */
  place?: { city: string; country: string } | null;
};

/** One way to pay for the flights. */
export type FlightPay =
  | { kind: "cash" }
  | {
      kind: "award";
      source: string;
      program: string;
      label?: string;
      miles: number;
      taxes: number;
      surcharges: boolean;
      from: { key: string; points: number; miles: number }[];
    }
  | { kind: "portal"; from: { key: string; points: number }[]; dollars: number };

export type TripOption = {
  code: string;
  city: string;
  region: RegionKey | null;
  /** Where the hotel and daily costs come from: the city itself, the nearest listed city, or a default */
  costBasis: CostBasis;
  costNear?: string;
  /** Round-trip fare for everyone, and whether it's today's fare or WRLD's estimate */
  fare: number;
  /** "live": both ways from real fares; "half": outbound real, return taken as the same price; "estimate": from distance */
  fareIs: "live" | "half" | "estimate";
  /** Day of the cheapest outbound fare, when WRLD has one */
  departDate: string | null;
  pay: FlightPay;
  /** Cash spent on flights after points */
  flightCash: number;
  hotel: number;
  days: number;
  /** Card points spent on the hotel through the card's travel site */
  hotelPoints: { key: string; points: number }[];
  hotelCredit: number;
  /** Nights paid with World of Hyatt points (own or moved from Chase or Bilt), if any */
  hyatt: { nights: number; points: number; from: { key: string; points: number }[] } | null;
  /** Cash the whole trip needs */
  cashNeeded: number;
  /** What the trip would cost with no points at all */
  fullPrice: number;
  pointsUsed: number;
  /** Cents each point is worth across the trip */
  cents: number | null;
  fit: "fits" | "stretch" | "over";
};

const KM_PER_MILE = 1.609344;
const PORTAL_BANKS = new Set<string>(PORTALS.map((p) => p.bank));

/**
 * What card points buy on each bank's travel site, in cents. Flights: 1 cent
 * at all four. Hotels: 1 cent except Amex, which pays 0.7 cents on hotels.
 */
const SITE_CENTS: Record<string, { flight: number; hotel: number }> = {
  chase: { flight: 1, hotel: 1 },
  amex: { flight: 1, hotel: 0.7 },
  capitalone: { flight: 1, hotel: 1 },
  citi: { flight: 1, hotel: 1 },
};

/**
 * World of Hyatt: Chase and Bilt move to Hyatt 1:1. A Hyatt point typically
 * buys 1.65 cents of hotel (The Points Guy valuation, October 2026). Hyatt's
 * spring 2026 five-tier chart makes the real price depend on the hotel and the
 * night, so WRLD estimates nights from the city's hotel cost at that value and
 * says to check a real Hyatt before moving points.
 */
export const HYATT_CENTS = 1.65;
const HOTEL_PARTNERS: Record<string, Record<string, [number, number]>> = { hyatt: { bilt: [1, 1], chase: [1, 1] } };

export const POINT_KEYS: { value: string; label: string; group: "Card points" | "Hotel points" | "Airline miles" }[] = [
  ...BANKS.map((b) => ({ value: b.key, label: b.name, group: "Card points" as const })),
  { value: "hyatt", label: "World of Hyatt", group: "Hotel points" as const },
  ...Object.entries(SOURCE_PROGRAM)
    .map(([value, p]) => ({ value, label: p.name, group: "Airline miles" as const }))
    .sort((a, b) => a.label.localeCompare(b.label)),
];
const VALID_KEYS = new Set(POINT_KEYS.map((k) => k.value));

/** "chase:60000,bilt:20000" ⇄ { chase: 60000, bilt: 20000 } */
export function parsePoints(raw: string | undefined): Points {
  const out: Points = {};
  for (const part of (raw ?? "").split(",")) {
    const [k, v] = part.split(":");
    const n = Math.round(Number(v));
    if (k && VALID_KEYS.has(k) && Number.isFinite(n) && n > 0) out[k] = Math.min((out[k] ?? 0) + n, 50_000_000);
  }
  return out;
}
export const pointsParam = (p: Points) =>
  Object.entries(p)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${k}:${n}`)
    .join(",");

/** Destinations the planner considers: every region airport, one per city. */
function destinations(region: PlanInput["region"], home: string, only?: string | null) {
  if (only) {
    const r =
      (Object.keys(REGIONS) as RegionKey[]).find((k) => (REGIONS[k].airports as readonly string[]).includes(only)) ??
      FLY_GEMS.find((g) => g.code === only)?.region ??
      null;
    return only === home ? [] : [{ code: only, region: r }];
  }
  const keys = region === "anywhere" ? (Object.keys(REGIONS) as RegionKey[]) : [region];
  const out: { code: string; region: RegionKey | null }[] = [];
  for (const r of keys) for (const code of REGIONS[r].airports) if (code !== "NRT" && code !== home) out.push({ code, region: r });
  // Hidden gems: smaller and cheaper places in the same regions.
  for (const g of FLY_GEMS) if (keys.includes(g.region) && g.code !== home && !out.some((o) => o.code === g.code)) out.push({ code: g.code, region: g.region });
  return out;
}

/**
 * Round-trip economy fare per person when WRLD has no live fare: a distance
 * line fitted to typical 2026 U.S.-origin fares ($80 + 20¢ per one-way mile,
 * $150 minimum). Labeled as an estimate wherever it shows.
 */
const estimateFare = (miles: number) => Math.max(150, Math.round((80 + 0.2 * miles) / 10) * 10);

/** Uses balances for `miles` in an airline program: its own miles first, then bank points (Bilt first: it has no travel-site value). */
function fund(miles: number, source: string, bal: Points) {
  const from: { key: string; points: number; miles: number }[] = [];
  let left = miles;
  const own = Math.min(bal[source] ?? 0, left);
  if (own > 0) {
    from.push({ key: source, points: own, miles: own });
    left -= own;
  }
  const ratio = (b: (typeof BANKS)[number]) => HOTEL_PARTNERS[source]?.[b.key] ?? b.partners[source];
  const banks = BANKS.filter((b) => ratio(b)).sort((a, b) => Number(PORTAL_BANKS.has(a.key)) - Number(PORTAL_BANKS.has(b.key)));
  for (const b of banks) {
    if (left <= 0) break;
    const [give, get] = ratio(b);
    const have = bal[b.key] ?? 0;
    // Transfers go in 1,000-point steps.
    const need = Math.ceil((left * give) / get / 1000) * 1000;
    const use = Math.min(need, Math.floor(have / 1000) * 1000);
    if (use <= 0) continue;
    const got = Math.floor((use * get) / give);
    from.push({ key: b.key, points: use, miles: got });
    left -= got;
  }
  return left <= 0 ? from : null;
}

/** Spends travel-site points toward `dollars`: best-paying banks first. */
function portal(dollars: number, bal: Points, use: "flight" | "hotel") {
  const from: { key: string; points: number }[] = [];
  let left = dollars;
  let paid = 0;
  const banks = BANKS.filter((b) => SITE_CENTS[b.key]).sort((a, b) => SITE_CENTS[b.key][use] - SITE_CENTS[a.key][use]);
  for (const b of banks) {
    if (left <= 0.005) break;
    const cents = SITE_CENTS[b.key][use];
    const points = Math.min(bal[b.key] ?? 0, Math.ceil((left * 100) / cents));
    if (points > 0) {
      from.push({ key: b.key, points });
      const dollarsPaid = Math.min(left, (points * cents) / 100);
      paid += dollarsPaid;
      left -= dollarsPaid;
    }
  }
  return { from, dollars: paid };
}

/** Hyatt nights: as many as the balances cover, at the city's estimated price in points. */
function hyattNights(hotel: number, nights: number, bal: Points) {
  const perNight = Math.max(7500, Math.round(hotel / nights / (HYATT_CENTS / 100) / 500) * 500);
  for (let n = nights; n > 0; n--) {
    const from = fund(perNight * n, "hyatt", bal);
    if (from)
      return { nights: n, points: perNight * n, from: from.map(({ key, points }) => ({ key, points })), dollars: (hotel / nights) * n };
  }
  return null;
}

const spend = (bal: Points, used: { key: string; points: number }[]) => {
  const next = { ...bal };
  for (const u of used) next[u.key] = (next[u.key] ?? 0) - u.points;
  return next;
};

/**
 * Where can this money and these points go? For every destination, prices the
 * whole trip (flights, hotel, days there), tries each way to pay for the
 * flights (cash, an award your points can reach, card travel sites), puts any
 * leftover card points toward the hotel, and keeps the plan that needs the
 * least cash.
 */
export async function planTrips(supabase: Supabase, input: PlanInput, fx: Fx) {
  if (!airportByCode(input.home)) return { options: [] as TripOption[], liveFares: false, factors: null };
  const codes = destinations(input.region, input.home, input.only).map((d) => d.code);
  const [y, m] = input.month.split("-").map(Number);
  // Around a trip's own dates (3 days either side), else the whole month.
  const around = (iso: string) => {
    const at = Date.parse(`${iso}T12:00:00Z`);
    const day = (n: number) => new Date(at + n * 86400000).toISOString().slice(0, 10);
    const start = day(-3);
    const end = day(3);
    return { start, end, months: [...new Set([start.slice(0, 7), end.slice(0, 7)])] };
  };
  const out = input.dates
    ? around(input.dates.start)
    : { start: `${input.month}-01`, end: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10), months: [input.month] };
  const back = input.only && input.dates ? around(input.dates.end) : null;
  const places: Place[] = codes
    .map((c) => (input.only === c && input.place ? { key: c, ...input.place } : placeForAirport(c)))
    .filter((p): p is Place => Boolean(p));
  const costDate = input.dates?.start ?? `${input.month}-15`;
  const [network, fares, returns, costs, roundTrips] = await Promise.all([
    loadNetwork(supabase, [input.home], codes),
    cashFares({ origins: [input.home], ...out, directOnly: false }),
    back && input.only ? cashFares({ origins: [input.only], ...back, directOnly: false }) : Promise.resolve([]),
    loadPerDiem(supabase, places, costDate),
    roundTripFares({ origin: input.home, ...out }),
  ]);
  return { options: priceTrips(input, network, fares, fx, returns, costs, roundTrips), liveFares: cashFaresEnabled(), factors: costs.factors };
}

/** The pricing itself, given the route network and this month's fares. */
export function priceTrips(
  input: PlanInput,
  network: Network,
  fares: CashFare[],
  fx: Fx,
  returns: CashFare[] = [],
  costs: { rates: Map<string, PerDiem>; factors: Factors } | null = null,
  /** Round-trip fares (both ways in one price), when the one-way data is missing a leg */
  roundTrips: CashFare[] = []
): TripOption[] {
  const o = airportByCode(input.home);
  if (!o) return [];
  const list = destinations(input.region, input.home, input.only);
  const cheapest = new Map<string, number>();
  const cheapestDay = new Map<string, string>();
  for (const f of fares)
    if (!cheapest.has(f.destination) || f.price < cheapest.get(f.destination)!) {
      cheapest.set(f.destination, f.price);
      cheapestDay.set(f.destination, f.date);
    }

  const t = input.travelers;
  const options: TripOption[] = [];
  for (const { code, region } of list) {
    const d = airportByCode(code);
    const month = input.dates?.start.slice(0, 7) ?? input.month;
    const base = groundCost(code, input.nights, t, input.style, costs?.rates.get(code), costs?.factors);
    if (!d || !base) continue;
    // Government rates already carry their seasons; WRLD's own city estimates are yearly
    // averages, so they follow the place's season pattern.
    const dated = base.basis === "perdiem-city" || base.basis === "perdiem-country";
    const hotelNow = dated ? base.hotel : Math.round(base.hotel * hotelSeason(flyMeta(code).season, month));
    const ground = { ...base, hotel: hotelNow, total: hotelNow + base.days };
    const miles = distanceKm(o, d) / KM_PER_MILE;
    if (miles < 150) continue;
    const live = cheapest.get(code);
    const liveBack = returns
      .filter((f) => f.origin === code && f.destination === input.home)
      .reduce<number | null>((a, f) => (a == null || f.price < a ? f.price : a), null);
    const roundTrip = roundTrips
      .filter((f) => f.destination === code)
      .reduce<number | null>((a, f) => (a == null || f.price < a ? f.price : a), null);
    // Both legs live: their sum. Otherwise a real round-trip fare beats doubling one leg. No live fare at
    // all: the distance estimate, moved by the month's pattern for that part of the world.
    const perPerson =
      live != null && liveBack != null
        ? Math.round(live + liveBack)
        : roundTrip != null
          ? Math.round(roundTrip)
          : live != null
            ? Math.round(live * 2)
            : Math.max(150, Math.round((estimateFare(miles) * fareSeason(region, month)) / 10) * 10);
    const fareIs: TripOption["fareIs"] = (live != null && liveBack != null) || roundTrip != null ? "live" : live != null ? "half" : "estimate";
    const fare = perPerson * t;

    // Every way to pay for the flights.
    const plans: { pay: FlightPay; flightCash: number; used: { key: string; points: number }[] }[] = [
      { pay: { kind: "cash" }, flightCash: fare, used: [] },
    ];
    for (const c of routeAwareChartPrices(network, input.home, code, "economy", null)) {
      const each = c.pointsHigh ?? c.points;
      const need = each * 2 * t;
      const from = fund(need, c.source, input.points);
      if (!from) continue;
      const via = c.via ? airportByCode(c.via) : null;
      const out = estimateFees({ origin: o, destination: d, via, cabin: "economy", source: c.source, airlines: c.airlines ?? [], fx });
      const back = estimateFees({ origin: d, destination: o, via, cabin: "economy", source: c.source, airlines: c.airlines ?? [], fx });
      const taxes = (out.high + back.high) * t;
      if (taxes >= fare) continue;
      plans.push({
        pay: {
          kind: "award",
          source: c.source,
          program: c.program,
          label: c.label,
          miles: need,
          taxes,
          surcharges: out.plusSurcharges || back.plusSurcharges,
          from,
        },
        flightCash: taxes,
        used: from,
      });
    }
    const viaPortal = portal(fare, input.points, "flight");
    if (viaPortal.dollars > 0) {
      plans.push({
        pay: { kind: "portal", from: viaPortal.from, dollars: viaPortal.dollars },
        flightCash: Math.round(fare - viaPortal.dollars),
        used: viaPortal.from,
      });
    }

    let best: TripOption | null = null;
    for (const p of plans) {
      const left = spend(input.points, p.used);
      // The hotel: travel-site points only, or Hyatt nights first and travel-site points for the rest.
      const hotelPlans: { hyatt: ReturnType<typeof hyattNights>; site: ReturnType<typeof portal> }[] = [
        { hyatt: null, site: portal(ground.hotel, left, "hotel") },
      ];
      const h = hyattNights(ground.hotel, input.nights, left);
      if (h) hotelPlans.push({ hyatt: h, site: portal(ground.hotel - h.dollars, spend(left, h.from), "hotel") });
      const hp = hotelPlans.reduce((a, b) => ((b.hyatt?.dollars ?? 0) + b.site.dollars > (a.hyatt?.dollars ?? 0) + a.site.dollars ? b : a));
      const toHotel = hp.site;
      const hotelPaid = (hp.hyatt?.dollars ?? 0) + toHotel.dollars;
      const cashNeeded = Math.round(p.flightCash + ground.total - hotelPaid);
      const pointsUsed = [...p.used, ...(hp.hyatt?.from ?? []), ...toHotel.from].reduce((s, u) => s + u.points, 0);
      const fullPrice = fare + ground.total;
      const option: TripOption = {
        code,
        city: AIRPORT_CITY[code] ?? d.city.replace(/\s*\(.*\)\s*$/, ""),
        region,
        costBasis: ground.basis,
        costNear: ground.near,
        fare,
        fareIs,
        departDate: cheapestDay.get(code) ?? null,
        pay: p.pay,
        flightCash: Math.round(p.flightCash),
        hotel: ground.hotel,
        days: ground.days,
        hotelPoints: toHotel.from,
        hotelCredit: Math.round(toHotel.dollars),
        hyatt: hp.hyatt ? { nights: hp.hyatt.nights, points: hp.hyatt.points, from: hp.hyatt.from } : null,
        cashNeeded,
        fullPrice,
        pointsUsed,
        cents: pointsUsed ? Math.round(((fullPrice - cashNeeded) / pointsUsed) * 10000) / 100 : null,
        fit: cashNeeded <= input.cash ? "fits" : cashNeeded <= input.cash * 1.2 ? "stretch" : "over",
      };
      if (!best || option.cashNeeded < best.cashNeeded || (option.cashNeeded === best.cashNeeded && option.pointsUsed < best.pointsUsed))
        best = option;
    }
    if (best) options.push(best);
  }
  return options;
}

export type PlanSort = "most" | "cash" | "value";

/** Fits first. "most": the biggest trip the budget buys; "cash": most cash left over; "value": points worth the most. */
export function sortOptions(options: TripOption[], sort: PlanSort) {
  const rank = { fits: 0, stretch: 1, over: 2 } as const;
  return [...options].sort(
    (a, b) =>
      rank[a.fit] - rank[b.fit] ||
      (sort === "cash" ? a.cashNeeded - b.cashNeeded : sort === "value" ? (b.cents ?? 0) - (a.cents ?? 0) : b.fullPrice - a.fullPrice)
  );
}

export const styleLabel = (s: Style) => STYLES[s].label;
