import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import type { DocContext } from "./rules";

/** Passport country, trip countries, start date and whether there's a drive, for documentsFor(). */
export async function tripDocContext(supabase: SupabaseClient<Database>, userId: string, tripId: string): Promise<DocContext | null> {
  const [{ data: trip }, { data: profile }, { data: stops }, { data: cars }] = await Promise.all([
    supabase.from("trips").select("start_date, destination_country").eq("id", tripId).maybeSingle(),
    supabase.from("profiles").select("home_country").eq("id", userId).maybeSingle(),
    supabase.from("trip_stops").select("country_code").eq("trip_id", tripId).order("position"),
    supabase.from("transit_segments").select("id").eq("trip_id", tripId).eq("mode", "car").neq("booking_status", "cancelled").limit(1),
  ]);
  if (!trip) return null;
  const countries = (stops ?? []).map((s) => s.country_code).filter((c): c is string => Boolean(c));
  if (!countries.length && trip.destination_country) countries.push(trip.destination_country);
  return { home: profile?.home_country ?? null, countries, start: trip.start_date, hasCarLeg: Boolean(cars?.length) };
}
