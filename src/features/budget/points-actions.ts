"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUserId } from "@/lib/supabase/server";

export type PointsState = { error?: string; ok?: boolean };

const refresh = (tripId: string) => revalidatePath(`/trips/${tripId}`, "layout");
const cents = z.coerce.number().min(0.1, "At least 0.1¢ a point.").max(10, "At most 10¢ a point.");

/** The value the group agrees a point is worth, in cents of the trip currency. */
export async function setPointValue(tripId: string, _: PointsState, formData: FormData): Promise<PointsState> {
  const parsed = cents.safeParse(formData.get("point_value_cents"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Pick a value." };
  const { supabase } = await requireUserId();
  const { error } = await supabase.from("trips").update({ point_value_cents: Math.round(parsed.data * 100) / 100 }).eq("id", tripId);
  if (error) return { error: "Only the trip's organizers can change this." };
  refresh(tripId);
  return { ok: true };
}

const entrySchema = z.object({
  description: z.string().trim().min(1, "What were the points for?").max(200),
  program: z.string().trim().max(80).optional().transform((v) => v || null),
  points: z.coerce.number().int("Whole points only.").min(1, "How many points?").max(10_000_000),
  value_cents: z.preprocess((v) => (v === "" || v == null ? null : v), cents.nullable()),
});

/** "Konner used 88,000 United miles for everyone's flights." Counts toward who-owes-whom at the agreed value. */
export async function addPointsContribution(tripId: string, _: PointsState, formData: FormData): Promise<PointsState> {
  const parsed = entrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  return recordPoints(tripId, {
    ...parsed.data,
    paidBy: String(formData.get("paid_by") ?? ""),
    split: formData.getAll("split").map(String),
    lodgingId: String(formData.get("lodging_id") ?? "") || null,
    transitId: String(formData.get("transit_segment_id") ?? "") || null,
  });
}

/** Shared by the Budget form and booking import. */
export async function recordPoints(
  tripId: string,
  entry: {
    description: string;
    program: string | null;
    points: number;
    value_cents: number | null;
    paidBy: string;
    split: string[];
    lodgingId?: string | null;
    transitId?: string | null;
  },
): Promise<PointsState> {
  const { supabase, userId } = await requireUserId();
  const { data: members } = await supabase.from("trip_members").select("user_id").eq("trip_id", tripId);
  const ids = new Set((members ?? []).map((m) => m.user_id));
  const paid_by = ids.has(entry.paidBy) ? entry.paidBy : userId;
  const split = [...new Set(entry.split.filter((u) => ids.has(u)))];
  if (entry.split.length && !split.length) return { error: "Pick at least one person to share it." };
  // Everyone is stored as an empty list, so people who join later are included.
  const split_with = split.length === ids.size ? [] : split;
  const link = async (table: "lodging" | "transit_segments", id: string | null | undefined) => {
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
    const { data } = await supabase.from(table).select("id").eq("id", id).eq("trip_id", tripId).maybeSingle();
    return data?.id ?? null;
  };
  const [lodging_id, transit_segment_id] = await Promise.all([link("lodging", entry.lodgingId), link("transit_segments", entry.transitId)]);
  const { error } = await supabase.from("points_contributions").insert({
    trip_id: tripId,
    paid_by,
    description: entry.description.slice(0, 200),
    program: entry.program?.slice(0, 80) ?? null,
    points: entry.points,
    value_cents: entry.value_cents,
    split_with,
    lodging_id,
    transit_segment_id,
    created_by: userId,
  });
  if (error) return { error: "Couldn't save that. Only the trip's organizers can add points." };
  refresh(tripId);
  return { ok: true };
}

export async function deletePointsContribution(tripId: string, id: string) {
  const { supabase } = await requireUserId();
  await supabase.from("points_contributions").delete().eq("id", id).eq("trip_id", tripId);
  refresh(tripId);
}
