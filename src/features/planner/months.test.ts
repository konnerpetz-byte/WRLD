import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheLife: () => undefined }));

import { monthOptions } from "@/features/awards/engine";

describe("months to plan in", () => {
  it("runs through December of next year in the fall", () => {
    const m = monthOptions(new Date("2026-10-18T12:00:00Z"));
    expect(m[0].value).toBe("2026-10");
    expect(m.at(-1)!.value).toBe("2027-12");
  });
  it("is never less than a year ahead", () => {
    const m = monthOptions(new Date("2027-03-02T12:00:00Z"));
    expect(m.length).toBe(13);
    expect(m.at(-1)!.value).toBe("2028-03");
  });
});
