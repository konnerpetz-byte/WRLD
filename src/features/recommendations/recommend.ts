import "server-only";

import { distanceKm } from "@/lib/geo";
import { requireUserId } from "@/lib/supabase/server";
import type { Attraction } from "@/types/database";
import { myInterests } from "@/features/experiences/for-trip";
import { suggestExperiences } from "@/features/experiences/suggest";
import { IDEA_PLACES, type NamedPlace, namedPlaces } from "@/features/places/named-places";
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
  kind: "official" | "idea" | "bookable";
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
  /** Bookable listings (Viator…) */
  provider?: "viator" | "sample";
  rating?: number | null;
  reviews?: number | null;
  imageUrl?: string | null;
  durationMinutes?: number | null;
  addToTrip?: { tripId: string; city: string; offerId: string; tripTitle: string };
  /** One-tap add: an official sight, or real named places for an idea. */
  tripId?: string;
  attractionId?: string;
  places?: NamedPlace[];
};

export async function getRecommendations(): Promise<{
  items: Recommendation[];
  nextTrip: { id: string; title: string; cities: string[] } | null;
  bookingLinks: { label: string; url: string }[];
  bookingMode: "live" | "sample" | "links" | null;
}> {
  const { supabase, userId } = await requireUserId();
  const [{ data: profile }, { data: interests }, { data: tagRows }, { data: sights }, { data: trips }] = await Promise.all([
    supabase.from("traveler_profiles").select("compass_x, compass_y").eq("user_id", userId).maybeSingle(),
    supabase.from("traveler_interests").select("tag_slug, weight").eq("user_id", userId).gt("weight", 0),
    supabase.from("interest_tags").select("slug, label"),
    supabase.from("attractions").select("*"),
    supabase.from("trips").select("id, title, start_date, end_date").gte("end_date", new Date().toISOString().slice(0, 10)).order("start_date").limit(1),
  ]);
  if (profile?.compass_x == null || profile.compass_y == null) return { items: [], nextTrip: null, bookingLinks: [], bookingMode: null };

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
      ...(nearStop ? { tripId: next!.id, attractionId: a.id } : {}),
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
  let items = out.slice(0, 12);

  // Name real places for the top ideas ("Café crawl" → three cafés in the trip's first city).
  const first = stops?.find((s) => s.latitude != null && s.longitude != null);
  if (first) {
    items = await Promise.all(
      items.map(async (r) => {
        const ideaId = r.kind === "idea" ? r.key.slice(2) : null;
        if (!ideaId || !IDEA_PLACES[ideaId]) return r;
        const places = await namedPlaces(ideaId, first.latitude!, first.longitude!, 3);
        return places.length ? { ...r, places, tripId: next?.id } : r;
      }),
    );
  }

  // Bookable tours and classes in the next trip's first city, matched to the same interests.
  let bookingLinks: { label: string; url: string }[] = [];
  let bookingMode: "live" | "sample" | "links" | null = null;
  if (next && city) {
    const { data: tripRow } = await supabase.from("trips").select("currency").eq("id", next.id).single();
    const booked = await suggestExperiences({
      city,
      currency: tripRow?.currency ?? "USD",
      interests: await myInterests(supabase, userId),
      limit: 4,
    });
    bookingLinks = booked.links;
    bookingMode = booked.mode;
    const bookable: Recommendation[] = booked.offers.map((o) => ({
      key: `b-${o.provider}-${o.id}`,
      kind: "bookable",
      title: o.title,
      blurb: "",
      why: o.why,
      score: o.score,
      href: o.url,
      action: `Add to ${next.title}`,
      externalHref: o.url,
      city,
      price: o.price !== null ? { amount: o.price, currency: o.currency } : null,
      provider: o.provider,
      rating: o.rating,
      reviews: o.reviews,
      imageUrl: o.imageUrl,
      durationMinutes: o.durationMinutes,
      addToTrip: { tripId: next.id, city, offerId: o.id, tripTitle: next.title },
    }));
    // Show bookable picks early: every other card.
    const mixed: Recommendation[] = [];
    const rest = [...items];
    while (bookable.length || rest.length) {
      if (rest.length) mixed.push(rest.shift()!);
      if (bookable.length) mixed.push(bookable.shift()!);
    }
    items = mixed.slice(0, 14);
  }
  return {
    items,
    nextTrip: next ? { id: next.id, title: next.title, cities: (stops ?? []).map((s) => s.city) } : null,
    bookingLinks,
    bookingMode,
  };
}
