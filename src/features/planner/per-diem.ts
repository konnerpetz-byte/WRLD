import "server-only";

import { AIRPORT_CITY } from "@/features/awards/regions";
import { airportByCode } from "@/features/places/airports";
import type { requireUserId } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof requireUserId>>["supabase"];

/**
 * Real-world cost data for the planner: U.S. government per diem rates
 * (State Department for other countries, GSA for U.S. cities), refreshed by
 * the costs-refresh worker into public.cost_per_diem.
 *
 * Per diem is what the government reimburses a business traveler: a capped
 * hotel rate and meals & incidentals. A leisure traveler usually spends less,
 * so WRLD scales both by factors in public.cost_calibration, which start at
 * WRLD's assumption and are re-measured from the costs travelers log on trips.
 */
export type PerDiem = { lodging: number; mie: number; location: string; basis: "city" | "country"; source: "state" | "gsa" };
export type Factors = { lodging: number; day: number; lodgingSamples: number; daySamples: number };

const DEFAULT_FACTORS: Factors = { lodging: 0.55, day: 0.6, lodgingSamples: 0, daySamples: 0 };

/** Country names as the State Department writes them, where they differ from the usual English name. */
const COUNTRY_ALIASES: Record<string, string> = {
  TR: "TURKEY",
  KR: "Korea, South",
  KP: "DEM. PEOPLE'S REPUBLIC OF KOREA",
  HK: "HONG KONG",
  MO: "MACAU",
  BS: "Bahamas, The",
  GM: "Gambia, The",
  MM: "BURMA",
  CI: "COTE D'IVOIRE",
  CV: "CABO VERDE",
  PF: "FRENCH POLYNESIA",
  VG: "VIRGIN ISLANDS, BRITISH",
  RU: "RUSSIA",
  LA: "LAOS",
  BN: "BRUNEI",
  SZ: "ESWATINI",
  FM: "Micronesia, Federated States of",
  CG: "REPUBLIC OF THE CONGO",
  CD: "DEMOCRATIC REPUBLIC OF THE CONGO",
  VA: "HOLY SEE",
  SX: "Sint Maarten",
  CW: "Curacao",
  BQ: "Bonaire, Sint Eustatius, and Saba",
  LC: "ST LUCIA",
  FK: "Falkland Islands (Islas Malvinas)",
  CZ: "Czechia",
  SK: "Slovakia",
  BA: "Bosnia and Herzegovina",
  TW: "TAIWAN",
  VN: "VIETNAM",
  IR: "IRAN",
  SY: "SYRIA",
  TZ: "TANZANIA",
  BO: "BOLIVIA",
  VE: "VENEZUELA",
  MD: "MOLDOVA",
  MK: "NORTH MACEDONIA",
};

/** City names as the State Department writes them, for airports whose listed city differs. */
const CITY_ALIASES: Record<string, string> = {
  firenze: "Florence",
  osaka: "Osaka-Kobe",
  tokyo: "Tokyo City",
  "mexico city": "Mexico City, D.F.",
  "san jose del cabo": "Los Cabos",
  "cabo san lucas": "Los Cabos",
  marrakesh: "Marrakech",
  taoyuan: "Taipei",
  "spata-artemida": "Athens",
  ferno: "Milan",
  papeete: "French Polynesia",
  "sao paulo": "Sao Paulo",
  porto: "Oporto",
  "new delhi": "New Delhi",
  kobe: "Osaka-Kobe",
};

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
export function countryName(iso2: string) {
  if (COUNTRY_ALIASES[iso2]) return COUNTRY_ALIASES[iso2];
  try {
    return regionNames.of(iso2) ?? iso2;
  } catch {
    return iso2;
  }
}

/** Ways a place's city might be written: the planner's name, the airport's city, and each part of "Ingliston, Edinburgh". */
function cityCandidates(city: string) {
  const base = city.replace(/\s*\(.*?\)\s*/g, " ").trim();
  const parts = [base, ...base.split(",").map((p) => p.trim())].filter(Boolean);
  const exact = new Set<string>();
  const loose = new Set<string>();
  for (const p of parts) {
    exact.add(fold(p));
    const alias = CITY_ALIASES[fold(p)];
    if (alias) exact.add(fold(alias));
    // "Tokyo Haneda" → "tokyo", tried only after every full name fails
    const first = fold(p.split(" ")[0]);
    if (first.length >= 5) loose.add(CITY_ALIASES[first] ? fold(CITY_ALIASES[first]) : first);
  }
  return { exact: [...exact].filter((c) => c.length >= 3), loose: [...loose] };
}

const matches = (location: string, candidates: string[]) => {
  const loc = fold(location);
  return candidates.some(
    (c) => loc === c || loc.startsWith(`${c} `) || loc.startsWith(`${c},`) || loc.startsWith(`${c}-`) || loc.startsWith(`${c} (`)
  );
};

export type Place = { key: string; city: string; country: string };

/** The place to price for an airport: the planner's city name and the airport's country. */
export function placeForAirport(code: string): Place | null {
  const a = airportByCode(code);
  if (!a) return null;
  return { key: code, city: `${AIRPORT_CITY[code] ?? ""}, ${a.city}`.replace(/^, /, ""), country: a.country };
}

/** Per diem for each place on a date: the city's own rate, else the country's "[Other]" rate. */
export async function loadPerDiem(
  supabase: Supabase,
  places: Place[],
  date: string
): Promise<{ rates: Map<string, PerDiem>; factors: Factors }> {
  const rates = new Map<string, PerDiem>();
  const query = (on: string) =>
    places.length
      ? (() => {
          const names = [
            ...new Set(
              places.flatMap((p) =>
                p.country === "US" ? ["United States"] : [countryName(p.country), countryName(p.country).toUpperCase()]
              )
            ),
          ];
          return supabase
            .from("cost_per_diem")
            .select("source, country, location, state, lodging, mie")
            .in("country", names)
            .lte("season_start", on)
            .gte("season_end", on)
            .limit(5000);
        })()
      : Promise.resolve({
          data: [] as { source: string; country: string; location: string; state: string | null; lodging: number; mie: number }[],
        });
  const [rowsRes, calRes] = await Promise.all([query(date), supabase.from("cost_calibration").select("kind, factor, samples")]);
  let rows = rowsRes.data ?? [];
  // Rates are published for the current year only. For a trip next year, use the same season a
  // year (or two) earlier: the government's rate for that time of year is the best guess we have.
  for (let back = 1; !rows.length && places.length && back <= 2; back++) {
    const earlier = `${Number(date.slice(0, 4)) - back}${date.slice(4).replace("-02-29", "-02-28")}`;
    rows = (await query(earlier)).data ?? [];
  }
  for (const p of places) {
    const name = p.country === "US" ? "united states" : fold(countryName(p.country));
    const inCountry = rows.filter((r) => fold(r.country) === name);
    if (!inCountry.length) continue;
    const cands = cityCandidates(p.city);
    const named = inCountry.filter((r) => r.location !== "[Other]");
    const city = named.find((r) => matches(r.location, cands.exact)) ?? named.find((r) => matches(r.location, cands.loose));
    const other = inCountry.find((r) => r.location === "[Other]");
    const hit = city ?? (p.country === "US" ? null : other) ?? (inCountry.length === 1 ? inCountry[0] : null);
    if (hit) {
      rates.set(p.key, {
        lodging: Number(hit.lodging),
        mie: Number(hit.mie),
        location: hit.location === "[Other]" ? `${countryName(p.country)} (country rate)` : hit.location,
        basis: hit.location === "[Other]" ? "country" : "city",
        source: hit.source as "state" | "gsa",
      });
    }
  }
  const factors = { ...DEFAULT_FACTORS };
  for (const c of calRes.data ?? []) {
    if (c.kind === "lodging") {
      factors.lodging = Number(c.factor);
      factors.lodgingSamples = c.samples;
    }
    if (c.kind === "day") {
      factors.day = Number(c.factor);
      factors.daySamples = c.samples;
    }
  }
  return { rates, factors };
}
