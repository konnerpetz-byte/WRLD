import "server-only";

import { distanceKm } from "@/lib/geo";
import { requireUserId } from "@/lib/supabase/server";
import type { Attraction } from "@/types/database";
import { IDEAS } from "./ideas";

/**
 * "Recommendations based on your travel type".
 *
 * Score out of 100:
 *   interests 55 — overlap with your weighted interests (quiz + learned)
 *   compass   30 — how close the thing's lean is to your dot
 *   trip fit  15 — near the cities of your next trip
 * Each card says why ("You like Architecture and History").
 */

export type Recommendation = {
  key: string;
  kind: "official" | "idea";
  title: string;
  blurb: string;
  why: string;
  score: number;
  /** Where the button goes */
  href: string;
  action: string;
  externalHref?: string;
  city: string | null;
  price?: { amount: number; currency: string } | null;
};

export async function getRecommendations(): Promise<{ items: Recommendation[]; nextTrip: { id: string; title: string; cities: string[] } | null }> {
  const { supabase, userId } = await requireUserId();
  const [{ data: profile }, { data: interests }, { data: tagRows }, { data: sights }, { data: trips }] = await Promise.all([
    supabase.from("traveler_profiles").select("compass_x, compass_y").eq("user_id", userId).maybeSingle(),
    supabase.from("traveler_interests").select("tag_slug, weight").eq("user_id", userId).gt("weight", 0),
    supabase.from("interest_tags").select("slug, label"),
    supabase.from("attractions").select("*"),
    supabase.from("trips").select("id, title, start_date, end_date").gte("end_date", new Date().toISOString().slice(0, 10)).order("start_date").limit(1),
  ]);
  if (profile?.compass_x == null || profile.compass_y == null) return { items: [], nextTrip: null };

  const me = { x: Number(profile.compass_x) / 5, y: Number(profile.compass_y) / 5 }; // −10…10 → −2…2
  const weight = new Map((interests ?? []).map((i) => [i.tag_slug, Number(i.weight)]));
  const maxWeight = Math.max(1, ...weight.values());
  const label = new Map((tagRows ?? []).map((t) => [t.slug, t.label]));

  const next = trips?.[0] ?? null;
  const { data: stops } = next
    ? await supabase.from("trip_stops").select("city, latitude, longitude").eq("trip_id", next.id).order("arrive_date")
    : { data: [] };
  const city = stops?.[0]?.city ?? null;

  const scoreTags = (tags: string[]) => {
    const hits = tags.filter((t) => weight.has(t)).sort((a, b) => (weight.get(b) ?? 0) - (weight.get(a) ?? 0));
    const sum = hits.reduce((s, t) => s + (weight.get(t) ?? 0), 0);
    return { value: Math.min(1, sum / (maxWeight * 2)), hits };
  };
  const scoreCompass = (x: number, y: number) => 1 - Math.min(1, Math.hypot(x - me.x, y - me.y) / Math.hypot(4, 4));
  const whyFrom = (hits: string[], fallback: string) => {
    const names = hits.slice(0, 2).map((t) => label.get(t) ?? t);
    return names.length ? `You like ${names.join(" and ")}` : fallback;
  };

  const out: Recommendation[] = [];

  for (const a of (sights ?? []) as Attraction[]) {
    const t = scoreTags(a.tags);
    const nearStop = (stops ?? []).find((s) => s.latitude != null && s.longitude != null && distanceKm({ latitude: s.latitude, longitude: s.longitude }, a) <= 120);
    const score = Math.round(55 * t.value + 30 * scoreCompass(a.lean_x, a.lean_y) + (nearStop ? 15 : 0));
    out.push({
      key: `a-${a.id}`,
      kind: "official",
      title: a.name,
      blurb: a.visit_note ?? a.hours_note ?? `${a.city}`,
      why: nearStop ? `Near ${nearStop.city} on ${next!.title}` : whyFrom(t.hits, "Fits your travel type"),
      score,
      href: nearStop ? `/trips/${next!.id}/itinerary?add=${encodeURIComponent(a.name)}` : "/trips/new",
      action: nearStop ? `Add to ${next!.title}` : `Plan a trip to ${a.city}`,
      externalHref: a.tickets_url ?? a.official_url,
      city: a.city,
      price: a.adult_price !== null ? { amount: Number(a.adult_price), currency: a.currency ?? "EUR" } : null,
    });
  }

  for (const idea of IDEAS) {
    const t = scoreTags(idea.tags);
    const score = Math.round(55 * t.value + 30 * scoreCompass(idea.x, idea.y) + (next ? 8 : 0));
    const title = city ? idea.title.replaceAll("{city}", city) : idea.title.replace(/ (above|near|in) \{city\}/, "").replaceAll("{city}'s", "The city's").replaceAll("{city}", "the city");
    out.push({
      key: `i-${idea.id}`,
      kind: "idea",
      title,
      blurb: city ? idea.blurb.replaceAll("{city}", city) : idea.blurb.replaceAll("{city}", "the city"),
      why: whyFrom(t.hits, "Matches where you sit on the compass"),
      score,
      href: next ? `/trips/${next.id}/itinerary?add=${encodeURIComponent(idea.search)}` : "/trips/new",
      action: next ? `Find one for ${next.title}` : "Plan a trip",
      city,
    });
  }

  out.sort((a, b) => b.score - a.score);
  const items = out.slice(0, 12);
  return { items, nextTrip: next ? { id: next.id, title: next.title, cities: (stops ?? []).map((s) => s.city) } : null };
}
