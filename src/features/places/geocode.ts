import "server-only";

import { distanceKm } from "@/lib/geo";

/**
 * Turns a place name into map coordinates using Photon (OpenStreetMap data).
 * The public Photon server is free and needs no key, but it's shared and
 * rate-limited — fine for building and testing. Before launch, point
 * GEOCODER_URL at a paid service or a self-hosted Photon.
 */

export type Place = { latitude: number; longitude: number; label: string; address: string | null };

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    osm_value?: string;
  };
};

const ENDPOINT = process.env.GEOCODER_URL ?? "https://photon.komoot.io/api/";

export async function geocode(
  query: string,
  options: { near?: { latitude: number; longitude: number } | null; maxKmFromNear?: number } = {},
): Promise<Place | null> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "1");
  url.searchParams.set("lang", "en");
  if (options.near) {
    url.searchParams.set("lat", String(options.near.latitude));
    url.searchParams.set("lon", String(options.near.longitude));
  }

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "WRLD trip planner (contact via app)" },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { features?: PhotonFeature[] };
    const hit = data.features?.[0];
    if (!hit) return null;

    const [longitude, latitude] = hit.geometry.coordinates;
    // A museum search shouldn't land in another country.
    if (options.near && options.maxKmFromNear && distanceKm(options.near, { latitude, longitude }) > options.maxKmFromNear) {
      return null;
    }
    const p = hit.properties;
    const street = [p.housenumber, p.street].filter(Boolean).join(" ");
    return {
      latitude,
      longitude,
      label: p.name ?? query,
      address: [street || null, p.city, p.country].filter(Boolean).join(", ") || null,
    };
  } catch {
    return null; // Map placement is a nice-to-have; never block saving.
  }
}
