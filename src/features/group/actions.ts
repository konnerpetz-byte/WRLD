"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createSpot } from "@/features/spots/create";
import { firstUrl } from "@/features/spots/unfurl";
import { requireUserId } from "@/lib/supabase/server";
import { TRIP_ROLES } from "@/types/database";

export type GroupState = { error?: string; ok?: boolean; link?: string };

const refresh = (tripId: string) => revalidatePath(`/trips/${tripId}`, "layout");

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------
export async function createInvite(tripId: string, _: GroupState, formData: FormData): Promise<GroupState> {
  const role = z.enum(["editor", "viewer"]).catch("editor").parse(formData.get("role"));
  const { supabase, userId } = await requireUserId();
  const { data, error } = await supabase
    .from("trip_invites")
    .insert({ trip_id: tripId, role, created_by: userId })
    .select("token")
    .single();
  if (error || !data) return { error: "Only owners and editors can invite people." };
  refresh(tripId);
  return { ok: true, link: `/invite/${data.token}` };
}

export async function revokeInvite(tripId: string, inviteId: string) {
  const { supabase } = await requireUserId();
  await supabase.from("trip_invites").update({ revoked_at: new Date().toISOString() }).eq("id", inviteId);
  refresh(tripId);
}

export async function acceptInvite(token: string) {
  const { supabase } = await requireUserId();
  const { data, error } = await supabase.rpc("accept_trip_invite", { p_token: token });
  if (error || !data) redirect(`/invite/${token}?error=1`);
  revalidatePath("/trips");
  redirect(`/trips/${data}/group`);
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------
export async function changeRole(tripId: string, userId: string, formData: FormData) {
  const role = z.enum(TRIP_ROLES).exclude(["owner"]).parse(formData.get("role"));
  const { supabase } = await requireUserId();
  await supabase.from("trip_members").update({ role }).eq("trip_id", tripId).eq("user_id", userId);
  refresh(tripId);
}

export async function removeMember(tripId: string, userId: string) {
  const { supabase, userId: me } = await requireUserId();
  await supabase.from("trip_members").delete().eq("trip_id", tripId).eq("user_id", userId);
  if (userId === me) {
    revalidatePath("/trips");
    redirect("/trips");
  }
  refresh(tripId);
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------
export async function sendMessage(tripId: string, body: string): Promise<GroupState> {
  const text = body.trim().slice(0, 4000);
  if (!text) return { error: "Type a message." };
  const { supabase, userId } = await requireUserId();

  // A shared reel/TikTok/link becomes a saved spot on the trip, shown as a card.
  const url = firstUrl(text);
  let spotId: string | null = null;
  if (url) {
    const { spot } = await createSpot(supabase, userId, { url, note: null, tripId });
    spotId = spot?.id ?? null;
  }

  const { error } = await supabase.from("trip_messages").insert({ trip_id: tripId, user_id: userId, body: text, spot_id: spotId });
  if (error) return { error: "Couldn't send. Check your connection." };
  if (spotId) revalidatePath(`/trips/${tripId}/saved`);
  return { ok: true };
}

export async function deleteMessage(messageId: string) {
  const { supabase } = await requireUserId();
  await supabase.from("trip_messages").delete().eq("id", messageId);
}

export async function markChatRead(tripId: string) {
  const { supabase } = await requireUserId();
  await supabase.rpc("mark_chat_read", { p_trip_id: tripId });
}
