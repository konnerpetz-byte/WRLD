import "server-only";

import { airportByCode } from "@/features/places/airports";
import type { requireUserId } from "@/lib/supabase/server";

import { type ChartPrice, routeAwareChartPrices } from "./charts";
import { estimateFees, type FeeEstimate, type Fx } from "./fees";
import { loadNetwork } from "./network";
import { AIRPORT_CITY, CABINS, type Cabin, REGIONS, type RegionKey, SOURCE_PROGRAM } from "./regions";
import { programFor } from "./search";
import { BANKS, bankPointsFor, ratioLabel } from "./transfers";
import { type Typical, typicalPrices } from "./typical";

type Supabase = Awaited<ReturnType<typeof requireUserId>>["supabase"];

// ---------------------------------------------------------------- Query
export type Sort = "points" | "cash" | "mine";

export type ExplorerQuery = {
  origins: string[];
  regions: (RegionKey | "anywhere")[];
  codes: string[];
  destinations: string[];
  /** Selected months ("2027-05"), or an exact date range. */
  months: string[];
  start: string;
  end: string;
  cabins: Cabin[];
  banks: string[];
  programs: string[];
  mine: boolean;
  directOnly: boolean;
  sort: Sort;
};

const IATA = /^[A-Z]{3}$/;
const list = (v: string | undefined) => (v ?? "").split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function monthOptions(now = new Date()) {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    return { value: iso(d).slice(0, 7), label: d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }) };
  });
}

/** Reads the explorer's URL. Old links (?month=, ?cabin=, ?via=, ?to=europe) keep working. */
export function parseQuery(sp: Record<string, string | undefined>, home: string | null, now = new Date()): ExplorerQuery {
  const today = iso(now);
  const origins = list(sp.from ?? home ?? "").map((c) => c.toUpperCase()).filter((c) => IATA.test(c)).slice(0, 3);
  const toList = list(sp.to);
  const regions = toList.filter((t): t is RegionKey | "anywhere" => t === "anywhere" || t in REGIONS);
  const codes = [...list(sp.codes), ...toList.filter((t) => !(t in REGIONS) && t !== "anywhere")]
    .map((c) => c.toUpperCase())
    .filter((c) => IATA.test(c))
    .slice(0, 20);
  if (!regions.length && !codes.length) regions.push("europe");
  const all = regions.includes("anywhere") ? (Object.keys(REGIONS) as RegionKey[]) : (regions as RegionKey[]);
  const destinations = [...new Set([...all.flatMap((r) => [...REGIONS[r].airports]), ...codes])].filter((d) => !origins.includes(d));

  const valid = new Set(monthOptions(now).map((m) => m.value));
  let months = [...list(sp.months), ...(sp.month ? [sp.month] : [])].filter((m) => valid.has(m));
  const dateOk = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);
  let start = dateOk(sp.start);
  let end = dateOk(sp.end);
  if (start || end) {
    months = [];
    start = start && start >= today ? start : today;
    end = end && end >= start ? end : start;
    const max = iso(new Date(now.getTime() + 365 * 86400000));
    if (end > max) end = max;
  } else {
    if (!months.length) months = [monthOptions(now)[1].value];
    months.sort();
    const [y, m] = months.at(-1)!.split("-").map(Number);
    start = `${months[0]}-01` < today ? today : `${months[0]}-01`;
    end = iso(new Date(Date.UTC(y, m, 0)));
  }

  const cabins = [...list(sp.cabins), ...(sp.cabin ? [sp.cabin] : [])].filter((c): c is Cabin => c in CABINS);
  const via = sp.via ?? "";
  const banks = [...list(sp.banks), ...(via.startsWith("bank:") ? [via.slice(5)] : [])]
    .map((b) => BANKS.find((x) => x.key === b || x.slug === b)?.key)
    .filter((b): b is string => Boolean(b));
  const programs = [...list(sp.programs), ...(via.startsWith("program:") ? [via.slice(8)] : [])].filter((p) => p in SOURCE_PROGRAM);
  const sort: Sort = sp.sort === "cash" || sp.sort === "mine" ? sp.sort : "points";
  return {
    origins,
    regions,
    codes,
    destinations,
    months,
    start: start!,
    end: end!,
    cabins: cabins.length ? [...new Set(cabins)] : ["business"],
    banks: [...new Set(banks)],
    programs: [...new Set(programs)],
    mine: sp.mine === "1" || via === "mine",
    directOnly: sp.direct === "1",
    sort,
  };
}

// ---------------------------------------------------------------- Wallet
export type Wallet = { balances: Map<string, number> }; // by loyalty program slug

/** Programs the filters allow; null = every program. */
export function allowedPrograms(q: ExplorerQuery, wallet: Wallet): Set<string> | null {
  if (!q.programs.length && !q.banks.length && !q.mine) return null;
  const out = new Set<string>(q.programs);
  for (const key of q.banks) for (const p of Object.keys(BANKS.find((b) => b.key === key)?.partners ?? {})) out.add(p);
  if (q.mine) {
    for (const [slug, balance] of wallet.balances) {
      if (balance <= 0) continue;
      const bank = BANKS.find((b) => b.slug === slug);
      if (bank) Object.keys(bank.partners).forEach((p) => out.add(p));
      const own = Object.entries(SOURCE_PROGRAM).find(([, p]) => p.slug === slug)?.[0];
      if (own) out.add(own);
    }
  }
  return out;
}

// ---------------------------------------------------------------- Directions
export type Directions = { steps: string[]; covered: boolean; shortBy: number | null };

const site = (source: string) => {
  const url = programFor(source).url;
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : programFor(source).name;
  } catch {
    return programFor(source).name;
  }
};

/**
 * How to book it: which points to move where, then where to search.
 * Uses the traveler's own balances when WRLD knows them; otherwise lists the
 * cards that transfer to the program (or only the cards picked in the filters).
 */
export function directionsFor(o: {
  source: string;
  points: number;
  origin: string;
  destination: string;
  cabin: Cabin;
  date?: string | null;
  airlines?: string[];
  wallet: Wallet;
  banks: string[];
}): Directions {
  const program = programFor(o.source);
  const ownSlug = SOURCE_PROGRAM[o.source]?.slug;
  const own = ownSlug ? (o.wallet.balances.get(ownSlug) ?? 0) : 0;
  const when = o.date
    ? new Date(`${o.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })
    : "your dates";
  const flying = o.airlines?.length ? ` Look for ${o.airlines.slice(0, 2).join(" or ")} flights.` : "";
  const book = `Search ${site(o.source)} for a one-way ${CABINS[o.cabin].label.toLowerCase()} award, ${o.origin} to ${o.destination}, ${when}.${flying}`;
  const pts = (n: number) => n.toLocaleString("en-US");

  if (own >= o.points) {
    return { steps: [`Use ${pts(o.points)} of your ${pts(own)} ${program.name} points.`, book], covered: true, shortBy: null };
  }
  const need = o.points - own;
  const banks = BANKS.filter((b) => b.partners[o.source] && (!o.banks.length || o.banks.includes(b.key)));
  // A card balance that covers the rest.
  const ranked = banks
    .map((b) => {
      const ratio = b.partners[o.source];
      const needed = bankPointsFor(need, ratio);
      return { b, ratio, needed, have: o.wallet.balances.get(b.slug) ?? 0 };
    })
    .sort((x, y) => Number(y.have >= y.needed) - Number(x.have >= x.needed) || x.needed - y.needed);
  const ownStep = own > 0 ? [`Use your ${pts(own)} ${program.name} points.`] : [];
  const fits = ranked.find((r) => r.have >= r.needed);
  if (fits) {
    return {
      steps: [
        ...ownStep,
        `Transfer ${pts(fits.needed)} ${fits.b.unit} to ${program.name} (${ratioLabel(fits.ratio)}) on ${fits.b.site}.`,
        book,
      ],
      covered: true,
      shortBy: null,
    };
  }
  if (!ranked.length) {
    return { steps: [...ownStep, `${program.name} isn't a transfer partner of the cards ${o.banks.length ? "you picked" : "WRLD tracks"}. Earn its miles directly.`, book], covered: false, shortBy: need };
  }
  const best = ranked[0];
  const others = ranked.slice(1, 4).map((r) => `${r.b.short}${r.ratio[0] === r.ratio[1] ? "" : ` (${ratioLabel(r.ratio)})`}`);
  return {
    steps: [
      ...ownStep,
      `Transfer ${pts(best.needed)} ${best.b.unit} to ${program.name} (${ratioLabel(best.ratio)}) on ${best.b.site}${others.length ? `. ${others.join(", ")} also transfer${others.length === 1 ? "s" : ""} there` : ""}.`,
      book,
    ],
    covered: false,
    shortBy: o.wallet.balances.size ? Math.max(0, best.needed - best.have) : null,
  };
}

// ---------------------------------------------------------------- Results
export type SeatDay = { date: string; miles: number; taxes: number | null; taxCurrency: string | null; seenAt: string; id: number; reported: boolean };

export type Option = {
  key: string;
  origin: string;
  destination: string;
  cabin: Cabin;
  source: string;
  program: string;
  points: number;
  /** "seats": real seats (traveler reports or licensed data); "chart": published price when a seat opens */
  kind: "seats" | "chart";
  days: SeatDay[];
  chart?: ChartPrice;
  /** Cash on top of the points, in USD */
  cash: { low: number; high: number; reported: boolean; estimate: FeeEstimate };
  typical?: Typical;
  directions: Directions;
};

export type DestinationResult = { destination: string; city: string; options: Option[] };

export type ExplorerResult = { destinations: DestinationResult[]; seatsSeen: number; routesKnown: number };

export async function runExplorer(supabase: Supabase, userId: string, q: ExplorerQuery, wallet: Wallet, fx: Fx): Promise<ExplorerResult> {
  if (!q.origins.length || !q.destinations.length) return { destinations: [], seatsSeen: 0, routesKnown: 0 };
  const allowed = allowedPrograms(q, wallet);
  const ok = (source: string) => !allowed || allowed.has(source);

  // Log the search (the demand signal for which routes to watch).
  void supabase
    .from("award_searches")
    .insert({ user_id: userId, origin: q.origins[0], destinations: q.destinations.slice(0, 60), cabin: q.cabins[0], month: `${q.start.slice(0, 7)}-01`, via: null })
    .then(() => undefined, () => undefined);

  const fresh = new Date(Date.now() - 3 * 86400000).toISOString();
  const [network, typical, seatRows] = await Promise.all([
    loadNetwork(supabase, q.origins, q.destinations),
    typicalPrices(supabase, q.origins, q.destinations, q.cabins),
    (async () => {
      let query = supabase
        .from("award_availability")
        .select("id, origin, destination, travel_date, program, cabin, miles, airlines, direct, data_source, seen_at, taxes, tax_currency")
        .in("origin", q.origins)
        .in("destination", q.destinations.slice(0, 120))
        .in("cabin", q.cabins)
        .gte("travel_date", q.start)
        .lte("travel_date", q.end)
        .is("closed_at", null)
        .neq("data_source", "sample")
        .order("miles", { ascending: true })
        .limit(1000);
      if (q.directOnly) query = query.eq("direct", true);
      const { data } = await query;
      return (data ?? []).filter((r) => (r.data_source !== "community" || r.seen_at >= fresh) && (!q.months.length || q.months.includes(r.travel_date.slice(0, 7))));
    })(),
  ]);

  const single = q.start === q.end ? q.start : null;
  const options: Option[] = [];

  // Real seats first: grouped by route, cabin and program.
  const seatGroups = new Map<string, typeof seatRows>();
  for (const r of seatRows) {
    if (!ok(r.program)) continue;
    const key = `${r.origin}|${r.destination}|${r.cabin}|${r.program}`;
    seatGroups.set(key, [...(seatGroups.get(key) ?? []), r]);
  }
  for (const [key, rows] of seatGroups) {
    const [origin, destination, cabin, source] = key.split("|") as [string, string, Cabin, string];
    const o = airportByCode(origin);
    const d = airportByCode(destination);
    if (!o || !d) continue;
    const days = rows
      .map((r) => ({ date: r.travel_date, miles: r.miles, taxes: r.taxes === null ? null : Number(r.taxes), taxCurrency: r.tax_currency, seenAt: r.seen_at, id: r.id, reported: r.data_source === "community" }))
      .sort((a, b) => a.miles - b.miles || a.date.localeCompare(b.date));
    const best = days[0];
    const airlines = (rows.find((r) => r.airlines)?.airlines ?? "").split(/,\s*/).filter(Boolean);
    const estimate = estimateFees({ origin: o, destination: d, cabin, source, airlines, fx });
    const reportedCash = best.taxes !== null ? Math.round(fx(best.taxes, best.taxCurrency ?? "USD")) : null;
    options.push({
      key,
      origin,
      destination,
      cabin,
      source,
      program: programFor(source).name,
      points: best.miles,
      kind: "seats",
      days: [...days].sort((a, b) => a.date.localeCompare(b.date)),
      cash: reportedCash !== null ? { low: reportedCash, high: reportedCash, reported: true, estimate } : { low: estimate.low, high: estimate.high, reported: false, estimate },
      typical: typical.get(key),
      directions: directionsFor({ source, points: best.miles, origin, destination, cabin, date: best.date, airlines, wallet, banks: q.banks }),
    });
  }

  // Published chart prices where a partner flies the route.
  for (const origin of q.origins) {
    const o = airportByCode(origin);
    if (!o) continue;
    for (const destination of q.destinations) {
      const d = airportByCode(destination);
      if (!d) continue;
      for (const cabin of q.cabins) {
        for (const c of routeAwareChartPrices(network, origin, destination, cabin, single)) {
          if (!ok(c.source)) continue;
          if (q.directOnly && c.via) continue;
          const key = `${origin}|${destination}|${cabin}|${c.source}`;
          if (options.some((x) => x.key === key)) continue; // real seats already shown for this program
          const via = c.via ? airportByCode(c.via) : null;
          const estimate = estimateFees({ origin: o, destination: d, via, cabin, source: c.source, airlines: c.airlines ?? [], fx });
          options.push({
            key,
            origin,
            destination,
            cabin,
            source: c.source,
            program: c.program,
            points: c.points,
            kind: "chart",
            days: [],
            chart: c,
            cash: { low: estimate.low, high: estimate.high, reported: false, estimate },
            typical: typical.get(key),
            directions: directionsFor({ source: c.source, points: c.points, origin, destination, cabin, date: single, airlines: c.airlines, wallet, banks: q.banks }),
          });
        }
      }
    }
  }

  // Group by destination; order options and destinations by the chosen sort.
  const score = (x: Option) =>
    q.sort === "cash" ? x.cash.low * 1000 + x.points / 1000 : q.sort === "mine" ? (x.directions.covered ? 0 : 1e9) + x.points : x.points;
  const byDest = new Map<string, Option[]>();
  for (const x of options) byDest.set(x.destination, [...(byDest.get(x.destination) ?? []), x]);
  const destinations = [...byDest.entries()]
    .map(([destination, opts]) => ({
      destination,
      city: AIRPORT_CITY[destination] ?? airportByCode(destination)?.city ?? destination,
      options: opts.sort((a, b) => Number(b.kind === "seats") - Number(a.kind === "seats") || score(a) - score(b)),
    }))
    .sort((a, b) => Math.min(...a.options.map(score)) - Math.min(...b.options.map(score)));

  return { destinations, seatsSeen: seatRows.length, routesKnown: network.known.size };
}
