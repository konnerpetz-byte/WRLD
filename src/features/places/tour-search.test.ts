import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheLife: () => undefined }));

import { offerToSuggestion } from "./tour-search";

describe("bookable tours in place search", () => {
  it("shows a Viator listing with price, rating and length, linked to Viator", () => {
    const s = offerToSuggestion(
      {
        provider: "viator",
        id: "12345P1",
        title: "Imster Schlucht White-Water Rafting",
        url: "https://www.viator.com/tours/x?pid=P1",
        imageUrl: null,
        price: 78,
        currency: "USD",
        rating: 4.8,
        reviews: 351,
        durationMinutes: 180,
        term: "white water rafting",
      },
      { latitude: 48.137, longitude: 11.575 },
    );
    expect(s).toMatchObject({ source: "viator", ref: "12345P1", price: 78, currency: "USD", ticketsUrl: "https://www.viator.com/tours/x?pid=P1", km: null });
    expect(s.detail).toBe("Tour on Viator · 4.8★ (351) · 3 hr");
  });
});
