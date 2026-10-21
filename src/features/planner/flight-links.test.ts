import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheLife: () => {} }));

const { aviasalesSearchUrl, plainFlightLinks } = await import("./flight-links");

describe("flight links", () => {
  it("builds an Aviasales round-trip search for the dates and group", () => {
    expect(aviasalesSearchUrl("DTW", "BOS", "2026-11-13", 4, 2)).toBe("https://www.aviasales.com/search/DTW1311BOS17112");
    expect(aviasalesSearchUrl("DTW", "LIS", "2026-12-30", 5, 12)).toBe("https://www.aviasales.com/search/DTW3012LIS04019");
  });
  it("offers Aviasales first, then Google Flights", () => {
    expect(plainFlightLinks({ origin: "DTW", destination: "BOS", depart: "2026-11-13", nights: 4, adults: 2 }).map((l) => l.label)).toEqual(["Aviasales", "Google Flights"]);
  });
});
