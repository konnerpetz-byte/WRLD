import { describe, expect, it } from "vitest";

import type { CashFare } from "@/features/awards/cash-fares";
import { fxFrom } from "@/features/awards/fees";

import { priceTrips } from "./plan";

const fare = (destination: string, price: number, origin = "DTW"): CashFare => ({
  origin,
  destination,
  date: "2027-03-12",
  price,
  airline: "DL",
  flight: "DL100",
  stops: 0,
  durationMin: 120,
});
const input = { home: "DTW", cash: 5000, points: {}, nights: 3, travelers: 2, style: "mid" as const, month: "2027-03", region: "anywhere" as const, only: "BOS" };
const network = { known: new Set<string>(), edges: [] };
const fx = fxFrom(new Map());

describe("flight prices", () => {
  it("uses a real round-trip fare instead of doubling one leg", () => {
    const [t] = priceTrips(input, network, [fare("BOS", 120)], fx, [], null, [fare("BOS", 199)]);
    expect(t.fareIs).toBe("live");
    expect(t.fullPrice).toBeGreaterThan(0);
    const [half] = priceTrips(input, network, [fare("BOS", 120)], fx, [], null, []);
    expect(half.fareIs).toBe("half");
    // Round trip $199 each vs doubled one-way $240 each, for 2 people
    expect(half.fullPrice - t.fullPrice).toBe((240 - 199) * 2);
  });

  it("prefers both real legs when it has them", () => {
    const [t] = priceTrips(input, network, [fare("BOS", 120)], fx, [fare("DTW", 90, "BOS")], null, [fare("BOS", 400)]);
    expect(t.fareIs).toBe("live");
  });
});
