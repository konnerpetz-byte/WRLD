import type { Getaway } from "./drive";
import type { Season } from "./seasons";

/**
 * Road-trip places approved at /admin/places (harvested from Wikidata and Wikivoyage), added to
 * the hand-picked GETAWAYS. Filled once per server process by loadApprovedPlaces() and refreshed
 * when that cache turns over; the data is the same for every visitor.
 */
export type PlaceMeta = { season: Season; vibes: string[] };

let extra: Getaway[] = [];
const meta = new Map<string, PlaceMeta>();

export function registerPlaces(list: (Getaway & PlaceMeta)[]) {
  extra = list;
  meta.clear();
  for (const p of list) meta.set(p.key, { season: p.season, vibes: p.vibes });
}

export const extraPlaces = () => extra;
export const extraMeta = (key: string) => meta.get(key);
