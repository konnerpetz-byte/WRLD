import "server-only";

import { airportByCode } from "@/features/places/airports";
import type { requireUserId } from "@/lib/supabase/server";

import { type ChartPrice, routeAwareChartPrices } from "./charts";
import { estimateFees, type FeeEstimate, type Fx } from "./fees";
import { loadNetwork } from "./network";
import { liveSeats } from "./seats-aero";
import { CARRIER_OF, type CashFare, cashFares, PORTAL_CENTS, PORTALS, PREDICTED_PROGRAMS, REVENUE_PROGRAMS } from "./cash-fares";
import { AIRPORT_CITY, CABINS, type Cabin, REGIONS, type RegionKey, SOURCE_PROGRAM } from "./regions";
import { programFor } from "./search";
import { BANKS, bankPointsFor, ratioLabel } from "./transfers";
import { type Typical, typicalPrices } from "./typical";

type Supabase = Awaited<ReturnType<typeof requireUserId>>["supabase"];

// ---------------------------------------------------------------- Query
export type Sort = "value" | "points" | "cash" | "mine";

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

/**
 * Months to plan in, worked out on every visit so the list rolls forward on its own: from this
 * month through December of next year once we're in the second half of the year (October 2026 →
 * December 2027), and never less than a year ahead.
 */
export function monthOptions(now = new Date()) {
  const m = now.getUTCMonth();
  const toDecember = (m >= 6 ? 24 : 12) - m;
  return Array.from({ length: Math.max(13, toDecember) }, (_, i) => {
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
  const sort: Sort = sp.sort === "cash" || sp.sort === "mine" || sp.sort === "points" ? sp.sort : "value";
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
export type SeatDay = {
  date: string;
  miles: number;
  taxes: number | null;
  taxCurrency: string | null;
  seenAt: string;
  id: number;
  reported: boolean;
  /** Live award data: from a linked Seats.aero account, or looked up in a traveler's browser */
  live?: boolean;
  via?: "seats.aero";
};

export type Option = {
  key: string;
  origin: string;
  destination: string;
  cabin: Cabin;
  source: string;
  program: string;
  points: number;
  /** "seats": real seats (traveler reports or licensed data); "chart": published price when a seat opens */
  /**
   * seats: real award seats; chart: published price; portal: card points for today's cash fare;
   * revenue: Southwest/JetBlue points from the fare; predicted: dynamic-priced programs
   * (Delta, United, American, Alaska) predicted from the fare by WRLD's model
   */
  kind: "seats" | "chart" | "portal" | "revenue" | "predicted";
  /**
   * What the option really costs you, in dollars: the points at 1 cent each
   * (what any card travel site pays for them) plus the cash on top. The one
   * number that compares a 7,500-point award, a 61,200-point portal booking
   * and a $189 fare fairly.
   */
  trueCost?: number;
  /** Against the cash fare for the same flight day (or the lowest in the window): cents each point is worth here. */
  value?: { fare: number; cents: number; sameDay: boolean };
  /** For revenue and predicted options: cents per point used, and whether WRLD's own data set it */
  model?: { low: number; high: number; learned: number | null };
  /** For portal and revenue options: the cash fares behind them */
  fares?: CashFare[];
  /** Revenue programs price within a range */
  pointsHigh?: number;
  days: SeatDay[];
  chart?: ChartPrice;
  /** Cash on top of the points, in USD */
  cash: { low: number; high: number; reported: boolean; estimate: FeeEstimate };
  typical?: Typical;
  directions: Directions;
};

export type DestinationResult = {
  destination: string;
  city: string;
  options: Option[];
  /** Lowest economy cash fare seen for this destination in the window (USD), when WRLD has fares */
  fare: number | null;
};

export type ExplorerResult = {
  destinations: DestinationResult[];
  seatsSeen: number;
  routesKnown: number;
  /** Live search through the traveler's linked Seats.aero account */
  live: { connected: boolean; seats: number; error?: string };
  /** Every destination searched (Anywhere includes the route network) */
  searched: string[];
};

export async function runExplorer(
  supabase: Supabase,
  userId: string,
  q: ExplorerQuery,
  wallet: Wallet,
  fx: Fx,
  liveToken: string | null = null,
): Promise<ExplorerResult> {
  if (!q.origins.length || !q.destinations.length) return { destinations: [], seatsSeen: 0, routesKnown: 0, live: { connected: Boolean(liveToken), seats: 0 }, searched: [] };
  const allowed = allowedPrograms(q, wallet);
  const ok = (source: string) => !allowed || allowed.has(source);

  // Log the search (the demand signal for which routes to watch).
  void supabase
    .from("award_searches")
    .insert({ user_id: userId, origin: q.origins[0], destinations: q.destinations.slice(0, 60), cabin: q.cabins[0], month: `${q.start.slice(0, 7)}-01`, via: null })
    .then(() => undefined, () => undefined);

  const fresh = new Date(Date.now() - 3 * 86400000).toISOString();
  const network = await loadNetwork(supabase, q.origins, q.destinations);
  // "Anywhere" really means anywhere: add every airport the origins fly to nonstop (WRLD's route network).
  if (q.regions.includes("anywhere")) {
    const nonstop = network.edges.filter((e) => q.origins.includes(e.origin)).map((e) => e.destination);
    const inbound = network.edges.filter((e) => q.origins.includes(e.destination)).map((e) => e.origin);
    q = { ...q, destinations: [...new Set([...q.destinations, ...nonstop, ...inbound])].filter((d) => !q.origins.includes(d) && airportByCode(d)).slice(0, 400) };
  }
  const liveSources = allowed ? [...allowed] : null;
  const wantsEconomy = q.cabins.includes("economy");
  const [typical, seatRows, live, fares, learned] = await Promise.all([
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
      return (data ?? []).filter((r) => (r.data_source !== "browser" && (r.data_source !== "community" || r.seen_at >= fresh)) && (!q.months.length || q.months.includes(r.travel_date.slice(0, 7))));
    })(),
    liveToken
      ? liveSeats(liveToken, { origins: q.origins, destinations: q.destinations, start: q.start, end: q.end, cabins: q.cabins, sources: liveSources, directOnly: q.directOnly })
      : Promise.resolve(null),
    wantsEconomy ? cashFares({ origins: q.origins, months: q.months, start: q.start, end: q.end, directOnly: q.directOnly }) : Promise.resolve([] as CashFare[]),
    wantsEconomy
      ? Promise.resolve(supabase.rpc("award_fare_rates")).then(
          ({ data }) => new Map((data ?? []).map((r) => [r.program, { low: Number(r.low), high: Number(r.high), n: r.n }])),
          () => new Map<string, { low: number; high: number; n: number }>(),
        )
      : Promise.resolve(new Map<string, { low: number; high: number; n: number }>()),
  ]);

  // Teach the model: award prices travelers saved, matched with the cash fare for the same flight day.
  {
    const obs = seatRows
      .filter((r) => r.data_source === "community" && r.cabin === "economy" && CARRIER_OF[r.program])
      .flatMap((r) => {
        const f = fares
          .filter((x) => x.origin === r.origin && x.destination === r.destination && x.date === r.travel_date && x.airline === CARRIER_OF[r.program])
          .sort((a, b) => a.price - b.price)[0];
        return f ? [{ program: r.program, origin: r.origin, destination: r.destination, travel_date: r.travel_date, miles: r.miles, fare_usd: f.price }] : [];
      })
      .slice(0, 200);
    if (obs.length) void Promise.resolve(supabase.rpc("award_fare_observe", { p_rows: obs })).then(() => undefined, () => undefined);
  }
  const inMonths = (date: string) => !q.months.length || q.months.includes(date.slice(0, 7));
  // Live seats join the same groups as traveler reports (same route, cabin and program).
  type Row = (typeof seatRows)[number];
  const liveRows: Row[] = (live?.seats ?? [])
    .filter((x) => inMonths(x.date))
    .map((x) => ({
      id: 0,
      origin: x.origin,
      destination: x.destination,
      travel_date: x.date,
      program: x.source,
      cabin: x.cabin,
      miles: x.miles,
      airlines: x.airlines,
      direct: x.direct,
      data_source: "live",
      seen_at: x.updatedAt ?? new Date().toISOString(),
      taxes: x.taxes,
      tax_currency: x.taxCurrency,
    }));
  seatRows.push(...liveRows);

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
      .map((r) => ({
        date: r.travel_date,
        miles: r.miles,
        taxes: r.taxes === null ? null : Number(r.taxes),
        taxCurrency: r.tax_currency,
        seenAt: r.seen_at,
        id: r.id,
        reported: r.data_source === "community",
        live: r.data_source === "live",
        via: r.data_source === "live" ? ("seats.aero" as const) : undefined,
      }))
      .sort((a, b) => a.miles - b.miles || a.date.localeCompare(b.date))
      // One price per day: the cheapest.
      .filter((d, i, all) => all.findIndex((x) => x.date === d.date) === i);
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
          const key = `${origin}|${destination}|${cabin}|${c.id}`;
          if (options.some((x) => x.key === key || x.key === `${origin}|${destination}|${cabin}|${c.source}`)) continue; // real seats already shown for this program
          const via = c.via ? airportByCode(c.via) : null;
          const estimate = estimateFees({ origin: o, destination: d, via, cabin, source: c.source, airlines: c.airlines ?? [], fx });
          options.push({
            key,
            origin,
            destination,
            cabin,
            source: c.source,
            program: c.label ? `${c.program} ${c.label}` : c.program,
            points: c.points,
            pointsHigh: c.pointsHigh,
            kind: "chart",
            days: [],
            chart: c,
            cash: { low: estimate.low, high: estimate.high, reported: false, estimate },
            typical: typical.get(key),
            // Ranges: plan for the top, so the points are there whatever the day's price.
            directions: directionsFor({ source: c.source, points: c.pointsHigh ?? c.points, origin, destination, cabin, date: single, airlines: c.airlines, wallet, banks: q.banks }),
          });
        }
      }
    }
  }

  // Today's cash fares, paid with points: card travel portals and Southwest/JetBlue.
  {
    const destSet = new Set(q.destinations);
    const anywhere = q.regions.includes("anywhere");
    const inWindow = fares.filter((f) => inMonths(f.date) && (anywhere || destSet.has(f.destination)) && !q.origins.includes(f.destination));
    const portalBanks = PORTALS.filter((p) => (q.banks.length ? q.banks.includes(p.bank) : true));
    const heldBanks = BANKS.filter((b) => (wallet.balances.get(b.slug) ?? 0) > 0).map((b) => b.key);
    const portalOk =
      portalBanks.length > 0 &&
      (!allowed || q.banks.length > 0 || (q.mine && PORTALS.some((p) => heldBanks.includes(p.bank)))) &&
      !(q.programs.length && !q.banks.length && !q.mine);
    const byRoute = new Map<string, CashFare[]>();
    for (const f of inWindow) byRoute.set(`${f.origin}|${f.destination}`, [...(byRoute.get(`${f.origin}|${f.destination}`) ?? []), f]);
    for (const [route, list] of byRoute) {
      const [origin, destination] = route.split("|");
      if (!airportByCode(destination)) continue;
      // Cheapest fare per day.
      const perDay = [...new Map([...list].sort((a, b) => b.price - a.price).map((f) => [f.date, f])).values()].sort((a, b) => a.price - b.price);
      const best = perDay[0];
      const noFees = { low: 0, high: 0, lines: [{ label: "Taxes and fees", low: 0, high: 0, note: "Included in the points price" }], surcharge: { level: "none" as const, text: "Taxes are included in the points price." }, plusSurcharges: false };
      const days = perDay.map((f) => ({ date: f.date, miles: Math.round((f.price * 100) / PORTAL_CENTS), taxes: null, taxCurrency: null, seenAt: new Date().toISOString(), id: 0, reported: false }));
      if (portalOk) {
        const points = Math.round((best.price * 100) / PORTAL_CENTS);
        const usable = portalBanks.filter((p) => !q.mine || heldBanks.includes(p.bank));
        const held = usable.find((p) => (wallet.balances.get(BANKS.find((b) => b.key === p.bank)!.slug) ?? 0) >= points);
        const when = new Date(`${best.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
        const flight = `${airlineName(best.airline)}${best.stops ? `, ${best.stops} stop${best.stops === 1 ? "" : "s"}` : ", nonstop"}`;
        options.push({
          key: `${route}|economy|portal`,
          origin,
          destination,
          cabin: "economy",
          source: "portal",
          program: "Card points, any seat",
          points,
          kind: "portal",
          days,
          fares: perDay,
          cash: { low: 0, high: 0, reported: false, estimate: noFees },
          directions: {
            steps: [
              held
                ? `Search ${held.name} (${held.site}) for ${origin} to ${destination} on ${when} and pay with ${points.toLocaleString("en-US")} of your points.`
                : `Search a card travel site (${usable.map((p) => p.name).join(", ")}) for ${origin} to ${destination} on ${when}; pay with about ${points.toLocaleString("en-US")} points.`,
              `Lowest fare seen: $${best.price.toFixed(0)} on ${flight}, found by travelers in the last 48 hours. The price can change.`,
            ],
            covered: Boolean(held),
            shortBy: null,
          },
        });
      }
      // Programs that price from the fare, on their own flights: Southwest and JetBlue
      // (fixed rate) and Delta, United, American and Alaska (WRLD's prediction).
      const o = airportByCode(origin);
      const d = airportByCode(destination);
      const domestic = o?.country === "US" && d?.country === "US";
      for (const [code, base] of Object.entries({ ...REVENUE_PROGRAMS, ...PREDICTED_PROGRAMS })) {
        if (!ok(base.source)) continue;
        const theirs = [...new Map(list.filter((f) => f.airline === code).sort((a, b) => b.price - a.price).map((f) => [f.date, f])).values()].sort(
          (a, b) => a.price - b.price,
        );
        if (!theirs.length) continue;
        const predicted = code in PREDICTED_PROGRAMS;
        const seen = learned.get(base.source);
        // Not enough evidence that the fare predicts this program yet: show nothing rather than a guess.
        if ("needsData" in base && base.needsData && !seen) continue;
        const rate = seen ? { low: seen.low, high: seen.high } : base;
        // What the points pay for: the fare minus U.S. taxes (7.5% ticket tax, $5.60 security fee) at home, or minus typical international taxes.
        const pointsPart = (price: number) => (domestic ? Math.max(0, (price - 5.6) / 1.075) : Math.max(0, price * 0.8));
        const pts = (price: number, cents: number) => Math.max(500, Math.round(pointsPart(price) / (cents / 100) / 100) * 100);
        const f = theirs[0];
        const low = pts(f.price, rate.high);
        const high = pts(f.price, rate.low);
        const fees =
          domestic || !o || !d
            ? { low: 6, high: 6, lines: [{ label: "U.S. September 11th Security Fee", low: 6, high: 6 }], surcharge: { level: "none" as const, text: `${programFor(base.source).name} doesn't add fuel surcharges on its own flights.` }, plusSurcharges: false }
            : estimateFees({ origin: o, destination: d, cabin: "economy", source: base.source, airlines: [airlineName(code)], fx });
        const key = `${route}|economy|${base.source}`;
        if (options.some((x) => x.key === key && x.kind === "seats")) continue; // real seats already shown
        const steps = directionsFor({ source: base.source, points: high, origin, destination, cabin: "economy", date: f.date, airlines: [airlineName(code)], wallet, banks: q.banks });
        options.push({
          key: `${key}|fare`,
          origin,
          destination,
          cabin: "economy",
          source: base.source,
          program: programFor(base.source).name,
          points: low,
          pointsHigh: high,
          kind: predicted ? "predicted" : "revenue",
          model: { low: rate.low, high: rate.high, learned: seen?.n ?? null },
          days: theirs.map((x) => ({ date: x.date, miles: pts(x.price, rate.high), taxes: null, taxCurrency: null, seenAt: new Date().toISOString(), id: 0, reported: false })),
          fares: theirs,
          cash: { low: fees.low, high: fees.high, reported: false, estimate: fees },
          directions: predicted
            ? {
                ...steps,
                steps: [
                  ...steps.steps,
                  `${programFor(base.source).name} sets award prices close to the cash fare ($${f.price.toFixed(0)} today), so expect about ${low.toLocaleString("en-US")} to ${high.toLocaleString("en-US")} miles. ${seen ? `Based on ${seen.n} prices WRLD travelers saved.` : "WRLD's starting estimate; it sharpens as travelers save real prices."}`,
                ],
              }
            : steps,
        });
      }
    }
  }

  // Points or cash: price every option in dollars, and compare awards with the fare for the same day.
  const fareRoute = priceAgainstFares(options, fares.filter((f) => inMonths(f.date)), single);

  // Group by destination; order options and destinations by the chosen sort.
  const score = (x: Option) =>
    q.sort === "cash"
      ? x.cash.low * 1000 + x.points / 1000
      : q.sort === "mine"
        ? (x.directions.covered ? 0 : 1e9) + x.points
        : q.sort === "points"
          ? x.points
          : (x.trueCost ?? x.points / 100);
  const byDest = new Map<string, Option[]>();
  for (const x of options) byDest.set(x.destination, [...(byDest.get(x.destination) ?? []), x]);
  const destinations = [...byDest.entries()]
    .map(([destination, opts]) => ({
      destination,
      city: AIRPORT_CITY[destination] ?? airportByCode(destination)?.city ?? destination,
      options: opts.sort((a, b) => (q.sort === "value" ? 0 : Number(b.kind === "seats") - Number(a.kind === "seats")) || score(a) - score(b) || Number(b.kind === "seats") - Number(a.kind === "seats")),
      fare: (() => {
        const list = q.origins.map((o) => fareRoute.get(`${o}|${destination}`)).filter((n): n is number => n != null);
        return list.length ? Math.min(...list) : null;
      })(),
    }))
    .sort((a, b) => Math.min(...a.options.map(score)) - Math.min(...b.options.map(score)));

  return {
    destinations,
    seatsSeen: seatRows.length,
    routesKnown: network.known.size,
    live: { connected: Boolean(liveToken), seats: liveRows.length, error: live?.error },
    searched: q.destinations,
  };
}

/**
 * Sets each option's true cost (points at 1 cent plus cash on top) and, for
 * economy awards, what each point is worth against the cash fare for the same
 * day (or the lowest fare in the window). Returns the lowest fare per route.
 */
export function priceAgainstFares(options: Option[], fares: CashFare[], single: string | null): Map<string, number> {
  const fareDay = new Map<string, number>();
  const fareRoute = new Map<string, number>();
  for (const f of fares) {
    const day = `${f.origin}|${f.destination}|${f.date}`;
    const route = `${f.origin}|${f.destination}`;
    if (!(fareDay.get(day)! <= f.price)) fareDay.set(day, f.price);
    if (!(fareRoute.get(route)! <= f.price)) fareRoute.set(route, f.price);
  }
  for (const x of options) {
    // Ranges count at the top, so a "deal" never depends on the luckiest day.
    const pts = x.pointsHigh ?? x.points;
    x.trueCost = Math.round(pts / 100 + x.cash.low);
    if (x.cabin !== "economy" || x.kind === "portal") continue;
    const bestDay = x.days.length ? x.days.reduce((a, b) => (b.miles < a.miles ? b : a)).date : single;
    const same = bestDay ? fareDay.get(`${x.origin}|${x.destination}|${bestDay}`) : undefined;
    const fare = same ?? fareRoute.get(`${x.origin}|${x.destination}`);
    if (!fare) continue;
    x.value = { fare, cents: Math.round(((fare - x.cash.low) / pts) * 1000) / 10, sameDay: same != null };
  }
  return fareRoute;
}

const AIRLINES: Record<string, string> = {
  AA: "American", DL: "Delta", UA: "United", WN: "Southwest", B6: "JetBlue", AS: "Alaska", NK: "Spirit", F9: "Frontier",
  G4: "Allegiant", HA: "Hawaiian", SY: "Sun Country", MX: "Breeze", AC: "Air Canada", WS: "WestJet", AM: "Aeroméxico",
  Y4: "Volaris", BA: "British Airways", LH: "Lufthansa", AF: "Air France", KL: "KLM", VS: "Virgin Atlantic", EI: "Aer Lingus",
  IB: "Iberia", TP: "TAP Air Portugal", TK: "Turkish Airlines", EK: "Emirates", QR: "Qatar Airways", LX: "SWISS", OS: "Austrian",
  SK: "SAS", AY: "Finnair", FI: "Icelandair", JL: "Japan Airlines", NH: "ANA", KE: "Korean Air", CX: "Cathay Pacific", CM: "Copa",
  AV: "Avianca", LA: "LATAM", PD: "Porter", WY: "Oman Air", EY: "Etihad", SQ: "Singapore Airlines",
};
function airlineName(code: string) {
  return AIRLINES[code] ?? code;
}
