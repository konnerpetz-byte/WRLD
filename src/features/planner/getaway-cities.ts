import "server-only";

import { cacheLife } from "next/cache";

import { driveTrips, type DriveOption, nearestState } from "./drive";
import { gasPriceFor, loadGasPrices } from "./gas-prices";
import { loadGsaSeason, seasonFn } from "./season-data";
import { fridayIn } from "./stay-links";

/**
 * Starting cities for the public "Weekend getaways from …" pages: the Midwest first, where WRLD's
 * road-trip list is deepest. City-center coordinates; the airport code pre-fills the planner.
 */
export const GETAWAY_CITIES = [
  { slug: "detroit", name: "Detroit", state: "MI", airport: "DTW", latitude: 42.3314, longitude: -83.0458 },
  { slug: "grand-rapids", name: "Grand Rapids", state: "MI", airport: "GRR", latitude: 42.9634, longitude: -85.6681 },
  { slug: "ann-arbor", name: "Ann Arbor", state: "MI", airport: "DTW", latitude: 42.2808, longitude: -83.743 },
  { slug: "lansing", name: "Lansing", state: "MI", airport: "LAN", latitude: 42.7325, longitude: -84.5555 },
  { slug: "chicago", name: "Chicago", state: "IL", airport: "ORD", latitude: 41.8781, longitude: -87.6298 },
  { slug: "milwaukee", name: "Milwaukee", state: "WI", airport: "MKE", latitude: 43.0389, longitude: -87.9065 },
  { slug: "minneapolis", name: "Minneapolis", state: "MN", airport: "MSP", latitude: 44.9778, longitude: -93.265 },
  { slug: "toledo", name: "Toledo", state: "OH", airport: "DTW", latitude: 41.6528, longitude: -83.5379 },
  { slug: "cleveland", name: "Cleveland", state: "OH", airport: "CLE", latitude: 41.4993, longitude: -81.6944 },
  { slug: "columbus", name: "Columbus", state: "OH", airport: "CMH", latitude: 39.9612, longitude: -82.9988 },
  { slug: "cincinnati", name: "Cincinnati", state: "OH", airport: "CVG", latitude: 39.1031, longitude: -84.512 },
  { slug: "indianapolis", name: "Indianapolis", state: "IN", airport: "IND", latitude: 39.7684, longitude: -86.1581 },
  { slug: "pittsburgh", name: "Pittsburgh", state: "PA", airport: "PIT", latitude: 40.4406, longitude: -79.9959 },
  { slug: "st-louis", name: "St. Louis", state: "MO", airport: "STL", latitude: 38.627, longitude: -90.1994 },
] as const;
export type GetawayCity = (typeof GETAWAY_CITIES)[number];

export const getawayCity = (slug: string) => GETAWAY_CITIES.find((c) => c.slug === slug) ?? null;

/** Next month, "YYYY-MM": the weekend these pages price. */
export function nextMonthIso(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return d.toISOString().slice(0, 7);
}

/** Weekend and long-weekend getaways from a city, for two, mid-range, priced for next month. Cached for a day. */
export async function getawaysFrom(slug: string): Promise<{ month: string; checkIn: string; options: DriveOption[] } | null> {
  "use cache";
  cacheLife("days");
  const city = getawayCity(slug);
  if (!city) return null;
  const month = nextMonthIso();
  const [gas, shapes] = await Promise.all([loadGasPrices(), loadGsaSeason(month)]);
  const options = driveTrips(
    city,
    { cash: Infinity, travelers: 2, style: "mid", season: seasonFn(month, shapes) },
    { home: gasPriceFor(gas, nearestState(city) ?? city.state), at: (st) => gasPriceFor(gas, st) },
  ).sort((a, b) => a.hours - b.hours);
  return { month, checkIn: fridayIn(month), options };
}
