import "server-only";

import { cacheLife } from "next/cache";

import { publicClient } from "@/lib/supabase/public";

import type { Getaway, SeasonFn } from "./drive";
import { hotelSeason, type Season } from "./seasons";
import { driveMeta } from "./vibes";

/**
 * Month-by-month hotel prices for road trips.
 *
 * GSA's per diem rates (refreshed daily by the costs-refresh worker) give ~300 U.S. destinations a
 * rate for every month: Traverse City is $134 most of the year and $235 in July and August. GSA
 * sets seasons rather than true monthly prices, so July and August often match there even though
 * real hotel prices don't. WRLD blends the two: 60% GSA's month against its yearly average, 40%
 * WRLD's pattern for that kind of place. Places GSA doesn't list use the pattern alone.
 */
export type GsaShape = { names: string[]; county: string | null; state: string; factor: number };

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** "Pontiac / Auburn Hills (Oakland County)" → names ["pontiac", "auburn hills"], county "oakland" */
export function parseGsaLocation(location: string) {
  const m = location.match(/^(.*?)\s*\((.*?)\)\s*$/);
  const names = (m ? m[1] : location).split("/").map(fold).filter(Boolean);
  const county = m ? fold(m[2].replace(/\bcounty\b/i, "")) || null : null;
  return { names, county };
}

export async function loadGsaSeason(month: string): Promise<GsaShape[]> {
  "use cache";
  cacheLife("days");
  const n = Number(month.slice(5, 7));
  if (!(n >= 1 && n <= 12)) return [];
  const { data } = await publicClient().from("cost_gsa_season").select("location, state, factor").eq("month", n).limit(2000);
  return (data ?? [])
    .filter((r) => r.location && r.state && Number(r.factor) > 0)
    .map((r) => ({ ...parseGsaLocation(r.location!), state: r.state!, factor: Number(r.factor) }));
}

/** The GSA row for a road-trip place: same state, and the town's or county's name. */
export function gsaFor(g: Pick<Getaway, "name" | "state">, shapes: GsaShape[]) {
  const name = fold(g.name.replace(/\(.*?\)/g, ""));
  return (
    shapes.find((s) => s.state === g.state && s.names.includes(name)) ??
    shapes.find((s) => s.state === g.state && s.county && (name === s.county || name === `${s.county} county`)) ??
    null
  );
}

/** A guess at the season pattern for a town we only know by its map position. */
export function guessSeason(g: Pick<Getaway, "state" | "latitude" | "longitude">): Season {
  if (g.state === "FL") return "florida";
  if (["AZ", "NV"].includes(g.state) || (g.state === "CA" && g.latitude < 34.5 && g.longitude > -117.5)) return "desert";
  if (["CO", "UT", "WY", "MT", "ID"].includes(g.state)) return "park";
  if (g.latitude >= 42) return "north_summer";
  return "city";
}

/** Hotel price this month against the yearly average, for each road-trip place. */
export function seasonFn(month: string, shapes: GsaShape[]): SeasonFn {
  return (g) => {
    const known = g.key.startsWith("place-") ? null : driveMeta(g.key);
    const pattern = hotelSeason(known && known.vibes.length ? known.season : guessSeason(g), month);
    const gsa = gsaFor(g, shapes);
    return gsa
      ? { factor: Math.round((0.6 * gsa.factor + 0.4 * pattern) * 1000) / 1000, source: "gsa" }
      : { factor: pattern, source: "pattern" };
  };
}
