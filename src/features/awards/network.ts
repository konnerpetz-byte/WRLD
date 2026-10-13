import "server-only";

import type { requireUserId } from "@/lib/supabase/server";

import type { Network, RouteEdge } from "./charts";

type Supabase = Awaited<ReturnType<typeof requireUserId>>["supabase"];

const COLS = "origin, destination, airline, seasonal";
const PAGE = 1000;

type Page = PromiseLike<{ data: unknown[] | null; error: unknown }>;

/** Every page of a route query (the API returns at most 1,000 rows at a time). */
async function all(build: (from: number, to: number) => Page): Promise<RouteEdge[]> {
  const out: RouteEdge[] = [];
  for (let page = 0; page < 30; page++) {
    const { data, error } = await build(page * PAGE, page * PAGE + PAGE - 1);
    if (error || !data) break;
    out.push(...(data as RouteEdge[]));
    if (data.length < PAGE) break;
  }
  return out;
}

/**
 * The slice of WRLD's route network one explorer search needs, enough for
 * nonstop and one-stop itineraries:
 *   1. every route touching the origins (gives the possible connection airports)
 *   2. routes between those connection airports and the destinations
 * Routes not confirmed in the last 30 days are ignored.
 */
export async function loadNetwork(supabase: Supabase, origins: string[], destinations: string[]): Promise<Network> {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const q = () => supabase.from("airport_routes").select(COLS).gte("last_seen", since);
  const [fromOrigin, toOrigin] = await Promise.all([
    all((a, b) => q().in("origin", origins).order("destination").order("airline").range(a, b)),
    all((a, b) => q().in("destination", origins).order("origin").order("airline").range(a, b)),
  ]);
  const hubs = [...new Set([...fromOrigin.map((e) => e.destination), ...toOrigin.map((e) => e.origin)])].filter((h) => !origins.includes(h));
  const dests = destinations.filter((d) => !origins.includes(d));
  const near = [...new Set([...hubs, ...origins])];
  const [destSide, hubSide] = dests.length
    ? await Promise.all([
        all((a, b) => q().in("origin", dests).in("destination", near).order("origin").order("destination").order("airline").range(a, b)),
        hubs.length
          ? all((a, b) => q().in("origin", hubs).in("destination", dests).order("origin").order("destination").order("airline").range(a, b))
          : Promise.resolve([] as RouteEdge[]),
      ])
    : [[] as RouteEdge[], [] as RouteEdge[]];
  // An airport's routes are "known" once its own page has been read.
  const known = new Set<string>([...fromOrigin, ...destSide].map((e) => e.origin));
  return { known, edges: [...fromOrigin, ...toOrigin, ...destSide, ...hubSide] };
}
