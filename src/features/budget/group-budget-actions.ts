"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionState } from "@/features/trips/actions";
import { requireUserId } from "@/lib/supabase/server";

const amountSchema = z.object({ amount: z.coerce.number().positive("Enter an amount above zero.").max(9999999) });

/** Save (or change) my private comfortable spend per person for this trip. */
export async function setComfortBudget(tripId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = amountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter an amount." };
  const { supabase, userId } = await requireUserId();
  const { error } = await supabase
    .from("trip_budget_comfort")
    .upsert({ trip_id: tripId, user_id: userId, amount: Math.round(parsed.data.amount * 100) / 100, updated_at: new Date().toISOString() });
  if (error) return { error: "Couldn't save that. Are you still on this trip?" };
  revalidatePath(`/trips/${tripId}`, "layout");
  return { ok: true, note: "Saved privately. Only the group's lowest number is ever shown, never who said it." };
}

/** Organizer: make the group's comfortable amount the trip budget (per person × travelers). */
export async function applyComfortBudget(tripId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  void formData;
  const { supabase } = await requireUserId();
  const [{ data: summary }, { data: trip }] = await Promise.all([
    supabase.rpc("trip_budget_comfort_summary", { p_trip_id: tripId }),
    supabase.from("trips").select("party_size").eq("id", tripId).maybeSingle(),
  ]);
  const comfortable = summary?.[0]?.comfortable;
  if (comfortable == null || !trip) return { error: "Wait until at least two people have answered." };
  const { data, error } = await supabase
    .from("trips")
    .update({ budget: Number(comfortable) * trip.party_size })
    .eq("id", tripId)
    .select("id");
  if (error || !data?.length) return { error: "Only the trip's organizers can change the budget." };
  revalidatePath(`/trips/${tripId}`, "layout");
  return { ok: true, note: "Trip budget updated." };
}

/** Organizer: show the group number now with the answers so far, without waiting for everyone. */
export async function releaseComfortBudget(tripId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  void formData;
  const { supabase } = await requireUserId();
  const { error } = await supabase.rpc("release_comfort_budget", { p_trip_id: tripId });
  if (error) return { error: "Only the trip's organizers can do that." };
  revalidatePath(`/trips/${tripId}`, "layout");
  return { ok: true };
}
