import { describe, expect, it } from "vitest";

import { driveTo, driveTrips, formatDrive, matchGetaways, GAS_PRICE, MPG, nearestState } from "./drive";

const DETROIT = { latitude: 42.33, longitude: -83.05 };

describe("road trips", () => {
  it("finds drivable weekend getaways for a $600 budget", () => {
    const trips = driveTrips(DETROIT, { cash: 600, travelers: 2, style: "budget" });
    const fits = trips.filter((t) => t.best);
    expect(fits.length).toBeGreaterThan(3);
    for (const t of fits) {
      expect(t.best!.total).toBeLessThanOrEqual(600);
      expect(t.hours).toBeLessThanOrEqual(7);
    }
    // Nothing a weekend drive can't reach, and nothing across the country.
    expect(trips.some((t) => t.getaway.key === "seattle")).toBe(false);
    expect(fits.some((t) => ["traverse-city", "grand-rapids", "cleveland", "hocking-hills", "chicago"].includes(t.getaway.key))).toBe(true);
  });

  it("prices gas per car and rooms per two people", () => {
    const [one] = driveTrips(DETROIT, { cash: 5000, travelers: 4, style: "mid" }).filter((t) => t.getaway.key === "chicago");
    const l = one.lengths.find((x) => x.nights === 2)!;
    expect(l.gas).toBe(Math.round(((one.roadMiles * 2) / MPG) * GAS_PRICE));
    expect(l.hotel).toBe(225 * 2 * 2);
    expect(l.days).toBe(115 * 4 * 3);
    const [five] = driveTrips(DETROIT, { cash: 5000, travelers: 5, style: "mid" }).filter((t) => t.getaway.key === "chicago");
    expect(five.lengths[0].gas).toBe(l.gas * 2);
  });

  it("uses home and destination gas prices", () => {
    const gas = { home: 4, at: (st: string) => (st === "IL" ? 5 : 4) };
    const [c] = driveTrips(DETROIT, { cash: 5000, travelers: 2, style: "mid" }, gas).filter((t) => t.getaway.key === "chicago");
    expect(c.gasPrice).toBe(4.5);
    expect(c.lengths[0].gas).toBe(Math.round(((c.roadMiles * 2) / MPG) * 4.5));
    expect(nearestState(DETROIT)).toMatch(/MI|OH/);
  });

  it("puts trips that fit first, longest first", () => {
    const trips = driveTrips(DETROIT, { cash: 900, travelers: 2, style: "budget" });
    const firstMiss = trips.findIndex((t) => !t.best);
    if (firstMiss > 0) expect(trips.slice(firstMiss).every((t) => !t.best)).toBe(true);
    expect(formatDrive(3.5)).toBe("3 hr 30 min");
    expect(formatDrive(0.75)).toBe("45 min");
  });
});

describe("road trip to a place you name", () => {
  const DETROIT = { latitude: 42.33, longitude: -83.05 };
  it("finds Torch Lake however it's typed", () => {
    for (const q of ["torch lake", "Torch Lake, MI", "torch", "Torch Lake Michigan"]) expect(matchGetaways(q)[0]?.key).toBe("torch-lake");
  });
  it("prices the drive for the trip length you asked for", () => {
    const g = matchGetaways("torch lake")[0];
    const o = driveTo(DETROIT, g, { cash: Infinity, travelers: 2, style: "mid", nights: 4 })!;
    expect(o.lengths.map((l) => l.nights)).toEqual([2, 3, 4]);
    expect(o.hours).toBeGreaterThan(3);
    expect(o.hours).toBeLessThan(5);
  });
});

describe("groups rent a house", () => {
  const DETROIT = { latitude: 42.33, longitude: -83.05 };
  it("prices a vacation house for 8 when it's cheaper than 4 hotel rooms, and hotel rooms for 2", () => {
    const g = matchGetaways("torch lake")[0];
    const eight = driveTo(DETROIT, g, { cash: Infinity, travelers: 8, style: "mid" })!.lengths[0];
    const two = driveTo(DETROIT, g, { cash: Infinity, travelers: 2, style: "mid" })!.lengths[0];
    expect(eight.stay).toBe("rental");
    expect(eight.hotel).toBeLessThan(4 * 165 * 2);
    expect(two.stay).toBe("hotel");
  });
});
