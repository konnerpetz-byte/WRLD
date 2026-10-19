import { afterEach, describe, expect, it } from "vitest";

import { allGetaways, GETAWAYS, matchGetaways } from "./drive";
import { registerPlaces } from "./registry";
import { driveMeta } from "./vibes";

const munising = {
  key: "wd-Q1000",
  name: "Munising",
  state: "MI",
  latitude: 46.411,
  longitude: -86.648,
  tier: 1 as const,
  why: "Pictured Rocks boat tours and waterfalls",
  gem: true,
  season: "north_summer" as const,
  vibes: ["water", "outdoors"],
};

describe("approved places", () => {
  afterEach(() => registerPlaces([]));

  it("join the hand-picked list for search and matching", () => {
    expect(matchGetaways("munising")).toEqual([]);
    registerPlaces([munising]);
    expect(allGetaways()).toHaveLength(GETAWAYS.length + 1);
    expect(matchGetaways("munising")[0]?.key).toBe("wd-Q1000");
    expect(driveMeta("wd-Q1000")).toEqual({ season: "north_summer", vibes: ["water", "outdoors"] });
  });
});
