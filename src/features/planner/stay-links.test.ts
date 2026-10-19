import { describe, expect, it } from "vitest";

import { fridayIn, stayLinks } from "./stay-links";

describe("live stay links", () => {
  it("fills in the place, dates, people and rooms", () => {
    const [airbnb, booking, google] = stayLinks("Torch Lake, MI", "2027-08-06", 2, 8);
    expect(airbnb.url).toBe("https://www.airbnb.com/s/Torch-Lake--MI/homes?checkin=2027-08-06&checkout=2027-08-08&adults=8");
    const b = new URL(booking.url);
    expect([b.searchParams.get("ss"), b.searchParams.get("checkout"), b.searchParams.get("group_adults"), b.searchParams.get("no_rooms")]).toEqual(["Torch Lake, MI", "2027-08-08", "8", "4"]);
    expect(new URL(google.url).searchParams.get("q")).toBe("hotels in Torch Lake, MI Aug 6, 2027 to Aug 8, 2027 for 8");
  });
  it("weekends start on a Friday in the chosen month", () => {
    expect(fridayIn("2027-08", new Date("2026-10-18T12:00:00Z"))).toBe("2027-08-06");
    expect(fridayIn("2026-10", new Date("2026-10-18T12:00:00Z"))).toBe("2026-10-30");
  });
});
