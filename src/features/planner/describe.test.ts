import { describe, expect, it } from "vitest";

import { describeTrip } from "./describe";

const NOW = new Date("2026-10-18T12:00:00Z");

describe("describe your trip", () => {
  it("reads a group road trip", () => {
    expect(describeTrip("8 of us, August, under $6k, lake town, 4 nights, drive", NOW)).toEqual({
      travelers: 8,
      cash: 6000,
      per: "group",
      month: "2027-08",
      nights: 4,
      go: "drive",
      vibes: ["water"],
    });
  });

  it("reads per-person budgets, weekends and places", () => {
    const d = describeTrip("Bachelorette weekend for 6 friends from Detroit to Nashville in March, $1,300 each", NOW);
    expect(d).toMatchObject({ travelers: 6, cash: 1300, per: "person", month: "2027-03", nights: 2, from: "Detroit", to: "Nashville", vibes: ["nightlife"] });
  });

  it("reads couples, long weekends and a named lake", () => {
    const d = describeTrip("me and my wife, long weekend to Torch Lake in July, hiking and wineries, 1.5k", NOW);
    expect(d).toMatchObject({ travelers: 2, nights: 3, to: "Torch Lake", month: "2027-07", cash: 1500, per: "group" });
    expect(d.vibes).toEqual(["outdoors", "food"]);
  });

  it("leaves out what it can't read", () => {
    expect(describeTrip("somewhere fun", NOW)).toEqual({});
    expect(describeTrip("December trip", NOW).month).toBe("2026-12");
  });
});
