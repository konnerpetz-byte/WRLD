import "server-only";

import type { requireUserId } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof requireUserId>>["supabase"];

export type Typical = { low: number; high: number; count: number };

/**
 * What seats on a route have actually cost lately: the middle half of every
 * real sighting (licensed data and traveler reports, never sample data) in the
 * last 90 days, per destination and program. Shown once there are 3+ sightings.
 */
export async function typicalPrices(supabase: Supabase, origin: string, destinations: string[], cabin: string) {
  const since = new Date(Date.now() - 90 * 86400000).toISOString();
  const { data } = await supabase
    .from("award_availability_history")
    .select("destination, program, miles, data_source")
    .eq("origin", origin)
    .eq("cabin", cabin)
    .in("destination", destinations.slice(0, 60))
    .in("change", ["opened", "cheaper", "pricier"])
    .neq("data_source", "sample")
    .gte("observed_at", since)
    .not("miles", "is", null)
    .limit(5000);
  const groups = new Map<string, number[]>();
  for (const r of data ?? []) {
    const key = `${r.destination}|${r.program}`;
    groups.set(key, [...(groups.get(key) ?? []), Number(r.miles)]);
  }
  const out = new Map<string, Typical>();
  for (const [key, list] of groups) {
    if (list.length < 3) continue;
    const sorted = [...list].sort((a, b) => a - b);
    const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];
    out.set(key, { low: at(0.25), high: at(0.75), count: sorted.length });
  }
  return out;
}
