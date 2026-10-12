"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUserId } from "@/lib/supabase/server";

const refresh = (tripId: string) => revalidatePath(`/trips/${tripId}/checklist`);
const List = z.enum(["packing", "todo"]);

export async function addChecklistItem(tripId: string, list: "packing" | "todo", formData: FormData) {
  const title = z.string().trim().min(1).max(200).safeParse(formData.get("title"));
  if (!title.success) return;
  const assigned = String(formData.get("assigned_to") ?? "");
  const due = String(formData.get("due_on") ?? "");
  const { supabase, userId } = await requireUserId();
  await supabase.from("checklist_items").insert({
    trip_id: tripId,
    list: List.parse(list),
    title: title.data,
    assigned_to: /^[0-9a-f-]{36}$/i.test(assigned) ? assigned : null,
    due_on: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null,
    created_by: userId,
    position: Date.now() % 2_000_000_000,
  });
  refresh(tripId);
}

export async function toggleChecklistItem(tripId: string, id: string, done: boolean) {
  const { supabase, userId } = await requireUserId();
  await supabase.from("checklist_items").update({ done, done_by: done ? userId : null }).eq("id", id);
  refresh(tripId);
}

export async function deleteChecklistItem(tripId: string, id: string) {
  const { supabase } = await requireUserId();
  await supabase.from("checklist_items").delete().eq("id", id);
  refresh(tripId);
}

/** A sensible starting packing list; adds travel documents when you're leaving your home country. */
export async function addStarterPacking(tripId: string) {
  const { supabase, userId } = await requireUserId();
  const [{ data: profile }, { data: stops }, { data: existing }] = await Promise.all([
    supabase.from("profiles").select("home_country").eq("id", userId).maybeSingle(),
    supabase.from("trip_stops").select("country_code").eq("trip_id", tripId),
    supabase.from("checklist_items").select("title").eq("trip_id", tripId).eq("list", "packing"),
  ]);
  const abroad = (stops ?? []).some((s) => s.country_code && s.country_code !== profile?.home_country);
  const items = [
    ...(abroad ? ["Passport (valid 6+ months)", "Check visa or entry rules", "Plug adapter", "Tell your bank you're traveling"] : ["ID"]),
    "Phone charger and cable",
    "Portable battery",
    "Medications",
    "Comfortable walking shoes",
    "Rain jacket or umbrella",
    "Toiletries",
    "Reusable water bottle",
    "Travel insurance details",
  ];
  const have = new Set((existing ?? []).map((e) => e.title.toLowerCase()));
  const rows = items
    .filter((t) => !have.has(t.toLowerCase()))
    .map((title, i) => ({ trip_id: tripId, list: "packing" as const, title, created_by: userId, position: i }));
  if (rows.length) await supabase.from("checklist_items").insert(rows);
  refresh(tripId);
}
