"use server";

import { revalidatePath } from "next/cache";

import { airportByCode } from "@/features/places/airports";
import { requireUserId } from "@/lib/supabase/server";

export type HomeAirportState = { error?: string; saved?: string };

/** Sets the airport WRLD searches from by default. */
export async function setHomeAirport(_: HomeAirportState, formData: FormData): Promise<HomeAirportState> {
  const code = String(formData.get("home_airport") ?? "").trim().toUpperCase();
  const airport = /^[A-Z]{3}$/.test(code) ? airportByCode(code) : null;
  if (!airport) return { error: "Enter a 3-letter airport code, like DTW." };
  const { supabase, userId } = await requireUserId();
  const { error } = await supabase.from("profiles").update({ home_airport: code }).eq("id", userId);
  if (error) return { error: "That didn't save. Try again." };
  revalidatePath("/", "layout");
  return { saved: `${airport.city} (${code})` };
}

/** The first-run tour was finished or skipped: don't show it again. */
export async function markTourSeen() {
  const { supabase, userId } = await requireUserId();
  await supabase.from("profiles").update({ tour_seen_at: new Date().toISOString() }).eq("id", userId);
}
