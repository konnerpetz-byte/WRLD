import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheLife: () => undefined }));

import { type PhotonFeature, toSuggestions } from "./name-search";

const MUNICH = { latitude: 48.137, longitude: 11.575 };
const f = (name: string, osm_key: string, osm_value: string, lng: number, lat: number, extra: Partial<PhotonFeature["properties"]> = {}): PhotonFeature => ({
  geometry: { coordinates: [lng, lat] },
  properties: { name, osm_key, osm_value, ...extra },
});

describe("named place search", () => {
  it("finds a restaurant by name, with its kind and address", () => {
    const [s] = toSuggestions(
      [f("Augustiner Stammhaus", "amenity", "restaurant", 11.5707, 48.1387, { street: "Neuhauser Straße", housenumber: "27", city: "Munich" })],
      MUNICH,
    );
    expect(s).toMatchObject({ source: "osm", name: "Augustiner Stammhaus", address: "Neuhauser Straße 27, Munich" });
    expect(s.detail).toContain("Restaurant");
    expect(s.ref).toBe("48.138700,11.570700");
    expect(s.km).toBeLessThan(1);
  });

  it("skips streets, towns and parking, and stays near the day's city", () => {
    const out = toSuggestions(
      [
        f("Augustinerstraße", "highway", "residential", 11.57, 48.13),
        f("Augustiner", "place", "village", 11.6, 48.2),
        f("Augustiner Parkplatz", "amenity", "parking", 11.57, 48.13),
        f("Hofbräuhaus", "amenity", "restaurant", -115.152, 36.111),
        f("Hofbräuhaus München", "amenity", "biergarten", 11.5797, 48.1376),
      ],
      MUNICH,
    );
    expect(out.map((s) => s.name)).toEqual(["Hofbräuhaus München"]);
    expect(out[0].detail).toContain("Beer garden");
  });
});
