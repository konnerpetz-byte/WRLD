import { describe, expect, it } from "vitest";

import { placeLabel } from "./place-label";

describe("place labels", () => {
  it("adds the country abroad and the state at home", () => {
    expect(placeLabel("MDE", "Medellín", "CO")).toBe("Medellín, Colombia");
    expect(placeLabel("SAV", "Savannah", "US")).toBe("Savannah, GA");
    expect(placeLabel("PWM", "Portland, Maine", "US")).toBe("Portland, ME");
    expect(placeLabel("LIR", "Liberia, Costa Rica", "CR")).toBe("Liberia, Costa Rica");
    expect(placeLabel("SJU", "San Juan", "PR")).toBe("San Juan, Puerto Rico");
    expect(placeLabel("YYZ", "Toronto", "CA")).toBe("Toronto, Canada");
  });
  it("doesn't repeat a city-state", () => {
    expect(placeLabel("SIN", "Singapore", "SG")).toBe("Singapore");
    expect(placeLabel("HKG", "Hong Kong", "HK")).toBe("Hong Kong");
    expect(placeLabel("NAN", "Fiji", "FJ")).toBe("Fiji");
  });
});
