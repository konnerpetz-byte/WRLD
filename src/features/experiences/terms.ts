import type { TimeBlockSlot } from "@/types/database";

/** What to search booking sites for, per travel interest (public.interest_tags). */
export const TAG_SEARCH: Record<string, string> = {
  hiking: "hiking tour",
  viewpoints: "panoramic viewpoint tour",
  camping: "overnight camping trip",
  kayaking: "kayak tour",
  water_sports: "surf lesson",
  wildlife: "wildlife tour",
  road_trips: "day trip",
  beaches: "beach day trip",
  stargazing: "stargazing tour",
  scenic_journeys: "boat cruise",
  picnics: "picnic experience",
  museums: "museum tickets",
  landmarks: "skip the line tickets",
  history: "history walking tour",
  art: "art tour",
  architecture: "architecture walking tour",
  walking_tours: "walking tour",
  shopping: "shopping tour",
  markets: "market tour",
  bookstores: "literary walking tour",
  neighborhoods: "neighborhood walking tour",
  cafes: "coffee tour",
  street_food: "food tour",
  fine_dining: "dinner experience",
  wine: "wine tasting",
  cooking_classes: "cooking class",
  nightlife: "pub crawl",
  live_music: "live music show",
  wellness: "spa day",
  relaxation: "sunset cruise",
};

const EVENING = /\b(dinner|night|nighttime|sunset|evening|show|concert|fado|flamenco|jazz|pub|bar|crawl|cocktail|stargazing)\b/i;
const MORNING = /\b(sunrise|morning|breakfast|early)\b/i;
/** Things that close before dinner: museums, timed tickets, outdoor day trips. */
const DAYTIME = /\b(museum|tickets?|skip the line|hik(e|ing)|kayak|day trip|beach|market|surf|wildlife|cooking class)\b/i;

export function isDaytimeOnly(title: string) {
  return DAYTIME.test(title) && !EVENING.test(title);
}

/** Which part of the day an experience suits, from its title. */
export function slotHint(title: string): TimeBlockSlot | null {
  if (EVENING.test(title)) return "evening";
  if (MORNING.test(title)) return "morning";
  return null;
}
