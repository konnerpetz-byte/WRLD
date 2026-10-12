import "server-only";

import { distanceKm } from "@/lib/geo";

/**
 * Turns a place name or street address into map coordinates.
 *
 *   1. Photon (OpenStreetMap data) — fast, typo-tolerant, good with names
 *   2. Nominatim (OpenStreetMap) — better with full street addresses
 *
 * Both public servers are free and need no key, but they're shared and
 * rate-limited (Nominatim: 1 request/second, identify your app). Fine for
 * building and testing. Before launch, point GEOCODER_URL / NOMINATIM_URL
 * at a paid service or self-hosted instances.
 */

export type Place = {
  latitude: number;
  longitude: number;
  label: string;
  address: string | null;
  countryCode: string | null;
  city: string | null;
};

type Near = { latitude: number; longitude: number } | null | undefined;

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    osm_value?: string;
  };
};

const PHOTON = process.env.GEOCODER_URL ?? "https://photon.komoot.io/api/";
const NOMINATIM = process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org/search";
const USER_AGENT = process.env.GEOCODER_USER_AGENT ?? "WRLD trip planner (https://wrldtrips.com)";

/** Default: a sight on a Lisbon day shouldn't land in another country. */
const DEFAULT_MAX_KM = 150;

export async function geocode(
  query: string,
  options: { near?: Near; maxKmFromNear?: number } = {},
): Promise<Place | null> {
  const q = query.trim();
  if (!q) return null;
  const maxKm = options.maxKmFromNear ?? DEFAULT_MAX_KM;
  const ok = (p: Place | null) =>
    p && (!options.near || distanceKm(options.near, p) <= maxKm) ? p : null;

  // Street addresses ("Rua X 12, 2710 Sintra") go to Nominatim first.
  const looksLikeAddress = /\d/.test(q) && q.includes(",");
  const order = looksLikeAddress ? [nominatim, photon] : [photon, nominatim];
  for (const search of order) {
    const hit = ok(await search(q, options.near));
    if (hit) return hit;
  }
  return null;
}

/** City suggestions for the trip form ("Lis" → Lisbon, Portugal). */
export async function searchCities(query: string, limit = 6): Promise<Place[]> {
  const url = new URL(PHOTON);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("lang", "en");
  url.searchParams.set("layer", "city");
  const data = await getJson<{ features?: PhotonFeature[] }>(url);
  return (data?.features ?? []).map(fromPhoton);
}

async function photon(query: string, near: Near): Promise<Place | null> {
  const url = new URL(PHOTON);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "1");
  url.searchParams.set("lang", "en");
  if (near) {
    url.searchParams.set("lat", String(near.latitude));
    url.searchParams.set("lon", String(near.longitude));
  }
  const data = await getJson<{ features?: PhotonFeature[] }>(url);
  const hit = data?.features?.[0];
  return hit ? fromPhoton(hit) : null;
}

type NominatimHit = {
  lat: string;
  lon: string;
  name?: string;
  display_name?: string;
  address?: { road?: string; house_number?: string; city?: string; town?: string; village?: string; country?: string; country_code?: string };
};

async function nominatim(query: string, near: Near): Promise<Place | null> {
  const url = new URL(NOMINATIM);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "en");
  if (near) {
    // Prefer (don't require) results within ~1° of the stop.
    const { latitude: la, longitude: lo } = near;
    url.searchParams.set("viewbox", [lo - 1, la + 1, lo + 1, la - 1].join(","));
  }
  const hits = await getJson<NominatimHit[]>(url);
  const hit = hits?.[0];
  if (!hit) return null;
  const a = hit.address ?? {};
  const city = a.city ?? a.town ?? a.village ?? null;
  const street = [a.road, a.house_number].filter(Boolean).join(" ");
  return {
    latitude: Number(hit.lat),
    longitude: Number(hit.lon),
    label: hit.name || query,
    address: [street || null, city, a.country].filter(Boolean).join(", ") || hit.display_name || null,
    countryCode: a.country_code?.toUpperCase() ?? null,
    city,
  };
}

function fromPhoton(f: PhotonFeature): Place {
  const [longitude, latitude] = f.geometry.coordinates;
  const p = f.properties;
  const street = [p.street, p.housenumber].filter(Boolean).join(" ");
  const isPlace = p.osm_value && ["city", "town", "village", "hamlet", "municipality"].includes(p.osm_value);
  return {
    latitude,
    longitude,
    label: p.name ?? p.city ?? "",
    address: [street || null, p.postcode && street ? p.postcode : null, p.city, p.country].filter(Boolean).join(", ") || null,
    countryCode: p.countrycode?.toUpperCase() ?? null,
    city: isPlace ? (p.name ?? null) : (p.city ?? null),
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
    return null; // Map placement is a nice-to-have; never block saving.
  }
}
