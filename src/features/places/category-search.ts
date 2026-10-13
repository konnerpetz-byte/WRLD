import "server-only";

import { cacheLife } from "next/cache";

import type { PlaceSuggestion } from "@/features/attractions/types";
import { distanceKm } from "@/lib/geo";
import { geocode } from "./geocode";

/**
 * "Munich cafe", "bookstores", "gelato near me" → real places of that kind
 * from OpenStreetMap (Photon reverse search by category), around the named
 * city or the trip day's location. Free to visit or price not listed.
 */

const CATEGORIES: { words: RegExp; tag: string; label: string; radiusKm: number }[] = [
  { words: /\b(cafes?|caf[eé]s?|coffee( shops?)?|espresso)\b/i, tag: "amenity:cafe", label: "Café", radiusKm: 3 },
  { words: /\b(bakery|bakeries|pastr(y|ies)|patisserie)\b/i, tag: "shop:bakery", label: "Bakery", radiusKm: 3 },
  { words: /\b(gelato|ice ?cream)\b/i, tag: "amenity:ice_cream", label: "Ice cream", radiusKm: 3 },
  { words: /\b(restaurants?|dinner|lunch|food|eat)\b/i, tag: "amenity:restaurant", label: "Restaurant", radiusKm: 3 },
  { words: /\b(pubs?)\b/i, tag: "amenity:pub", label: "Pub", radiusKm: 3 },
  { words: /\b(bars?|wine bars?|cocktails?)\b/i, tag: "amenity:bar", label: "Bar", radiusKm: 3 },
  { words: /\b(beer ?garden|biergarten)s?\b/i, tag: "amenity:biergarten", label: "Beer garden", radiusKm: 6 },
  { words: /\b(brewer(y|ies))\b/i, tag: "craft:brewery", label: "Brewery", radiusKm: 10 },
  { words: /\b(clubs?|nightclubs?)\b/i, tag: "amenity:nightclub", label: "Club", radiusKm: 5 },
  { words: /\b(book ?(stores?|shops?)|bookshops?|bookstores?)\b/i, tag: "shop:books", label: "Bookstore", radiusKm: 5 },
  { words: /\b(markets?)\b/i, tag: "amenity:marketplace", label: "Market", radiusKm: 8 },
  { words: /\b(museums?)\b/i, tag: "tourism:museum", label: "Museum", radiusKm: 10 },
  { words: /\b(galler(y|ies))\b/i, tag: "tourism:gallery", label: "Gallery", radiusKm: 8 },
  { words: /\b(parks?|gardens?)\b/i, tag: "leisure:park", label: "Park", radiusKm: 6 },
  { words: /\b(playgrounds?)\b/i, tag: "leisure:playground", label: "Playground", radiusKm: 3 },
  { words: /\b(beach(es)?)\b/i, tag: "natural:beach", label: "Beach", radiusKm: 40 },
  { words: /\b(viewpoints?|views?|lookouts?)\b/i, tag: "tourism:viewpoint", label: "Viewpoint", radiusKm: 20 },
  { words: /\b(churches|church|cathedrals?)\b/i, tag: "amenity:place_of_worship", label: "Place of worship", radiusKm: 5 },
  { words: /\b(castles?)\b/i, tag: "historic:castle", label: "Castle", radiusKm: 40 },
  { words: /\b(zoos?)\b/i, tag: "tourism:zoo", label: "Zoo", radiusKm: 30 },
  { words: /\b(aquariums?)\b/i, tag: "tourism:aquarium", label: "Aquarium", radiusKm: 30 },
  { words: /\b(theat(er|re)s?)\b/i, tag: "amenity:theatre", label: "Theater", radiusKm: 6 },
  { words: /\b(cinemas?|movies?)\b/i, tag: "amenity:cinema", label: "Cinema", radiusKm: 6 },
  { words: /\b(swimming|pools?)\b/i, tag: "leisure:swimming_pool", label: "Pool", radiusKm: 8 },
];

export function parseCategory(query: string) {
  const q = query.trim();
  for (const c of CATEGORIES) {
    const m = q.match(c.words);
    if (m) {
      const rest = q.replace(m[0], " ").replace(/\b(in|near|around|best|good|top|me|the|a)\b/gi, " ").replace(/[,]+/g, " ").replace(/\s+/g, " ").trim();
      return { ...c, city: rest.length >= 2 ? rest : null };
    }
  }
  return null;
}

const REVERSE = (process.env.GEOCODER_URL ?? "https://photon.komoot.io/api/").replace(/api\/?$/, "reverse");
const USER_AGENT = process.env.GEOCODER_USER_AGENT ?? "WRLD trip planner (https://wrldtrips.com)";
const COMPANY = /\b(lda|ltd|llc|inc|gmbh|s\.?a\.?|s\.?l\.?|srl|unipessoal)\.?$/i;

type Feature = {
  geometry: { coordinates: [number, number] };
  properties: { name?: string; street?: string; housenumber?: string; city?: string; district?: string; osm_value?: string };
};

async function placesByTag(tag: string, lat: number, lng: number, radiusKm: number, limit: number) {
  "use cache";
  cacheLife("days");
  const url = new URL(REVERSE);
  url.search = new URLSearchParams({ lat: String(lat), lon: String(lng), limit: "25", lang: "en", osm_tag: tag, radius: String(radiusKm) }).toString();
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = (await res.json()) as { features?: Feature[] };
    const seen = new Set<string>();
    return (data.features ?? [])
      .filter((f) => f.properties.name && !COMPANY.test(f.properties.name) && f.properties.name.length > 2)
      .filter((f) => {
        const k = f.properties.name!.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, limit)
      .map((f) => {
        const [longitude, latitude] = f.geometry.coordinates;
        const p = f.properties;
        const street = [p.street, p.housenumber].filter(Boolean).join(" ");
        return { name: p.name!, latitude, longitude, address: [street || null, p.district ?? p.city ?? null].filter(Boolean).join(", ") || null };
      });
  } catch {
    return [];
  }
}

/** Places of a kind ("cafe") near a city or point, as suggestions for the place search. */
export async function categorySuggestions(query: string, near: { latitude: number; longitude: number } | null, limit = 8): Promise<PlaceSuggestion[]> {
  const cat = parseCategory(query);
  if (!cat) return [];
  const center = cat.city ? ((await geocode(cat.city)) ?? near) : near;
  if (!center) return [];
  const at = { latitude: Math.round(center.latitude * 1000) / 1000, longitude: Math.round(center.longitude * 1000) / 1000 };
  const places = await placesByTag(cat.tag, at.latitude, at.longitude, cat.radiusKm, limit);
  return places.map((p) => ({
    source: "osm" as const,
    ref: `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`,
    name: p.name,
    detail: [cat.label, p.address].filter(Boolean).join(" · "),
    latitude: p.latitude,
    longitude: p.longitude,
    address: p.address,
    officialUrl: null,
    ticketsUrl: null,
    timedEntry: false,
    bestSlot: null,
    suggestedStart: null,
    durationMinutes: null,
    price: null,
    currency: null,
    priceNote: "Free to visit, or price not listed",
    hoursNote: null,
    visitNote: null,
    km: near ? Math.round(distanceKm(near, p) * 10) / 10 : null,
  }));
}
