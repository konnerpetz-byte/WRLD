import "server-only";

import { type NamedPlace, IDEA_PLACES, namedPlaces } from "@/features/places/named-places";
import { IDEAS } from "@/features/recommendations/ideas";
import type { requireUserId } from "@/lib/supabase/server";
import type { TimeBlockSlot } from "@/types/database";
import { suggestExperiences, type SuggestionResult } from "./suggest";

export type IdeaWithPlaces = { id: string; title: string; blurb: string; why: string; places: NamedPlace[] };

/** Ideas that suit each part of the day (others still count, just ranked lower). */
const SLOT_FIT: Record<TimeBlockSlot, string[]> = {
  morning: ["cafe-morning", "market", "sunrise-hike", "big-museum", "park-picnic", "architecture", "bookshop", "wildlife"],
  afternoon: ["small-gallery", "big-museum", "park-picnic", "bookshop", "beach-day", "hot-springs", "architecture", "wildlife"],
  evening: ["special-dinner", "wine", "live-music"],
};

type Supabase = Awaited<ReturnType<typeof requireUserId>>["supabase"];

/** The signed-in traveler's interests, strongest first (falls back to crowd favorites before the quiz). */
export async function myInterests(supabase: Supabase, userId: string) {
  const [{ data: rows }, { data: tags }] = await Promise.all([
    supabase.from("traveler_interests").select("tag_slug, weight").eq("user_id", userId).gt("weight", 0),
    supabase.from("interest_tags").select("slug, label"),
  ]);
  const label = new Map((tags ?? []).map((t) => [t.slug, t.label]));
  const list = (rows ?? []).map((r) => ({ tag: r.tag_slug, weight: Number(r.weight), label: label.get(r.tag_slug) ?? r.tag_slug }));
  if (list.length) return list;
  return ["landmarks", "street_food", "walking_tours"].map((tag, i) => ({ tag, weight: 3 - i, label: label.get(tag) ?? tag }));
}

/** Suggestions for one Morning/Afternoon/Evening block: that day's city, the trip currency, the block's free time. */
export async function suggestionsForBlock(
  supabase: Supabase,
  userId: string,
  tripId: string,
  blockId: string,
  limit = 5,
): Promise<(SuggestionResult & { city: string; ideas: IdeaWithPlaces[]; near: string | null }) | null> {
  const { data: block } = await supabase
    .from("time_blocks")
    .select("slot, day_id, available_minutes, trip_id")
    .eq("id", blockId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (!block) return null;
  const [{ data: day }, { data: trip }] = await Promise.all([
    supabase.from("trip_days").select("stop_id").eq("id", block.day_id).single(),
    supabase.from("trips").select("currency, destination").eq("id", tripId).single(),
  ]);
  const { data: stop } = day?.stop_id
    ? await supabase.from("trip_stops").select("city, latitude, longitude").eq("id", day.stop_id).maybeSingle()
    : { data: null };
  const city = stop?.city ?? trip?.destination?.split(" · ")[0] ?? null;
  if (!city || !trip) return null;

  const interests = await myInterests(supabase, userId);
  const [result, picks] = await Promise.all([
    suggestExperiences({
      city,
      currency: trip.currency,
      interests,
      slot: block.slot,
      availableMinutes: block.available_minutes,
      limit,
    }),
    ideasForBlock(supabase, userId, tripId, blockId, block.slot, interests, stop?.latitude != null && stop.longitude != null ? { latitude: stop.latitude, longitude: stop.longitude } : null),
  ]);
  return { ...result, city, ideas: picks.ideas, near: picks.near };
}

/**
 * "Picked for your travel type": the ideas that best fit the traveler and
 * this part of the day, each with real places near that night's stay (or
 * the city center when no stay is booked).
 */
async function ideasForBlock(
  supabase: Supabase,
  userId: string,
  tripId: string,
  blockId: string,
  slot: TimeBlockSlot,
  interests: { tag: string; weight: number }[],
  cityPoint: { latitude: number; longitude: number } | null,
): Promise<{ ideas: IdeaWithPlaces[]; near: string | null }> {
  const [{ data: profile }, { data: block }] = await Promise.all([
    supabase.from("traveler_profiles").select("compass_x, compass_y").eq("user_id", userId).maybeSingle(),
    supabase.from("time_blocks").select("starts_at").eq("id", blockId).maybeSingle(),
  ]);
  const { data: stays } = block
    ? await supabase
        .from("lodging")
        .select("name, latitude, longitude")
        .eq("trip_id", tripId)
        .neq("booking_status", "cancelled")
        .lte("check_in_at", block.starts_at)
        .gt("check_out_at", block.starts_at)
        .not("latitude", "is", null)
        .limit(1)
    : { data: [] };
  const stay = stays?.[0];
  const at = stay?.latitude != null && stay.longitude != null ? { latitude: stay.latitude, longitude: stay.longitude } : cityPoint;
  if (!at) return { ideas: [], near: null };

  const weight = new Map(interests.map((i) => [i.tag, i.weight]));
  const label = new Map(interests.map((i) => [i.tag, (i as { label?: string }).label ?? i.tag]));
  const maxW = Math.max(1, ...weight.values());
  const me = profile?.compass_x != null && profile.compass_y != null ? { x: Number(profile.compass_x) / 5, y: Number(profile.compass_y) / 5 } : { x: 0, y: 0 };
  const ranked = IDEAS.filter((i) => IDEA_PLACES[i.id])
    .map((idea) => {
      const hits = idea.tags.filter((t) => weight.has(t)).sort((a, b) => (weight.get(b) ?? 0) - (weight.get(a) ?? 0));
      const tagValue = Math.min(1, hits.reduce((s, t) => s + (weight.get(t) ?? 0), 0) / (maxW * 2));
      const compass = 1 - Math.min(1, Math.hypot(idea.x - me.x, idea.y - me.y) / Math.hypot(4, 4));
      const fit = SLOT_FIT[slot].indexOf(idea.id);
      const score = 55 * tagValue + 30 * compass + (fit >= 0 ? 15 - fit : -20);
      return { idea, score, hits };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const withPlaces = await Promise.all(ranked.map(async (r) => ({ ...r, places: await namedPlaces(r.idea.id, at.latitude, at.longitude, 3) })));
  const ideas = withPlaces
    .filter((r) => r.places.length)
    .slice(0, 3)
    .map((r) => ({
      id: r.idea.id,
      title: r.idea.title.replace(/ (above|near|in) \{city\}/, "").replaceAll("{city}'s", "The city's").replaceAll("{city}", "the city"),
      blurb: r.idea.blurb.replaceAll("{city}", "the city"),
      why: r.hits.length ? `You like ${r.hits.slice(0, 2).map((t) => label.get(t) ?? t).join(" and ")}` : "Fits your travel type",
      places: r.places,
    }));
  return { ideas, near: stay ? stay.name : null };
}
