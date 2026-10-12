import "server-only";

import { cacheLife } from "next/cache";

import { distanceKm } from "@/lib/geo";

/**
 * Real, named places for an idea ("Café crawl" → three actual cafés), from
 * OpenStreetMap through Photon, near the stay or the city center.
 */

export type NamedPlace = { name: string; latitude: number; longitude: number; address: string | null; km: number };

/** Which OpenStreetMap places fit each idea in recommendations/ideas.ts. */
export const IDEA_PLACES: Record<string, { q: string; tag: string; radiusKm: number }> = {
  "cafe-morning": { q: "cafe", tag: "amenity:cafe", radiusKm: 2 },
  bookshop: { q: "bookstore", tag: "shop:books", radiusKm: 4 },
  market: { q: "market", tag: "amenity:marketplace", radiusKm: 6 },
  "park-picnic": { q: "park", tag: "leisure:park", radiusKm: 5 },
  "small-gallery": { q: "gallery", tag: "tourism:gallery", radiusKm: 5 },
  "big-museum": { q: "museum", tag: "tourism:museum", radiusKm: 8 },
  "special-dinner": { q: "restaurant", tag: "amenity:restaurant", radiusKm: 2 },
  wine: { q: "wine bar", tag: "amenity:bar", radiusKm: 3 },
  "live-music": { q: "live music", tag: "amenity:music_venue", radiusKm: 5 },
  "beach-day": { q: "beach", tag: "natural:beach", radiusKm: 30 },
  architecture: { q: "landmark", tag: "tourism:attraction", radiusKm: 5 },
  "sunrise-hike": { q: "viewpoint", tag: "tourism:viewpoint", radiusKm: 20 },
  wildlife: { q: "nature reserve", tag: "leisure:nature_reserve", radiusKm: 40 },
};

// Photon's /reverse with an OpenStreetMap tag lists places of that kind around a point.
const REVERSE = (process.env.GEOCODER_URL ?? "https://photon.komoot.io/api/").replace(/api\/?$/, "reverse");
/** Names that are just the category or a company registration, not a place to recommend. */
const GENERIC = /^(cafe|café|caffe|coffee|pastelaria|bar|pub|restaurant|restaurante|park|parque|museum|museu|museo|gallery|market|mercado|beach|praia|viewpoint|miradouro|livraria|bookstore)$/i;
const COMPANY = /\b(lda|ltd|llc|inc|gmbh|s\.?a\.?|s\.?l\.?|srl|unipessoal)\.?$/i;
const USER_AGENT = process.env.GEOCODER_USER_AGENT ?? "WRLD trip planner (https://wrldtrips.com)";

type Feature = {
  geometry: { coordinates: [number, number] };
  properties: { name?: string; street?: string; housenumber?: string; city?: string; district?: string; osm_value?: string };
};

export async function namedPlaces(ideaId: string, lat: number, lng: number, limit = 3): Promise<NamedPlace[]> {
  "use cache";
  cacheLife("days");
  const spec = IDEA_PLACES[ideaId];
  if (!spec) return [];
  // Round the point so nearby searches share the cache (~1 km).
  const at = { latitude: Math.round(lat * 100) / 100, longitude: Math.round(lng * 100) / 100 };
  const url = new URL(REVERSE);
  url.searchParams.set("lat", String(at.latitude));
  url.searchParams.set("lon", String(at.longitude));
  url.searchParams.set("limit", "20");
  url.searchParams.set("lang", "en");
  url.searchParams.set("osm_tag", spec.tag);
  url.searchParams.set("radius", String(spec.radiusKm));
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = (await res.json()) as { features?: Feature[] };
    const seen = new Set<string>();
    return (data.features ?? [])
      .filter((f) => f.properties.name && !GENERIC.test(f.properties.name.trim()) && !COMPANY.test(f.properties.name.trim()))
      .map((f) => {
        const [longitude, latitude] = f.geometry.coordinates;
        const p = f.properties;
        const street = [p.street, p.housenumber].filter(Boolean).join(" ");
        return {
          name: p.name!,
          latitude,
          longitude,
          address: [street || null, p.district ?? p.city ?? null].filter(Boolean).join(", ") || null,
          km: Math.round(distanceKm({ latitude: lat, longitude: lng }, { latitude, longitude }) * 10) / 10,
        };
      })
      .filter((p) => p.km <= spec.radiusKm && !seen.has(p.name.toLowerCase()) && seen.add(p.name.toLowerCase()))
      .sort((a, b) => a.km - b.km)
      .slice(0, limit);
  } catch {
    return [];
  }
}
