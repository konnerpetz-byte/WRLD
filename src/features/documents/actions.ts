"use server";

import { revalidatePath } from "next/cache";

import { requireUserId } from "@/lib/supabase/server";
import { documentsFor } from "./rules";
import { tripDocContext } from "./context";

const refresh = (tripId: string) => {
  revalidatePath(`/trips/${tripId}/checklist`);
  revalidatePath(`/trips/${tripId}`, "layout");
};

/** "Set reminder": saves the document on your trip checklist with the date to remind you. */
export async function setDocReminder(tripId: string, docKey: string, formData: FormData) {
  const remindOn = String(formData.get("remind_on") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(remindOn)) return;
  const { supabase, userId } = await requireUserId();
  const ctx = await tripDocContext(supabase, userId, tripId);
  if (!ctx) return;
  // Rebuild the rule on the server: titles and links never come from the browser.
  const doc = documentsFor(ctx).find((d) => d.key === docKey);
  if (!doc) return;

  const { data: existing } = await supabase
    .from("checklist_items")
    .select("id")
    .eq("trip_id", tripId)
    .eq("doc_key", doc.key)
    .eq("assigned_to", userId)
    .maybeSingle();
  if (existing) {
    await supabase.from("checklist_items").update({ remind_on: remindOn }).eq("id", existing.id);
  } else {
    await supabase.from("checklist_items").insert({
      trip_id: tripId,
      list: "documents",
      title: doc.title,
      doc_key: doc.key,
      info_url: doc.url,
      assigned_to: userId,
      remind_on: remindOn,
      created_by: userId,
      position: Date.now() % 2_000_000_000,
    });
  }
  refresh(tripId);
}

export async function clearDocReminder(tripId: string, id: string) {
  const { supabase, userId } = await requireUserId();
  await supabase.from("checklist_items").delete().eq("id", id).eq("assigned_to", userId);
  refresh(tripId);
}

export async function toggleDocDone(tripId: string, id: string, done: boolean) {
  const { supabase, userId } = await requireUserId();
  await supabase.from("checklist_items").update({ done, done_by: done ? userId : null }).eq("id", id).eq("assigned_to", userId);
  refresh(tripId);
}
