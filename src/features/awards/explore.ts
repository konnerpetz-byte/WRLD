import "server-only";

import type { requireUserId } from "@/lib/supabase/server";

import { type AwardMode, type AwardResult, type AwardSearch, searchAwards } from "./search";

type Supabase = Awaited<ReturnType<typeof requireUserId>>["supabase"];

export type ExploreResult = {
  /** "cache": from WRLD's own award cache; otherwise the direct source used as a fallback. */
  mode: "cache" | AwardMode;
  results: AwardResult[];
  /** Any result is made-up sample data. */
  sample: boolean;
  /** Oldest "seen at" among results from the cache, so the page can say how fresh they are. */
  oldestSeen: string | null;
  /** Destinations the engine hasn't checked yet (queued; shown from the direct source meanwhile). */
  queued: string[];
  error?: string;
};

/**
 * Points explorer search, cache first:
 *   1. log the search (the route planner's demand signal)
 *   2. ask the planner for these routes; it says which ones it has already checked
 *   3. read checked routes from award_availability
 *   4. for routes not checked yet, fall back to the direct source so the page
 *      still answers now; the worker fills the cache within about 15 minutes
 */
export async function exploreAwards(
  supabase: Supabase,
  userId: string,
  q: AwardSearch,
  meta: { month: string; via: string | null },
): Promise<ExploreResult> {
  await supabase
    .from("award_searches")
    .insert({ user_id: userId, origin: q.origin, destinations: q.destinations.slice(0, 60), cabin: q.cabin, month: `${meta.month}-01`, via: meta.via?.slice(0, 60) || null })
    .then(() => undefined, () => undefined);

  const { data: routes } = await supabase.rpc("request_award_routes", {
    p_origin: q.origin,
    p_destinations: q.destinations.slice(0, 60),
    p_cabin: q.cabin,
  });
  const checked = new Set((routes ?? []).filter((r) => r.checked_at).map((r) => r.destination));
  const queued = q.destinations.filter((d) => !checked.has(d));

  const cached: AwardResult[] = [];
  let oldestSeen: string | null = null;
  let sample = false;
  {
    // Cached seats for checked routes, plus traveler reports on any route (last three days only).
    let query = supabase
      .from("award_availability")
      .select("id, origin, destination, travel_date, program, cabin, miles, seats, airlines, direct, data_source, seen_at")
      .eq("origin", q.origin)
      .eq("cabin", q.cabin)
      .in("destination", q.destinations.slice(0, 60))
      .gte("travel_date", q.start)
      .lte("travel_date", q.end)
      .is("closed_at", null)
      .order("miles", { ascending: true })
      .limit(3000);
    if (q.sources?.length) query = query.in("program", q.sources);
    if (q.directOnly) query = query.eq("direct", true);
    const { data } = await query;
    const fresh = Date.now() - 3 * 86400000;
    const rows = (data ?? []).filter((r) =>
      r.data_source === "community" ? Date.parse(r.seen_at) >= fresh : checked.has(r.destination),
    );
    // Once a licensed source has data, never mix sample seats in.
    const hasLicensed = rows.some((r) => r.data_source !== "sample" && r.data_source !== "community");
    for (const row of rows) {
      if (hasLicensed && row.data_source === "sample") continue;
      const reported = row.data_source === "community";
      if (row.data_source === "sample") sample = true;
      if (!reported && (!oldestSeen || row.seen_at < oldestSeen)) oldestSeen = row.seen_at;
      cached.push({
        id: `c${row.id}`,
        date: row.travel_date,
        origin: row.origin,
        destination: row.destination,
        source: row.program,
        cabin: row.cabin,
        miles: row.miles,
        seats: row.seats,
        airlines: row.airlines,
        direct: row.direct,
        updatedAt: row.seen_at,
        reported,
      });
    }
  }

  let direct: { mode: AwardMode; results: AwardResult[]; error?: string } = { mode: "off", results: [] };
  if (queued.length) {
    direct = await searchAwards({ ...q, destinations: queued });
    if (direct.mode === "sample" && direct.results.length) sample = true;
  }

  return {
    mode: checked.size ? "cache" : direct.mode,
    results: [...cached, ...direct.results],
    sample,
    oldestSeen,
    queued,
    error: direct.error,
  };
}

/** "3 hours ago", "yesterday". */
export function ago(iso: string, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}
