import "server-only";

import { requireUserId } from "@/lib/supabase/server";
import type { SavedSpot } from "@/types/database";
import { unfurl } from "./unfurl";

type Supabase = Awaited<ReturnType<typeof requireUserId>>["supabase"];

/**
 * Saves a shared link (or a note) as a spot: reads its preview, and if the
 * caption names a sight on WRLD's official list ("Pena Palace", "#sintra"),
 * pins it there right away.
 */
export async function createSpot(
  supabase: Supabase,
  userId: string,
  input: { url: string | null; note: string | null; tripId: string | null },
): Promise<{ spot: SavedSpot | null; error?: string }> {
  const preview = input.url ? await unfurl(input.url) : null;

  let place: { name: string; latitude: number; longitude: number; address: string | null; attractionId: string | null } | null =
    preview?.latitude != null && preview.longitude != null
      ? { name: preview.placeName ?? "Pinned place", latitude: preview.latitude, longitude: preview.longitude, address: null, attractionId: null }
      : null;

  if (!place) {
    const haystack = ` ${[preview?.title, preview?.placeName, input.note].filter(Boolean).join(" ").toLowerCase().replace(/[#@]/g, " ")} `;
    if (haystack.trim()) {
      const { data: sights } = await supabase.from("attractions").select("id, name, aliases, latitude, longitude, address");
      const hit = (sights ?? []).find((a) =>
        [a.name, ...a.aliases].some((term) => term.length >= 4 && haystack.includes(` ${term.toLowerCase()}`)),
      );
      if (hit) place = { name: hit.name, latitude: hit.latitude, longitude: hit.longitude, address: hit.address, attractionId: hit.id };
    }
  }

  const { data, error } = await supabase
    .from("saved_spots")
    .insert({
      user_id: userId,
      trip_id: input.tripId,
      url: preview?.url ?? null,
      source: preview?.source ?? "note",
      title: preview?.title ?? null,
      author: preview?.author ?? null,
      thumbnail_url: preview?.thumbnailUrl ?? null,
      note: input.note,
      place_name: place?.name ?? preview?.placeName ?? null,
      latitude: place?.latitude ?? null,
      longitude: place?.longitude ?? null,
      address: place?.address ?? null,
      attraction_id: place?.attractionId ?? null,
    })
    .select("*")
    .single();
  if (error) return { spot: null, error: "Couldn't save that. Check the link and try again." };
  return { spot: data as SavedSpot };
}
