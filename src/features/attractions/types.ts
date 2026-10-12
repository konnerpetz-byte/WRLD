import type { TimeBlockSlot } from "@/types/database";

/** One suggestion in the "add a place" search and the Explore nearby list. */
export type PlaceSuggestion = {
  /** "official": hand-checked WRLD listing. "wikidata": official website from Wikidata. "nearby": a notable place from Wikipedia. */
  source: "official" | "wikidata" | "nearby";
  /** attractions.id for official, a Wikidata Q-id otherwise */
  ref: string;
  name: string;
  /** City for official listings, a short description otherwise */
  detail: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  officialUrl: string | null;
  ticketsUrl: string | null;
  timedEntry: boolean;
  bestSlot: TimeBlockSlot | null;
  suggestedStart: string | null; // "09:30"
  durationMinutes: number | null;
  price: number | null;
  currency: string | null;
  priceNote: string | null;
  hoursNote: string | null;
  visitNote: string | null;
  /** Distance from the reference point, when one was given */
  km: number | null;
};

export const SLOT_LABEL: Record<TimeBlockSlot, string> = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" };

export function hostOf(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
