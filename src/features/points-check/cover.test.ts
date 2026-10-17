import { describe, expect, it } from "vitest";

import { whatPointsCover } from "./cover";

describe("what do my points cover", () => {
  it("finds round trips the group's bank points can reach, best first", () => {
    const r = whatPointsCover("DTW", { chase: 60_000, bilt: 20_000 }, 1);
    expect(r.length).toBeGreaterThan(5);
    const covered = r.filter((o) => o.covered);
    expect(covered.length).toBeGreaterThan(0);
    // Every covered option spends no more than the balances it was given.
    for (const o of covered) {
      const chase = o.from.find((f) => f.bank === "Chase")?.points ?? 0;
      const bilt = o.from.find((f) => f.bank === "Bilt")?.points ?? 0;
      expect(chase).toBeLessThanOrEqual(60_000);
      expect(bilt).toBeLessThanOrEqual(20_000);
      expect(o.total).toBe(o.perPerson);
    }
    // Covered options come before the ones you're short for.
    const firstShort = r.findIndex((o) => !o.covered);
    if (firstShort >= 0) expect(r.slice(firstShort).every((o) => !o.covered)).toBe(true);
  });

  it("scales with the number of travelers and says how far short you are", () => {
    const one = whatPointsCover("JFK", { amex: 50_000 }, 1).find((o) => o.destination === "LHR");
    const four = whatPointsCover("JFK", { amex: 50_000 }, 4).find((o) => o.destination === "LHR");
    expect(one && four).toBeTruthy();
    expect(four!.total).toBe(one!.perPerson * 4);
    if (!four!.covered) expect(four!.shortBy).toBeGreaterThan(0);
  });

  it("covers nothing with no points", () => {
    expect(whatPointsCover("DTW", {}, 2).every((o) => !o.covered)).toBe(true);
  });
});
