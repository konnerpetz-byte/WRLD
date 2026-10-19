import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheLife: () => undefined }));
vi.mock("@/lib/supabase/public", () => ({ publicClient: () => null }));

import { REGIONS } from "@/features/awards/regions";

import { driveTo, GETAWAYS } from "./drive";
import { FLY_GEMS } from "./gems";
import { gsaFor, parseGsaLocation, seasonFn } from "./season-data";
import { fareSeason, hotelSeason } from "./seasons";
import { DRIVE_META, FLY_META } from "./vibes";

const DETROIT = { latitude: 42.33, longitude: -83.05 };

describe("prices by month", () => {
  it("July and August differ for lake towns and U.S. flights", () => {
    expect(hotelSeason("north_summer", "2027-07")).not.toBe(hotelSeason("north_summer", "2027-08"));
    expect(fareSeason("north_america", "2027-07")).toBeGreaterThan(fareSeason("north_america", "2027-08"));
    expect(hotelSeason("north_summer", "2027-07")).toBeGreaterThan(hotelSeason("north_summer", "2027-01"));
  });

  it("reads GSA place names and matches road-trip towns", () => {
    expect(parseGsaLocation("Pontiac / Auburn Hills (Oakland County)")).toEqual({ names: ["pontiac", "auburn hills"], county: "oakland" });
    const shapes = [
      { ...parseGsaLocation("Traverse City (Grand Traverse County)"), state: "MI", factor: 1.5 },
      { ...parseGsaLocation("Sturgeon Bay (Door County)"), state: "WI", factor: 1.3 },
    ];
    expect(gsaFor({ name: "Traverse City", state: "MI" }, shapes)?.factor).toBe(1.5);
    expect(gsaFor({ name: "Door County", state: "WI" }, shapes)?.factor).toBe(1.3);
    expect(gsaFor({ name: "Torch Lake", state: "MI" }, shapes)).toBeNull();
  });

  it("a Torch Lake weekend costs more in July than in January", () => {
    const g = GETAWAYS.find((x) => x.key === "torch-lake")!;
    const at = (month: string) => driveTo(DETROIT, g, { cash: Infinity, travelers: 2, style: "mid", season: seasonFn(month, []) })!.lengths[0].hotel;
    expect(at("2027-07")).toBeGreaterThan(at("2027-08"));
    expect(at("2027-08")).toBeGreaterThan(at("2027-01"));
  });
});

describe("trip vibes", () => {
  it("every road-trip place and flight destination has vibes", () => {
    expect(GETAWAYS.filter((g) => !DRIVE_META[g.key]?.vibes.length).map((g) => g.key)).toEqual([]);
    const codes = [...Object.values(REGIONS).flatMap((r) => [...r.airports]), ...FLY_GEMS.map((g) => g.code)];
    expect(codes.filter((c) => !FLY_META[c]?.vibes.length)).toEqual([]);
  });
});
