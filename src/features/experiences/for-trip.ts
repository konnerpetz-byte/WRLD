import "server-only";

import type { requireUserId } from "@/lib/supabase/server";
import { suggestExperiences, type SuggestionResult } from "./suggest";

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
): Promise<(SuggestionResult & { city: string }) | null> {
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
    ? await supabase.from("trip_stops").select("city").eq("id", day.stop_id).maybeSingle()
    : { data: null };
  const city = stop?.city ?? trip?.destination?.split(" · ")[0] ?? null;
  if (!city || !trip) return null;

  const result = await suggestExperiences({
    city,
    currency: trip.currency,
    interests: await myInterests(supabase, userId),
    slot: block.slot,
    availableMinutes: block.available_minutes,
    limit,
  });
  return { ...result, city };
}
