import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheLife: () => undefined }));
vi.mock("@/lib/supabase/public", () => ({ publicClient: () => null }));

import { checkLink, hostOf, type TicketPlace } from "./data";

const place = (p: Partial<TicketPlace>): TicketPlace =>
  ({
    slug: "x",
    name: "X",
    aliases: [],
    city: "Paris",
    country_code: "FR",
    official_url: null,
    tickets_url: null,
    timed_entry: true,
    best_slot: null,
    duration_minutes: null,
    hours_note: null,
    visit_note: null,
    adult_price: null,
    currency: "EUR",
    price_note: null,
    verified_on: "2026-10-12",
    ...p,
  }) as TicketPlace;

const PLACES = [
  place({ slug: "louvre", name: "Louvre Museum", official_url: "https://www.louvre.fr/en", tickets_url: "https://ticketing.louvre.fr" }),
  place({ slug: "sagrada-familia", name: "Sagrada Família", aliases: ["sagrada familia", "barcelona"], city: "Barcelona", official_url: "https://sagradafamilia.org/en/" }),
];

describe("official link check", () => {
  it("reads hosts with or without https and www", () => {
    expect(hostOf("www.louvre.fr/en")).toBe("louvre.fr");
    expect(hostOf("not a url")).toBeNull();
  });

  it("recognizes the official site and its ticket subdomain", () => {
    expect(checkLink("https://ticketing.louvre.fr/en/visit", PLACES)).toMatchObject({ kind: "official", place: { slug: "louvre" } });
    expect(checkLink("louvre.fr", PLACES).kind).toBe("official");
  });

  it("flags lookalikes that use the place's name", () => {
    expect(checkLink("https://museedulouvre-tickets.org", PLACES)).toMatchObject({ kind: "lookalike", place: { slug: "louvre" } });
    expect(checkLink("https://sagradafamilia-tickets.org/buy", PLACES)).toMatchObject({ kind: "lookalike", place: { slug: "sagrada-familia" } });
  });

  it("says it doesn't know other sites, and rejects junk", () => {
    expect(checkLink("https://example.com", PLACES).kind).toBe("unknown");
    // A city name alone isn't a lookalike: plenty of honest sites say "barcelona".
    expect(checkLink("https://www.barcelonaturisme.com", PLACES).kind).toBe("unknown");
    expect(checkLink("hello", PLACES).kind).toBe("invalid");
  });
});
