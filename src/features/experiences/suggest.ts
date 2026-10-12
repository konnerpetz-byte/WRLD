import "server-only";

import type { TimeBlockSlot } from "@/types/database";
import { moreLinks, sampleSearch, viatorSearch, type ExperienceOffer } from "./providers";
import { isDaytimeOnly, slotHint, TAG_SEARCH } from "./terms";

export type Suggestion = ExperienceOffer & { why: string; slot: TimeBlockSlot | null; score: number };

export type SuggestionResult = {
  mode: "live" | "sample" | "links";
  offers: Suggestion[];
  links: { label: string; url: string }[];
};

/**
 * Bookable experiences in a city that fit a traveler's interests.
 * Searches the traveler's top interests (plus the city's top-rated tours),
 * then ranks by interest weight, reviews, and fit for the part of the day.
 */
export async function suggestExperiences(input: {
  city: string;
  currency: string;
  interests: { tag: string; weight: number; label: string }[];
  slot?: TimeBlockSlot | null;
  availableMinutes?: number | null;
  limit?: number;
}): Promise<SuggestionResult> {
  const top = [...input.interests]
    .filter((i) => TAG_SEARCH[i.tag])
    .sort((a, b) => b.weight - a.weight)
    // two interests that search for the same thing count once
    .filter((i, idx, all) => all.findIndex((j) => TAG_SEARCH[j.tag] === TAG_SEARCH[i.tag]) === idx)
    .slice(0, 4);
  const searches = [...top.map((i) => ({ term: TAG_SEARCH[i.tag], interest: i })), { term: "top rated tour", interest: null }];

  const batches = await Promise.all(
    searches.map(async (s) => {
      const live = await viatorSearch(input.city, s.term, input.currency);
      const found = live.length ? live : sampleSearch(input.city, s.term, input.currency);
      return found.map((o) => ({ offer: o, interest: s.interest }));
    }),
  );

  const maxWeight = Math.max(1, ...top.map((i) => i.weight));
  const seen = new Set<string>();
  const ranked: Suggestion[] = [];
  for (const { offer, interest } of batches.flat()) {
    if (seen.has(offer.id)) continue;
    seen.add(offer.id);
    const hint = slotHint(offer.title);
    const quality = offer.rating ? (offer.rating - 3.5) / 1.5 : 0.3; // 0…1 for 3.5…5 stars
    const popularity = offer.reviews ? Math.min(1, Math.log10(offer.reviews + 1) / 4) : 0.2;
    let score = 45 * (interest ? interest.weight / maxWeight : 0.3) + 25 * Math.max(0, quality) + 15 * popularity;
    if (input.slot) {
      if (hint === input.slot) score += 15;
      else if (hint && hint !== input.slot) score -= 25;
      else if (input.slot === "evening") score -= isDaytimeOnly(offer.title) ? 40 : 10;
    }
    if (input.availableMinutes && offer.durationMinutes && offer.durationMinutes > input.availableMinutes + 30) score -= 30;
    ranked.push({
      ...offer,
      slot: hint,
      score: Math.round(score),
      why: interest ? `For your love of ${interest.label.toLowerCase()}` : "Top rated in " + input.city,
    });
  }
  ranked.sort((a, b) => b.score - a.score);

  const mainTerm = top[0] ? TAG_SEARCH[top[0].tag] : "things to do";
  const mode = ranked.some((o) => o.provider === "viator") ? "live" : ranked.length ? "sample" : "links";
  return { mode, offers: ranked.slice(0, input.limit ?? 6), links: moreLinks(input.city, mainTerm) };
}
