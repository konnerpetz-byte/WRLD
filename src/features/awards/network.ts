import "server-only";

import type { requireUserId } from "@/lib/supabase/server";

import type { Network, RouteEdge } from "./charts";

type Supabase = Awaited<ReturnType<typeof requireUserId>>["supabase"];

/**
 * The slice of WRLD's route network one explorer search needs: every route
 * touching the origin or any destination (enough for nonstop and one-stop
 * itineraries). Routes not confirmed in the last 30 days are ignored.
 */
export async function loadNetwork(supabase: Supabase, origin: string, destinations: string[]): Promise<Network> {
  const codes = [origin, ...destinations].slice(0, 61);
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const cols = "origin, destination, airline, seasonal";
  const [out, inbound] = await Promise.all([
    supabase.from("airport_routes").select(cols).in("origin", codes).gte("last_seen", since).limit(10000),
    supabase.from("airport_routes").select(cols).in("destination", codes).gte("last_seen", since).limit(10000),
  ]);
  const edges = [...(out.data ?? []), ...(inbound.data ?? [])] as RouteEdge[];
  // An airport's routes are "known" once its own page has been read.
  const known = new Set((out.data ?? []).map((e) => e.origin));
  return { known, edges };
}
