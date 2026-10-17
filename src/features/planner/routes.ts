import "server-only";

import { cacheLife } from "next/cache";

import type { LatLng } from "@/lib/geo";

import { getawaysNear } from "./drive";

/**
 * Real driving distances and times from one starting point to the nearby getaways, in a single
 * OpenRouteService matrix request (free tier: 500 a day; set ORS_API_KEY from openrouteservice.org).
 * Cached for a week per starting airport, since roads don't move. Without a key, drive.ts estimates.
 */
export async function loadRoutes(homeKey: string, home: LatLng): Promise<Map<string, { miles: number; hours: number }> | null> {
  "use cache";
  cacheLife("weeks");
  const key = process.env.ORS_API_KEY;
  if (!key) return null;
  const near = getawaysNear(home);
  if (!near.length) return new Map();
  try {
    const res = await fetch("https://api.openrouteservice.org/v2/matrix/driving-car", {
      method: "POST",
      headers: { Authorization: key, "Content-Type": "application/json" },
      body: JSON.stringify({
        locations: [[home.longitude, home.latitude], ...near.map((g) => [g.longitude, g.latitude])],
        sources: [0],
        destinations: near.map((_, i) => i + 1),
        metrics: ["distance", "duration"],
        units: "mi",
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { distances?: (number | null)[][]; durations?: (number | null)[][] };
    const miles = json.distances?.[0] ?? [];
    const secs = json.durations?.[0] ?? [];
    const out = new Map<string, { miles: number; hours: number }>();
    near.forEach((g, i) => {
      const m = miles[i];
      const s = secs[i];
      // Driving time plus a stop about every two hours.
      if (typeof m === "number" && typeof s === "number" && m > 0) out.set(g.key, { miles: m, hours: (s / 3600) * 1.1 });
    });
    return out;
  } catch {
    return null;
  }
}
