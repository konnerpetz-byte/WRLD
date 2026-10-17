import "server-only";

import { cacheLife } from "next/cache";

import { GAS_PRICE, GAS_PRICE_AS_OF } from "./drive";

/**
 * Fresh gas prices for road trips, from the U.S. Energy Information Administration (EIA): the
 * government's weekly survey of regular gasoline at the pump, published every Monday, for the
 * U.S., seven regions and nine large states. It's free and official (an API key from
 * eia.gov/opendata, set as EIA_API_KEY), so no scraping of AAA or GasBuddy, whose terms don't allow it.
 * Without a key, or if EIA can't be reached, the AAA national average in drive.ts is used.
 */
export type GasPrices = {
  /** "SOH", "R20", "NUS"… → $ a gallon */
  byArea: Record<string, number>;
  /** Week the prices are for, "2026-10-12" */
  week: string | null;
  source: "eia" | "fallback";
};

/** EIA's regions (PADD sub-districts) by state. */
const REGION: Record<string, string> = {};
const put = (area: string, states: string) => states.split(" ").forEach((s) => (REGION[s] = area));
put("R1X", "CT ME MA NH RI VT"); // New England
put("R1Y", "DE DC MD NJ NY PA"); // Central Atlantic
put("R1Z", "FL GA NC SC VA WV"); // Lower Atlantic
put("R20", "IL IN IA KS KY MI MN MO NE ND SD OH OK TN WI"); // Midwest
put("R30", "AL AR LA MS NM TX"); // Gulf Coast
put("R40", "CO ID MT UT WY"); // Rocky Mountain
put("R50", "AK AZ CA HI NV OR WA"); // West Coast
/** States EIA prices on their own. */
const STATE_AREAS = new Set(["CA", "CO", "FL", "MA", "MN", "NY", "OH", "TX", "WA"]);

export const REGION_NAME: Record<string, string> = {
  R1X: "New England",
  R1Y: "Central Atlantic",
  R1Z: "Lower Atlantic",
  R20: "Midwest",
  R30: "Gulf Coast",
  R40: "Rocky Mountain",
  R50: "West Coast",
  NUS: "U.S.",
};

export async function loadGasPrices(): Promise<GasPrices> {
  "use cache";
  cacheLife("hours");
  const key = process.env.EIA_API_KEY;
  const fallback: GasPrices = { byArea: { NUS: GAS_PRICE }, week: null, source: "fallback" };
  if (!key) return fallback;
  try {
    const u = new URL("https://api.eia.gov/v2/petroleum/pri/gnd/data/");
    u.searchParams.set("api_key", key);
    u.searchParams.set("frequency", "weekly");
    u.searchParams.append("data[0]", "value");
    u.searchParams.append("facets[product][]", "EPMR"); // regular gasoline, all formulations
    u.searchParams.set("sort[0][column]", "period");
    u.searchParams.set("sort[0][direction]", "desc");
    u.searchParams.set("length", "400");
    const res = await fetch(u, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return fallback;
    const json = (await res.json()) as { response?: { data?: { period?: string; duoarea?: string; value?: string | number }[] } };
    const rows = json.response?.data ?? [];
    const byArea: Record<string, number> = {};
    let week: string | null = null;
    for (const r of rows) {
      const v = Number(r.value);
      if (!r.duoarea || !r.period || !(v > 1 && v < 10)) continue;
      week ??= r.period;
      if (byArea[r.duoarea] == null) byArea[r.duoarea] = Math.round(v * 1000) / 1000; // newest first
    }
    if (byArea.NUS == null) return fallback;
    return { byArea, week, source: "eia" };
  } catch {
    return fallback;
  }
}

/** The price for a state: its own EIA price, else its region's, else the U.S. average. */
export function gasPriceFor(prices: GasPrices, state: string | null | undefined) {
  const s = state?.toUpperCase();
  if (s && STATE_AREAS.has(s) && prices.byArea[`S${s}`] != null) return prices.byArea[`S${s}`];
  const region = s ? REGION[s] : undefined;
  if (region && prices.byArea[region] != null) return prices.byArea[region];
  return prices.byArea.NUS ?? GAS_PRICE;
}

/** Where a price comes from, for the fine print. */
export function gasSourceNote(prices: GasPrices) {
  if (prices.source === "eia" && prices.week) {
    const d = new Date(`${prices.week}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
    return `Gas prices are this week's averages for regular from the U.S. Energy Information Administration (week of ${d}), for the state or region you start in and the one you drive to.`;
  }
  return `Gas is priced at $${GAS_PRICE.toFixed(2)} a gallon, the AAA national average on ${GAS_PRICE_AS_OF}.`;
}
