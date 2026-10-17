import "server-only";

import { cacheLife } from "next/cache";

import type { PlaceSuggestion } from "@/features/attractions/types";
import { distanceKm } from "@/lib/geo";

/**
 * Find a specific named place — a restaurant, beer hall, bar, shop, tour office, landmark — by
 * name, from OpenStreetMap (Photon). Wikidata only knows famous sights with websites, so
 * "Augustiner Stammhaus" or a neighborhood taverna were never found before. Biased toward the
 * trip day's city when we know it.
 */

const PHOTON = process.env.GEOCODER_URL ?? "https://photon.komoot.io/api/";
const USER_AGENT = process.env.GEOCODER_USER_AGENT ?? "WRLD trip planner (https://wrldtrips.com)";

export type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_key?: string;
    osm_value?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    district?: string;
    country?: string;
  };
};

/** Kinds of OpenStreetMap things a traveler would add to a day. */
const PLACE_KEYS = new Set(["amenity", "tourism", "historic", "leisure", "shop", "craft", "natural", "man_made", "building", "club"]);
const SKIP_VALUES = new Set(["parking", "bench", "waste_basket", "toilets", "atm", "bicycle_parking", "vending_machine", "post_box", "telephone", "fuel", "charging_station", "yes", "house", "residential", "apartments"]);

const LABEL: Record<string, string> = {
  restaurant: "Restaurant",
  cafe: "Café",
  bar: "Bar",
  pub: "Pub",
  biergarten: "Beer garden",
  brewery: "Brewery",
  fast_food: "Quick bite",
  ice_cream: "Ice cream",
  bakery: "Bakery",
  nightclub: "Club",
  theatre: "Theater",
  cinema: "Cinema",
  museum: "Museum",
  gallery: "Gallery",
  attraction: "Attraction",
  viewpoint: "Viewpoint",
  zoo: "Zoo",
  aquarium: "Aquarium",
  theme_park: "Theme park",
  park: "Park",
  garden: "Garden",
  beach: "Beach",
  castle: "Castle",
  monument: "Monument",
  memorial: "Memorial",
  ruins: "Ruins",
  place_of_worship: "Place of worship",
  marketplace: "Market",
  winery: "Winery",
  wine: "Wine shop",
  books: "Bookstore",
  spa: "Spa",
};

const titleCase = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** Photon results → place suggestions: named places only (no streets or towns), nearest first. */
export function toSuggestions(features: PhotonFeature[], near: { latitude: number; longitude: number } | null, limit = 5): PlaceSuggestion[] {
  const seen = new Set<string>();
  const out: PlaceSuggestion[] = [];
  for (const f of features) {
    const p = f.properties;
    if (!p.name || !p.osm_key || !PLACE_KEYS.has(p.osm_key) || (p.osm_value && SKIP_VALUES.has(p.osm_value))) continue;
    const [longitude, latitude] = f.geometry.coordinates;
    const key = `${p.name.toLowerCase()}|${latitude.toFixed(3)},${longitude.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const street = [p.street, p.housenumber].filter(Boolean).join(" ");
    const address = [street || null, p.district ?? null, p.city ?? null].filter(Boolean).join(", ") || null;
    const kind = p.osm_value ? (LABEL[p.osm_value] ?? titleCase(p.osm_value)) : null;
    out.push({
      source: "osm",
      ref: `${latitude.toFixed(6)},${longitude.toFixed(6)}`,
      name: p.name,
      detail: [kind, address].filter(Boolean).join(" · ") || null,
      latitude,
      longitude,
      address,
      officialUrl: null,
      ticketsUrl: null,
      timedEntry: false,
      bestSlot: null,
      suggestedStart: null,
      durationMinutes: null,
      price: null,
      currency: null,
      priceNote: null,
      hoursNote: null,
      visitNote: null,
      km: near ? Math.round(distanceKm(near, { latitude, longitude }) * 10) / 10 : null,
    });
  }
  // Near the day's city, keep it local (a "Hofbräuhaus" in Munich, not the one in Las Vegas).
  const local = near ? out.filter((s) => (s.km ?? 0) <= 150) : out;
  return (local.length ? local : out).slice(0, limit);
}

async function photon(query: string, lat: number | null, lng: number | null) {
  "use cache";
  cacheLife("days");
  const url = new URL(PHOTON);
  url.search = new URLSearchParams({ q: query, limit: "15", lang: "en", ...(lat != null && lng != null ? { lat: String(lat), lon: String(lng) } : {}) }).toString();
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [] as PhotonFeature[];
    const data = (await res.json()) as { features?: PhotonFeature[] };
    return data.features ?? [];
  } catch {
    return [] as PhotonFeature[];
  }
}

export async function searchNamedPlaces(query: string, near: { latitude: number; longitude: number } | null, limit = 5): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  // Rounded so nearby searches share the cache.
  const lat = near ? Math.round(near.latitude * 100) / 100 : null;
  const lng = near ? Math.round(near.longitude * 100) / 100 : null;
  return toSuggestions(await photon(q, lat, lng), near, limit);
}
