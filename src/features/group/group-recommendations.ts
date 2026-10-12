import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { suggestExperiences } from "@/features/experiences/suggest";
import { IDEA_PLACES, namedPlaces } from "@/features/places/named-places";
import { IDEAS } from "@/features/recommendations/ideas";
import { distanceKm } from "@/lib/geo";
import type { Attraction, Database } from "@/types/database";
import type { Traveler } from "./compatibility";

/**
 * Recommendations for the whole group.
 *
 * Each thing gets a personal score per traveler (same formula as "your
 * travel type": interests 55 + compass 30 + 15 for being on the route), then
 * a group score = 60% the average + 40% the lowest, so nothing that one
 * person would hate floats to the top.
 */

export type GroupPick = {
  key: string;
  kind: "official" | "idea" | "bookable";
  title: string;
  blurb: string;
  city: string | null;
  score: number;
  suits: string[];
  why: string;
  href: string;
  action: string;
  externalHref?: string;
  price?: string | null;
};

type Stop = { city: string; latitude: number | null; longitude: number | null };

export async function groupRecommendations(
  supabase: SupabaseClient<Database>,
  tripId: string,
  travelers: Traveler[],
  stops: Stop[],
  currency: string,
): Promise<{ picks: GroupPick[]; bookingMode: "live" | "sample" | "links" | null }> {
  const typed = travelers.filter((t) => t.x !== null && t.y !== null);
  if (!typed.length) return { picks: [], bookingMode: null };

  const [{ data: sights }, { data: tags }] = await Promise.all([
    supabase.from("attractions").select("*"),
    supabase.from("interest_tags").select("slug, label"),
  ]);
  const label = new Map((tags ?? []).map((t) => [t.slug, t.label]));
  const placed = stops.filter((s) => s.latitude !== null && s.longitude !== null) as { city: string; latitude: number; longitude: number }[];
  const firstCity = stops[0]?.city ?? null;

  const personal = (t: Traveler, itemTags: string[], x: number, y: number) => {
    const max = Math.max(1, ...Object.values(t.interests));
    const hits = itemTags.filter((tag) => t.interests[tag]);
    const tagValue = Math.min(1, hits.reduce((s, tag) => s + t.interests[tag], 0) / (max * 2));
    const me = { x: t.x! / 5, y: t.y! / 5 };
    const compass = 1 - Math.min(1, Math.hypot(x - me.x, y - me.y) / Math.hypot(4, 4));
    return { score: 55 * tagValue + 30 * compass, hits };
  };

  const rate = (itemTags: string[], x: number, y: number, bonus: number) => {
    const per = typed.map((t) => ({ t, ...personal(t, itemTags, x, y) }));
    const mean = per.reduce((s, p) => s + p.score, 0) / per.length;
    const min = Math.min(...per.map((p) => p.score));
    const score = Math.round(0.6 * mean + 0.4 * min + bonus);
    const suits = per.filter((p) => p.score >= 45).map((p) => p.t.name.split(" ")[0]);
    const sharedHit = itemTags.find((tag) => per.filter((p) => p.hits.includes(tag)).length >= Math.max(2, Math.ceil(per.length / 2)));
    const why =
      suits.length === per.length
        ? sharedHit
          ? `Everyone likes ${label.get(sharedHit) ?? sharedHit}`
          : "A fit for the whole group"
        : suits.length
          ? `Great for ${listNames(suits)}`
          : "A middle-ground pick";
    return { score, suits, why };
  };

  const picks: GroupPick[] = [];

  for (const a of (sights ?? []) as Attraction[]) {
    const near = placed.find((s) => distanceKm(s, a) <= 120);
    if (!near) continue; // only sights on this trip's route
    const r = rate(a.tags, a.lean_x, a.lean_y, 15);
    picks.push({
      key: `a-${a.id}`,
      kind: "official",
      title: a.name,
      blurb: a.visit_note ?? a.city,
      city: a.city,
      ...r,
      href: `/trips/${tripId}/itinerary?add=${encodeURIComponent(a.name)}`,
      action: "Add to itinerary",
      externalHref: a.tickets_url ?? a.official_url,
    });
  }

  for (const idea of IDEAS) {
    const r = rate(idea.tags, idea.x, idea.y, firstCity ? 5 : 0);
    picks.push({
      key: `i-${idea.id}`,
      kind: "idea",
      title: firstCity ? idea.title.replaceAll("{city}", firstCity) : idea.title.replaceAll("{city}'s", "The city's").replaceAll("{city}", "the city"),
      blurb: idea.blurb.replaceAll("{city}", firstCity ?? "the city"),
      city: firstCity,
      ...r,
      href: `/trips/${tripId}/itinerary?add=${encodeURIComponent(idea.search)}`,
      action: "Find one",
    });
  }

  picks.sort((a, b) => b.score - a.score);
  // Keep variety: at most 6 official sights, fill the rest with ideas.
  const official = picks.filter((p) => p.kind === "official").slice(0, 6);
  const ideas = picks.filter((p) => p.kind === "idea").slice(0, 9 - Math.min(official.length, 6));
  const firstPoint = placed[0];
  const named = firstPoint
    ? await Promise.all(
        ideas.map(async (p) => {
          const id = p.key.slice(2);
          if (!IDEA_PLACES[id]) return p;
          const places = await namedPlaces(id, firstPoint.latitude, firstPoint.longitude, 3);
          return places.length ? { ...p, blurb: `Try ${places.map((x) => x.name).join(", ")}.` } : p;
        }),
      )
    : ideas;
  const top = [...official, ...named].sort((a, b) => b.score - a.score);

  // Bookable tours matched to the group's combined interests.
  let bookingMode: "live" | "sample" | "links" | null = null;
  if (firstCity) {
    const merged = new Map<string, number>();
    for (const t of typed) for (const [tag, w] of Object.entries(t.interests)) merged.set(tag, (merged.get(tag) ?? 0) + w);
    const interests = [...merged.entries()].map(([tag, weight]) => ({ tag, weight, label: label.get(tag) ?? tag }));
    if (interests.length) {
      const booked = await suggestExperiences({ city: firstCity, currency, interests, limit: 3 });
      bookingMode = booked.mode;
      for (const o of booked.offers) {
        top.push({
          key: `b-${o.provider}-${o.id}`,
          kind: "bookable",
          title: o.title,
          blurb: o.why,
          city: firstCity,
          score: o.score,
          suits: [],
          why: "Matches what your group likes",
          href: `/trips/${tripId}/itinerary?add=${encodeURIComponent(o.title)}`,
          action: "Add to itinerary",
          externalHref: o.url,
          price: o.price !== null ? new Intl.NumberFormat("en-US", { style: "currency", currency: o.currency }).format(o.price) : null,
        });
      }
    }
  }

  return { picks: top, bookingMode };
}

function listNames(names: string[]) {
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
