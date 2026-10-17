import "server-only";

import { chartPrices } from "@/features/awards/charts";
import { AIRPORT_CITY, REGIONS, type RegionKey, SOURCE_PROGRAM } from "@/features/awards/regions";
import { BANKS } from "@/features/awards/transfers";
import { TYPICAL_CENTS, VALUES_CHECKED } from "@/features/awards/values";

/**
 * "What do my points cover?" without an account: bank points (Chase, Amex, Capital One, Citi, Bilt)
 * → round-trip economy flights for the group, priced on airlines' published award charts and reached
 * by moving points to a partner program. Answers "if a seat is open, could we pay with points?":
 * no availability, no taxes (shown as extra), no logins.
 */
export type Balances = Partial<Record<string, number>>;

export type CoverOption = {
  destination: string;
  city: string;
  region: RegionKey;
  /** Partner program the points move to */
  program: string;
  /** Points per person, round trip */
  perPerson: number;
  /** Points for everyone, round trip */
  total: number;
  /** Which bank points to move, and how many of each (after the transfer ratio) */
  from: { bank: string; points: number }[];
  covered: boolean;
  /** Points still needed when not covered */
  shortBy: number;
  note?: string;
};

/** How many partner miles each bank can produce for a program, at its transfer ratio. */
function reach(balances: Balances, source: string) {
  return BANKS.filter((b) => b.partners[source] && (balances[b.key] ?? 0) > 0).map((b) => {
    const [from, to] = b.partners[source];
    const pts = balances[b.key] ?? 0;
    return { bank: b.short, ratio: [from, to] as const, pts, miles: Math.floor((pts * to) / from) };
  });
}

/** Spend the fewest bank points: fill from the best ratio first. */
function plan(balances: Balances, source: string, miles: number) {
  const banks = reach(balances, source).sort((a, b) => b.ratio[1] / b.ratio[0] - a.ratio[1] / a.ratio[0]);
  const from: { bank: string; points: number }[] = [];
  let left = miles;
  for (const b of banks) {
    if (left <= 0) break;
    const useMiles = Math.min(left, b.miles);
    // Banks transfer in round steps; round up to the next 1,000 bank points.
    const bankPts = Math.min(b.pts, Math.ceil(((useMiles * b.ratio[0]) / b.ratio[1]) / 1000) * 1000);
    if (bankPts <= 0) continue;
    from.push({ bank: b.bank, points: bankPts });
    left -= Math.floor((bankPts * b.ratio[1]) / b.ratio[0]);
  }
  return { from, shortBy: Math.max(0, left) };
}

export function whatPointsCover(home: string, balances: Balances, travelers: number): CoverOption[] {
  const out: CoverOption[] = [];
  for (const [region, info] of Object.entries(REGIONS) as [RegionKey, (typeof REGIONS)[RegionKey]][]) {
    for (const dest of info.airports) {
      if (dest === home) continue;
      // Cheapest published price from a program at least one of the banks can reach.
      const prices = chartPrices(home, dest, "economy").filter((p) => BANKS.some((b) => b.partners[p.source]));
      let best: CoverOption | null = null;
      for (const p of prices) {
        const perPerson = p.points * 2;
        const total = perPerson * travelers;
        const { from, shortBy } = plan(balances, p.source, total);
        const option: CoverOption = {
          destination: dest,
          city: AIRPORT_CITY[dest] ?? dest,
          region,
          program: SOURCE_PROGRAM[p.source]?.name ?? p.program,
          perPerson,
          total,
          from,
          covered: shortBy === 0,
          shortBy,
          note: p.note,
        };
        if (!best || (option.covered && !best.covered) || (option.covered === best.covered && (option.covered ? option.total < best.total : option.shortBy < best.shortBy))) best = option;
      }
      if (best) out.push(best);
    }
  }
  return out.sort((a, b) => Number(b.covered) - Number(a.covered) || (a.covered ? b.total - a.total : a.shortBy - b.shortBy));
}

/** Banks the calculator asks about, in the order shown. */
export const BANK_FIELDS = BANKS.map((b) => ({ key: b.key, name: b.name, short: b.short }));

/**
 * What the points are worth in cash terms: the bank's travel site (1¢ a point) and, moved to airline
 * partners and used well, the middle of what those partners are typically worth (TPG, VALUES_CHECKED).
 */
export function pointsValue(balances: Balances) {
  let portal = 0;
  let partner = 0;
  for (const b of BANKS) {
    const pts = balances[b.key] ?? 0;
    if (pts <= 0) continue;
    const cents = Object.keys(b.partners)
      .map((k) => TYPICAL_CENTS[k])
      .filter((c): c is number => typeof c === "number")
      .sort((x, y) => x - y);
    const median = cents.length ? cents[Math.floor(cents.length / 2)] : 1;
    portal += pts * 0.01;
    partner += (pts * Math.max(1, median)) / 100;
  }
  return { portal: Math.round(portal), partner: Math.round(partner), checked: VALUES_CHECKED };
}

/** A short list to show: the biggest trips the points cover (varied by region), then the closest misses. */
export function pickHighlights(options: CoverOption[], max = 6) {
  const covered: CoverOption[] = [];
  const perRegion = new Map<string, number>();
  for (const o of options.filter((x) => x.covered)) {
    if ((perRegion.get(o.region) ?? 0) >= 2) continue;
    perRegion.set(o.region, (perRegion.get(o.region) ?? 0) + 1);
    covered.push(o);
    if (covered.length >= max) break;
  }
  const almost = options
    .filter((x) => !x.covered)
    .sort((a, b) => a.shortBy - b.shortBy)
    .filter((o, i, all) => all.findIndex((x) => x.region === o.region) === i)
    .slice(0, 3);
  return { covered, almost };
}
