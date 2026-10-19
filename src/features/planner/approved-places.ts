import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { distanceKm } from "@/lib/geo";
import { publicClient } from "@/lib/supabase/public";

import { type Getaway, GETAWAYS } from "./drive";
import { type PlaceMeta, registerPlaces } from "./registry";
import { guessSeason } from "./season-data";
import type { Season } from "./seasons";
import { parseVibes } from "./vibes";

export type ApprovedPlace = Getaway & PlaceMeta;

/** Places approved at /admin/places, as road-trip getaways. Cached for an hour; approving refreshes it. */
export async function approvedPlaces(): Promise<ApprovedPlace[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("approved-places");
  const out: ApprovedPlace[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await publicClient()
      .from("getaway_candidates")
      .select("qid, name, region, latitude, longitude, kind, tier, gem, why, vibes, wikipedia")
      .eq("status", "approved")
      .order("qid")
      .range(from, from + 999);
    if (error || !data?.length) break;
    for (const r of data) {
      // A hand-picked place already covers this spot (Traverse City, Door County…)
      if (GETAWAYS.some((g) => distanceKm(g, r) < 4)) continue;
      const base = { state: r.region, latitude: r.latitude, longitude: r.longitude };
      const vibes = parseVibes((r.vibes ?? []).join(","));
      const season: Season =
        vibes.includes("snow") ? "ski" : r.kind === "park" ? "park" : vibes.includes("water") && r.latitude >= 41 ? "north_summer" : guessSeason(base);
      out.push({
        key: `wd-${r.qid}`,
        name: r.name.replace(/\s*\(.*?\)\s*$/, ""),
        ...base,
        tier: (r.tier ?? 1) as 1 | 2 | 3,
        why: r.why ?? "",
        gem: Boolean(r.gem),
        photo: r.wikipedia ?? undefined,
        season,
        vibes,
      });
    }
    if (data.length < 1000) break;
  }
  return out;
}

/** Load approved places into the planner. Call before pricing or matching road trips. */
export async function withApprovedPlaces() {
  registerPlaces(await approvedPlaces());
}
