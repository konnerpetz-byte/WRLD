/**
 * Live award search on the airline's own site, and reading a search back.
 *
 * WRLD never queries airlines itself. It opens the program's real award search,
 * already filled in, in the traveler's own browser (they sign in to their own
 * account), and the traveler can send what they see back to WRLD in one click.
 *
 * Prefilled search links checked on 2026-10-13 (each opened the right route
 * and date): United, Air Canada Aeroplan, American. Other programs open their
 * site to search there.
 */
import { type Cabin, SOURCE_PROGRAM } from "./regions";

export type Trip = { origin: string; destination: string; date: string; cabin: Cabin };

const AA_CABIN: Record<Cabin, string> = { economy: "COACH", premium: "PREMIUM_ECONOMY", business: "BUSINESS_FIRST", first: "FIRST" };

/** A link that opens the program's live award search for this trip, or null. */
export function liveSearchUrl(source: string, t: Trip): { url: string; prefilled: boolean } | null {
  switch (source) {
    case "united": {
      const u = new URL("https://www.united.com/en/us/fsr/choose-flights");
      u.search = new URLSearchParams({ f: t.origin, t: t.destination, d: t.date, tt: "1", at: "1", sc: "7", px: "1", taxng: "1", newHP: "True", clm: "7", st: "bestmatches", tqp: "A" }).toString();
      return { url: u.toString(), prefilled: true };
    }
    case "aeroplan": {
      const u = new URL("https://www.aircanada.com/aeroplan/redeem/availability/outbound");
      u.search = new URLSearchParams({ org0: t.origin, dest0: t.destination, departureDate0: t.date, lang: "en-CA", tripType: "O", ADT: "1", YTH: "0", CHD: "0", INF: "0", INS: "0", marketCode: "INT" }).toString();
      return { url: u.toString(), prefilled: true };
    }
    case "american": {
      const u = new URL("https://www.aa.com/booking/search");
      u.search = new URLSearchParams({
        locale: "en_US",
        pax: "1",
        adult: "1",
        type: "OneWay",
        searchType: "Award",
        cabin: AA_CABIN[t.cabin],
        carriers: "ALL",
        travelType: "personal",
        slices: JSON.stringify([{ orig: t.origin, origNearby: false, dest: t.destination, destNearby: false, date: t.date }]),
      }).toString();
      return { url: u.toString(), prefilled: true };
    }
    default:
      return SOURCE_PROGRAM[source]?.url ? { url: SOURCE_PROGRAM[source].url, prefilled: false } : null;
  }
}

// ---------------------------------------------------------------- Reading a page back
const HOSTS: [RegExp, string][] = [
  [/(^|\.)united\.com$/, "united"],
  [/(^|\.)aircanada\.com$/, "aeroplan"],
  [/(^|\.)aa\.com$/, "american"],
  [/(^|\.)delta\.com$/, "delta"],
  [/(^|\.)alaskaair\.com$/, "alaska"],
  [/(^|\.)virginatlantic\.com$/, "virginatlantic"],
  [/(^|\.)(airfrance\.[a-z.]+|klm\.[a-z.]+|flyingblue\.com)$/, "flyingblue"],
  [/(^|\.)britishairways\.com$/, "british"],
  [/(^|\.)jetblue\.com$/, "jetblue"],
  [/(^|\.)lifemiles\.com$/, "lifemiles"],
  [/(^|\.)turkishairlines\.com$/, "turkish"],
  [/(^|\.)singaporeair\.com$/, "singapore"],
  [/(^|\.)emirates\.com$/, "emirates"],
  [/(^|\.)qatarairways\.com$/, "qatar"],
  [/(^|\.)etihad\.com$/, "etihad"],
  [/(^|\.)iberia\.com$/, "iberia"],
  [/(^|\.)aerlingus\.com$/, "aerlingus"],
  [/(^|\.)cathaypacific\.com$/, "cathay"],
  [/(^|\.)qantas\.com$/, "qantas"],
  [/(^|\.)flytap\.com$/, "tap"],
  [/(^|\.)finnair\.com$/, "finnair"],
  [/(^|\.)evaair\.com$/, "eva"],
  [/(^|\.)jal\.co\.jp$/, "jal"],
  [/(^|\.)ana\.co\.jp$/, "ana"],
  [/(^|\.)southwest\.com$/, "southwest"],
  [/(^|\.)aeromexico\.com$/, "aeromexico"],
];

const IATA = /^[A-Z]{3}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** What an airline search page's address says about the search: program, route, date, cabin. */
export function readAirlineUrl(raw: string): { program: string | null; origin?: string; destination?: string; date?: string; cabin?: Cabin } {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { program: null };
  }
  if (u.protocol !== "https:") return { program: null };
  const program = HOSTS.find(([re]) => re.test(u.hostname))?.[1] ?? null;
  const p = u.searchParams;
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = p.get(k);
      if (v) return v;
    }
    return undefined;
  };
  const out: { program: string | null; origin?: string; destination?: string; date?: string; cabin?: Cabin } = { program };
  const origin = pick("f", "org0", "origin", "from", "O", "orig", "departureAirport")?.toUpperCase();
  const destination = pick("t", "dest0", "destination", "to", "D", "dest", "arrivalAirport")?.toUpperCase();
  const date = pick("d", "departureDate0", "date", "departing", "depart", "OD", "departureDate");
  if (origin && IATA.test(origin)) out.origin = origin;
  if (destination && IATA.test(destination)) out.destination = destination;
  if (date && DATE.test(date.slice(0, 10))) out.date = date.slice(0, 10);
  const slices = p.get("slices");
  if (slices) {
    try {
      const s = JSON.parse(slices)?.[0];
      if (s && IATA.test(String(s.orig))) out.origin = String(s.orig);
      if (s && IATA.test(String(s.dest))) out.destination = String(s.dest);
      if (s && DATE.test(String(s.date))) out.date = String(s.date);
    } catch {
      // Not JSON.
    }
  }
  const cabin = p.get("cabin");
  const fromAa = Object.entries(AA_CABIN).find(([, v]) => v === cabin)?.[0] as Cabin | undefined;
  if (fromAa) out.cabin = fromAa;
  return out;
}
