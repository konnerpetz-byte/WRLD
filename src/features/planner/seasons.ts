import type { RegionKey } from "@/features/awards/regions";

/**
 * How prices move through the year, as a multiplier on a place's yearly average (1 = average).
 *
 * Used only where WRLD has no dated price for that month:
 *   - Hotels: GSA publishes month-by-month rates for ~300 U.S. destinations and the State
 *     Department publishes seasons abroad; WRLD uses those first. Everywhere else (most small
 *     towns), a season pattern for the kind of place: lake towns peak in July and August, ski
 *     towns in winter, Florida and the desert in winter and spring.
 *   - Flights: live fares when Aviasales has them for that month; otherwise a distance estimate
 *     times the month's pattern for that part of the world (Europe peaks June to August, the
 *     Caribbean in winter and spring, U.S. trips in June, July and the holidays and drop after
 *     mid-August).
 *
 * These patterns are WRLD's estimates from how travel demand typically moves. They're
 * replaced by real numbers wherever real numbers exist.
 */

//                      Jan   Feb   Mar   Apr   May   Jun   Jul   Aug   Sep   Oct   Nov   Dec
const HOTEL = {
  /** Great Lakes and New England lake/beach towns: busy summer, quiet winter */
  north_summer: [0.72, 0.72, 0.74, 0.8, 0.95, 1.22, 1.42, 1.36, 1.1, 1.0, 0.74, 0.8],
  /** Ski towns: winter and holidays, a smaller summer bump */
  ski: [1.38, 1.42, 1.3, 0.82, 0.76, 0.98, 1.12, 1.08, 0.95, 0.88, 0.82, 1.35],
  /** Southern beach towns: spring break and summer */
  south_beach: [0.72, 0.78, 1.05, 1.05, 1.12, 1.38, 1.45, 1.18, 0.9, 0.85, 0.75, 0.75],
  /** Florida and the Keys: winter escape season */
  florida: [1.3, 1.42, 1.45, 1.2, 0.95, 0.85, 0.85, 0.8, 0.72, 0.85, 0.98, 1.25],
  /** Desert resorts: winter and spring, empty in summer heat */
  desert: [1.18, 1.35, 1.4, 1.2, 0.95, 0.75, 0.7, 0.7, 0.8, 1.05, 1.1, 1.0],
  /** National parks and mountain outdoors: summer and early fall */
  park: [0.72, 0.74, 0.82, 0.92, 1.08, 1.32, 1.36, 1.3, 1.15, 1.02, 0.78, 0.76],
  /** Fall-color and mountain towns: October peak, busy summer */
  fall_color: [0.78, 0.8, 0.88, 0.95, 1.02, 1.12, 1.18, 1.1, 1.05, 1.38, 0.98, 0.95],
  /** Cities: steadier, spring and fall a bit higher, January lowest */
  city: [0.85, 0.88, 0.97, 1.02, 1.07, 1.1, 1.08, 1.04, 1.07, 1.1, 0.95, 0.9],
} as const;
export type Season = keyof typeof HOTEL;

const FARE: Record<RegionKey, readonly number[]> = {
  //                Jan   Feb   Mar   Apr   May   Jun   Jul   Aug   Sep   Oct   Nov   Dec
  north_america: [0.86, 0.88, 1.0, 0.97, 1.0, 1.16, 1.15, 0.96, 0.87, 0.92, 0.98, 1.14],
  europe: [0.76, 0.78, 0.88, 0.97, 1.07, 1.3, 1.32, 1.14, 1.0, 0.9, 0.78, 0.98],
  latin_america: [1.1, 1.12, 1.2, 1.05, 0.92, 1.0, 1.08, 0.9, 0.8, 0.83, 0.9, 1.16],
  asia: [0.95, 0.98, 0.95, 1.0, 0.98, 1.12, 1.18, 1.12, 0.9, 0.92, 0.92, 1.08],
  oceania: [1.18, 1.0, 0.95, 0.92, 0.85, 0.86, 0.9, 0.88, 0.95, 1.02, 1.08, 1.32],
  middle_east_africa: [0.98, 0.95, 0.98, 1.0, 0.95, 1.0, 1.06, 1.06, 0.95, 0.98, 1.0, 1.12],
};

const monthIndex = (month: string) => {
  const m = Number(month.slice(5, 7));
  return m >= 1 && m <= 12 ? m - 1 : 6;
};

export const hotelSeason = (season: Season, month: string) => HOTEL[season][monthIndex(month)];
export const fareSeason = (region: RegionKey | null, month: string) => (region ? FARE[region][monthIndex(month)] : 1);

/** A month's rate against the yearly average, from published monthly rates (GSA). */
export function shapeFrom(rates: number[], month: string): number | null {
  if (rates.length < 12) return null;
  const avg = rates.reduce((s, r) => s + r, 0) / rates.length;
  const r = rates[monthIndex(month)];
  return avg > 0 && r > 0 ? Math.round((r / avg) * 1000) / 1000 : null;
}

export const SEASON_LABEL: Record<Season, string> = {
  north_summer: "summer lake-town season",
  ski: "ski-town season",
  south_beach: "beach season",
  florida: "Florida's winter season",
  desert: "desert resort season",
  park: "national park season",
  fall_color: "mountain-town season",
  city: "city travel season",
};

/** Busy, normal or quiet, for the card. */
export function seasonWord(multiplier: number) {
  return multiplier >= 1.15 ? "peak season" : multiplier <= 0.85 ? "off season" : null;
}
