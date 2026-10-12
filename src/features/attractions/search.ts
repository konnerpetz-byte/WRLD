import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { distanceKm } from "@/lib/geo";
import type { Attraction, Database } from "@/types/database";
import type { PlaceSuggestion } from "./types";

/**
 * Finds the official thing a traveler means when they type "Sintra" or
 * "Neuschwanstein".
 *
 *   1. WRLD's hand-checked list (public.attractions): exact official ticket
 *      page, timed-entry rules, opening hours, best time of day, price.
 *   2. Wikidata: the place's official website (property P856) and
 *      coordinates, for anything not on the list yet. No hours or prices.
 *
 * Wikidata/Wikipedia are free and keyless; they ask for a descriptive
 * User-Agent (https://meta.wikimedia.org/wiki/User-Agent_policy).
 */

type Client = SupabaseClient<Database>;
type Point = { latitude: number; longitude: number };

const USER_AGENT = process.env.WIKIMEDIA_USER_AGENT ?? "WRLD trip planner (wrld app)";
const WIKIDATA = "https://www.wikidata.org/w/api.php";
const WIKIPEDIA = "https://en.wikipedia.org/w/api.php";

/** Things that aren't excursions: people, towns, companies, roads… */
const NOT_A_SIGHT =
  /\b(human|family name|given name|surname|city|town|village|municipality|commune|parish|district|county|province|country|capital|company|business|enterprise|organization|band|album|film|song|novel|television|episode|railway station|metro station|bus station|street|road|highway|school|university|hospital|airport|ship|battle|football|sports club)\b/i;

export function fromAttraction(a: Attraction, from?: Point | null): PlaceSuggestion {
  return {
    source: "official",
    ref: a.id,
    name: a.name,
    detail: a.city,
    latitude: a.latitude,
    longitude: a.longitude,
    address: a.address,
    officialUrl: a.official_url,
    ticketsUrl: a.tickets_url,
    timedEntry: a.timed_entry,
    bestSlot: a.best_slot,
    suggestedStart: a.suggested_start?.slice(0, 5) ?? null,
    durationMinutes: a.duration_minutes,
    price: a.adult_price === null ? null : Number(a.adult_price),
    currency: a.currency,
    priceNote: a.price_note,
    hoursNote: a.hours_note,
    visitNote: a.visit_note,
    km: from ? distanceKm(from, a) : null,
  };
}

export async function searchPlaces(supabase: Client, query: string, near?: Point | null): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const [{ data: listed }, fromWikidata] = await Promise.all([
    supabase.rpc("search_attractions", { p_query: q, p_limit: 6 }),
    wikidataSearch(q, near),
  ]);

  const official = ((listed ?? []) as Attraction[]).map((a) => fromAttraction(a, near));
  // Closest first when we know where the traveler is that day.
  if (near) official.sort((a, b) => (a.km ?? 0) - (b.km ?? 0));
  const seen = new Set(official.map((s) => s.name.toLowerCase()));
  const extra = fromWikidata.filter(
    (w) => !seen.has(w.name.toLowerCase()) && !official.some((o) => distanceKm(o, w) < 0.4),
  );
  return [...official, ...extra].slice(0, 8);
}

/** Re-reads a place from Wikidata by id (never trust coordinates from the browser). */
export async function wikidataPlace(id: string, near?: Point | null): Promise<PlaceSuggestion | null> {
  if (!/^Q\d+$/.test(id)) return null;
  const [place] = await wikidataEntities([id], near);
  return place ?? null;
}

// ---------------------------------------------------------------------------
// Explore nearby: WRLD's list within 50 km + notable places from Wikipedia
// within 10 km (Wikipedia's maximum search radius).
// ---------------------------------------------------------------------------
export async function nearbyPlaces(supabase: Client, at: Point, excludeName?: string): Promise<PlaceSuggestion[]> {
  const [{ data: listed }, notable] = await Promise.all([
    supabase.rpc("attractions_near", { p_lat: at.latitude, p_lng: at.longitude, p_km: 50 }),
    wikipediaNearby(at),
  ]);
  const official = ((listed ?? []) as { attraction: Attraction; km: number }[]).map((r) => fromAttraction(r.attraction, at));
  const skip = (name: string) => excludeName && name.toLowerCase() === excludeName.toLowerCase();
  const rest = notable.filter((n) => !official.some((o) => distanceKm(o, n) < 0.4 || o.name === n.name));
  return [...official, ...rest]
    .filter((p) => !skip(p.name) && (p.km ?? 0) > 0.05)
    .slice(0, 14);
}

async function wikipediaNearby(at: Point): Promise<PlaceSuggestion[]> {
  const url = new URL(WIKIPEDIA);
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "geosearch",
    ggscoord: `${at.latitude}|${at.longitude}`,
    ggsradius: "10000",
    ggslimit: "40",
    prop: "coordinates|description|pageprops",
    ppprop: "wikibase_item",
  }).toString();
  type Page = {
    title: string;
    description?: string;
    coordinates?: { lat: number; lon: number }[];
    pageprops?: { wikibase_item?: string };
  };
  const data = await getJson<{ query?: { pages?: Page[] } }>(url);
  return (data?.query?.pages ?? [])
    .filter((p) => p.coordinates?.[0] && p.pageprops?.wikibase_item && !NOT_A_SIGHT.test(p.description ?? ""))
    .map((p) => {
      const point = { latitude: p.coordinates![0].lat, longitude: p.coordinates![0].lon };
      return {
        ...blank(),
        source: "nearby" as const,
        ref: p.pageprops!.wikibase_item!,
        name: p.title,
        detail: p.description ?? null,
        ...point,
        km: distanceKm(at, point),
      };
    })
    .sort((a, b) => (a.km ?? 0) - (b.km ?? 0));
}

// ---------------------------------------------------------------------------
// Wikidata
// ---------------------------------------------------------------------------
async function wikidataSearch(query: string, near?: Point | null): Promise<PlaceSuggestion[]> {
  const url = new URL(WIKIDATA);
  url.search = new URLSearchParams({
    action: "wbsearchentities",
    search: query,
    language: "en",
    uselang: "en",
    type: "item",
    limit: "8",
    format: "json",
  }).toString();
  const data = await getJson<{ search?: { id: string; description?: string }[] }>(url);
  const ids = (data?.search ?? []).filter((r) => !NOT_A_SIGHT.test(r.description ?? "")).map((r) => r.id);
  if (!ids.length) return [];
  const places = await wikidataEntities(ids, near);
  // Only places with an official website are useful here; nearer is better.
  return places
    .filter((p) => p.officialUrl && (!near || (p.km ?? 0) <= 250))
    .sort((a, b) => (near ? (a.km ?? 0) - (b.km ?? 0) : 0))
    .slice(0, 4);
}

type Claim = { mainsnak?: { datavalue?: { value?: unknown } }; rank?: string };
type Entity = {
  id: string;
  labels?: { en?: { value: string } };
  descriptions?: { en?: { value: string } };
  claims?: Record<string, Claim[]>;
};

async function wikidataEntities(ids: string[], near?: Point | null): Promise<PlaceSuggestion[]> {
  const url = new URL(WIKIDATA);
  url.search = new URLSearchParams({
    action: "wbgetentities",
    ids: ids.join("|"),
    props: "labels|descriptions|claims",
    languages: "en",
    format: "json",
  }).toString();
  const data = await getJson<{ entities?: Record<string, Entity> }>(url);
  const out: PlaceSuggestion[] = [];
  for (const id of ids) {
    const e = data?.entities?.[id];
    if (!e) continue;
    const coord = best(e.claims?.P625) as { latitude?: number; longitude?: number } | undefined;
    if (typeof coord?.latitude !== "number" || typeof coord?.longitude !== "number") continue;
    const website = best(e.claims?.P856);
    const point = { latitude: coord.latitude, longitude: coord.longitude };
    out.push({
      ...blank(),
      source: "wikidata",
      ref: id,
      name: e.labels?.en?.value ?? id,
      detail: e.descriptions?.en?.value ?? null,
      ...point,
      officialUrl: typeof website === "string" && /^https?:\/\//.test(website) ? website : null,
      km: near ? distanceKm(near, point) : null,
    });
  }
  return out;
}

/** Preferred-rank statement first, then the first normal one. */
function best(claims: Claim[] | undefined) {
  if (!claims?.length) return undefined;
  const pick = claims.find((c) => c.rank === "preferred") ?? claims.find((c) => c.rank !== "deprecated");
  return pick?.mainsnak?.datavalue?.value;
}

function blank(): Omit<PlaceSuggestion, "source" | "ref" | "name" | "detail" | "latitude" | "longitude" | "km"> {
  return {
    address: null,
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
  };
}

async function getJson<T>(url: URL): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(4500),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
