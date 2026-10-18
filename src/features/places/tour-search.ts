import "server-only";

import type { PlaceSuggestion } from "@/features/attractions/types";
import { moreLinks, viatorSearch, type ExperienceOffer } from "@/features/experiences/providers";

/**
 * Bookable tours and activities ("white water rafting", "cooking class") for the add-a-place box.
 *
 *  Viator: live listings from the Partner API (VIATOR_API_KEY), with price, rating and length,
 *    pickable like any other place. Searched as "<day's city> <what you typed>".
 *  GetYourGuide: no open search API for new partners, so we link to its search for the same
 *    words, tagged with WRLD's partner ID. Viator's search page is linked too.
 *
 * Prices are searched in USD so the listing found when you pick it is the same one the server
 * finds again when you add it (the search is cached for a few hours).
 */
export const TOUR_CURRENCY = "USD";

const length = (min: number | null) => {
  if (!min) return null;
  if (min < 90) return `${min} min`;
  const h = Math.round((min / 60) * 2) / 2;
  return `${h} hr`;
};

export function offerToSuggestion(o: ExperienceOffer, near: { latitude: number; longitude: number } | null): PlaceSuggestion {
  const rating = o.rating ? `${o.rating.toFixed(1)}★${o.reviews ? ` (${o.reviews.toLocaleString("en-US")})` : ""}` : null;
  return {
    source: "viator",
    ref: o.id,
    name: o.title,
    detail: ["Tour on Viator", rating, length(o.durationMinutes)].filter(Boolean).join(" · "),
    // Viator's search doesn't say where a tour starts; the map pin is added later from the booking.
    latitude: near?.latitude ?? 0,
    longitude: near?.longitude ?? 0,
    address: null,
    officialUrl: null,
    ticketsUrl: o.url,
    timedEntry: false,
    bestSlot: null,
    suggestedStart: null,
    durationMinutes: o.durationMinutes,
    price: o.price,
    currency: o.currency,
    priceNote: null,
    hoursNote: null,
    visitNote: null,
    km: null,
  };
}

/** Live Viator listings for what you typed, in the day's city. Empty without a Viator key. */
export async function searchTours(query: string, city: string, near: { latitude: number; longitude: number } | null, limit = 3) {
  const q = query.trim();
  if (q.length < 3) return [];
  const offers = await viatorSearch(city, q, TOUR_CURRENCY);
  return offers.filter((o) => o.provider === "viator").slice(0, limit).map((o) => offerToSuggestion(o, near));
}

/** The same listing again, looked up on the server so a price can't be edited in the browser. */
export async function findTour(city: string, query: string, productCode: string) {
  const offers = await viatorSearch(city, query.trim(), TOUR_CURRENCY);
  return offers.find((o) => o.provider === "viator" && o.id === productCode) ?? null;
}

/** Search pages on GetYourGuide and Viator for the same words, with WRLD's partner IDs. */
export function tourLinks(query: string, city: string) {
  return moreLinks(city, query.trim()).filter((l) => l.label === "GetYourGuide" || l.label === "Viator");
}
