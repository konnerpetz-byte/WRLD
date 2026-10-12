"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { fromAttraction, wikidataPlace } from "@/features/attractions/search";
import { requireUserId } from "@/lib/supabase/server";
import type { Attraction, SavedSpot } from "@/types/database";
import { createSpot } from "./create";
import { firstUrl } from "./unfurl";

export type SpotState = { error?: string; ok?: boolean; note?: string };

const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const saveSchema = z.object({
  url: z.preprocess(blankToNull, z.string().trim().max(2000).nullable()),
  note: z.preprocess(blankToNull, z.string().trim().max(1000).nullable()),
  trip_id: z.preprocess(blankToNull, z.uuid().nullable()),
  post_to_chat: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  redirect_to_trip: z.preprocess((v) => v === "1", z.boolean()).optional(),
});

/** Save a shared reel/TikTok/link (or a note) to a trip or just for yourself. */
export async function saveSpot(_: SpotState, formData: FormData): Promise<SpotState> {
  const parsed = saveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the link and try again." };
  const input = parsed.data;
  // People paste whole captions; keep the link and use the rest as the note.
  const raw = input.url ?? "";
  const url = firstUrl(raw);
  const leftover = url ? raw.replace(url, "").trim() : raw.trim();
  const note = [input.note, leftover].filter(Boolean).join(" ").trim().slice(0, 1000) || null;
  if (!url && !note) return { error: "Paste a link or write a note." };

  const { supabase, userId } = await requireUserId();
  const { spot, error } = await createSpot(supabase, userId, { url, note, tripId: input.trip_id });
  if (!spot) return { error };

  if (input.post_to_chat && input.trip_id) {
    await supabase.from("trip_messages").insert({
      trip_id: input.trip_id,
      user_id: userId,
      body: note ?? url ?? "Shared a spot",
      spot_id: spot.id,
    });
  }

  if (input.trip_id) revalidatePath(`/trips/${input.trip_id}`, "layout");
  revalidatePath("/saved");
  if (input.redirect_to_trip) redirect(input.trip_id ? `/trips/${input.trip_id}/saved#spot-${spot.id}` : "/saved");
  return {
    ok: true,
    note: spot.place_name ? `Saved. Looks like ${spot.place_name}.` : "Saved. Pin it to a place to put it on the map.",
  };
}

/** Pin a spot to a place picked from the search (official listing or Wikidata). */
export async function pinSpot(spotId: string, _: SpotState, formData: FormData): Promise<SpotState> {
  const source = String(formData.get("source") ?? "");
  const ref = String(formData.get("ref") ?? "");
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const { supabase } = await requireUserId();

  let update: Partial<Pick<SavedSpot, "place_name" | "latitude" | "longitude" | "address" | "attraction_id">> | null = null;
  if (source === "official" && ref) {
    const { data } = await supabase.from("attractions").select("*").eq("id", ref).maybeSingle();
    if (data) {
      const a = fromAttraction(data as Attraction);
      update = { place_name: a.name, latitude: a.latitude, longitude: a.longitude, address: a.address, attraction_id: a.ref };
    }
  } else if (ref) {
    const p = await wikidataPlace(ref);
    if (p) update = { place_name: p.name, latitude: p.latitude, longitude: p.longitude, address: null, attraction_id: null };
  }
  if (!update && title) update = { place_name: title };
  if (!update) return { error: "Pick a place from the list." };

  const { data: spot, error } = await supabase.from("saved_spots").update(update).eq("id", spotId).select("trip_id").single();
  if (error) return { error: "Couldn't update that spot." };
  if (spot?.trip_id) revalidatePath(`/trips/${spot.trip_id}`, "layout");
  revalidatePath("/saved");
  return { ok: true };
}

export async function moveSpot(spotId: string, formData: FormData) {
  const tripId = z.preprocess(blankToNull, z.uuid().nullable()).catch(null).parse(formData.get("trip_id"));
  const { supabase } = await requireUserId();
  await supabase.from("saved_spots").update({ trip_id: tripId }).eq("id", spotId);
  revalidatePath("/saved");
  if (tripId) revalidatePath(`/trips/${tripId}`, "layout");
}

export async function shareSpotToChat(tripId: string, spotId: string) {
  const { supabase, userId } = await requireUserId();
  const { data: spot } = await supabase.from("saved_spots").select("title, url, place_name").eq("id", spotId).single();
  if (!spot) return;
  await supabase.from("trip_messages").insert({
    trip_id: tripId,
    user_id: userId,
    body: spot.place_name ? `What about ${spot.place_name}?` : (spot.title ?? spot.url ?? "Shared a spot"),
    spot_id: spotId,
  });
  revalidatePath(`/trips/${tripId}`, "layout");
}

export async function deleteSpot(spotId: string) {
  const { supabase } = await requireUserId();
  const { data } = await supabase.from("saved_spots").delete().eq("id", spotId).select("trip_id");
  revalidatePath("/saved");
  const tripId = data?.[0]?.trip_id;
  if (tripId) revalidatePath(`/trips/${tripId}`, "layout");
}
