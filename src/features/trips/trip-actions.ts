"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { geocode } from "@/features/places/geocode";
import { timezoneFor } from "@/features/places/timezone";
import { requireUserId } from "@/lib/supabase/server";
import type { ActionState } from "./actions";

const blankToNull = (v: unknown) => (v === "" || v === undefined ? null : v);

const stopSchema = z.object({
  id: z.preprocess(blankToNull, z.uuid().nullable()).optional(),
  city: z.string().trim().min(1, "Add a city for every stop.").max(120),
  country_code: z.preprocess(blankToNull, z.string().length(2).nullable()).optional(),
  latitude: z.preprocess(blankToNull, z.coerce.number().min(-90).max(90).nullable()).optional(),
  longitude: z.preprocess(blankToNull, z.coerce.number().min(-180).max(180).nullable()).optional(),
  arrive_date: z.iso.date("Pick the date you get to each city."),
  leave_date: z.iso.date("Pick the date you leave each city."),
});

const tripSchema = z.object({
  title: z.string().trim().min(1, "Give the trip a name.").max(120),
  party_size: z.coerce.number().int().min(1, "At least 1 traveler.").max(50),
  budget: z.preprocess(blankToNull, z.coerce.number().min(0, "The budget can't be negative.").nullable()),
  currency: z.preprocess(blankToNull, z.string().regex(/^[A-Z]{3}$/).nullable()),
  stops: z.preprocess(
    (v) => {
      try {
        return JSON.parse(String(v ?? "[]"));
      } catch {
        return [];
      }
    },
    z.array(stopSchema).min(1, "Add at least one city.").max(15, "That's a lot of stops — 15 is the limit."),
  ),
});

type StopInput = z.infer<typeof stopSchema>;

function checkStops(stops: StopInput[]): string | null {
  for (const [i, s] of stops.entries()) {
    if (s.leave_date < s.arrive_date) return `${s.city}: you can't leave before you arrive.`;
    const prev = stops[i - 1];
    if (prev && s.arrive_date < prev.leave_date) {
      return `${s.city} starts before you leave ${prev.city}. Arriving the day you leave is fine.`;
    }
  }
  const first = stops[0].arrive_date;
  const last = stops.at(-1)!.leave_date;
  if ((Date.parse(last) - Date.parse(first)) / 86_400_000 > 365) return "Trips can be up to a year long.";
  return null;
}

/** Fill in coordinates and time zones; sort by arrival. */
async function resolveStops(stops: StopInput[], countryNames: Map<string, string>) {
  const sorted = [...stops].sort((a, b) => a.arrive_date.localeCompare(b.arrive_date));
  return Promise.all(
    sorted.map(async (s, position) => {
      let { latitude = null, longitude = null, country_code = null } = s;
      if (latitude === null || longitude === null) {
        const where = [s.city, country_code ? countryNames.get(country_code) : null].filter(Boolean).join(", ");
        const place = await geocode(where);
        if (place) {
          latitude = place.latitude;
          longitude = place.longitude;
          country_code = country_code ?? place.countryCode;
        }
      }
      if (country_code && !countryNames.has(country_code)) country_code = null; // not in our reference list
      return {
        id: s.id ?? null,
        position,
        city: s.city,
        country_code,
        latitude,
        longitude,
        timezone: timezoneFor({ latitude, longitude, countryCode: country_code, onDate: s.arrive_date }),
        arrive_date: s.arrive_date,
        leave_date: s.leave_date,
      };
    }),
  );
}

function withoutId<T extends { id: string | null }>(stop: T): Omit<T, "id"> {
  const copy: Partial<T> = { ...stop };
  delete copy.id;
  return copy as Omit<T, "id">;
}

function summary(stops: Awaited<ReturnType<typeof resolveStops>>) {
  const first = stops[0];
  const cities = stops.map((s) => s.city).filter((c, i, all) => all.indexOf(c) === i);
  return {
    start_date: first.arrive_date,
    end_date: stops.reduce((max, s) => (s.leave_date > max ? s.leave_date : max), first.leave_date),
    destination: cities.join(" · ").slice(0, 200),
    destination_country: first.country_code,
    timezone: first.timezone,
    latitude: first.latitude,
    longitude: first.longitude,
  };
}

async function countryNames() {
  const { supabase } = await requireUserId();
  const { data } = await supabase.from("countries").select("code, name");
  return new Map((data ?? []).map((c) => [c.code, c.name]));
}

export async function createTrip(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = tripSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const problem = checkStops(parsed.data.stops);
  if (problem) return { error: problem };

  const { supabase, userId } = await requireUserId();
  const stops = await resolveStops(parsed.data.stops, await countryNames());
  const { title, party_size, budget, currency } = parsed.data;
  const { data, error } = await supabase
    .from("trips")
    .insert({ title, party_size, budget, ...summary(stops), ...(currency ? { currency } : {}), owner_id: userId })
    .select("id")
    .single();
  if (error || !data) return { error: "We couldn't create the trip. Try again." };

  const { error: stopError } = await supabase
    .from("trip_stops")
    .insert(stops.map((s) => ({ ...withoutId(s), trip_id: data.id })));
  if (stopError) return { error: "The trip was created, but its cities didn't save. Open it and add them again." };

  redirect(`/trips/${data.id}/itinerary`);
}

export async function updateTrip(tripId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = tripSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const problem = checkStops(parsed.data.stops);
  if (problem) return { error: problem };

  const { supabase } = await requireUserId();
  const stops = await resolveStops(parsed.data.stops, await countryNames());
  const next = summary(stops);

  // Shortening the trip deletes the removed days and what's planned on them. Ask first.
  if (formData.get("confirm_remove") !== "yes") {
    const { data: outside } = await supabase
      .from("trip_days")
      .select("id")
      .eq("trip_id", tripId)
      .or(`date.lt.${next.start_date},date.gt.${next.end_date}`);
    if (outside?.length) {
      const { data: blocks } = await supabase.from("time_blocks").select("id").in("day_id", outside.map((d) => d.id));
      const { count } = await supabase
        .from("itinerary_items")
        .select("id", { count: "exact", head: true })
        .in("time_block_id", (blocks ?? []).map((b) => b.id));
      if (count) {
        return {
          error: `${count} plan${count === 1 ? " is" : "s are"} on days outside the new dates and will be removed.`,
          needsConfirm: true,
        };
      }
    }
  }

  const { title, party_size, budget, currency } = parsed.data;
  const { error } = await supabase
    .from("trips")
    .update({ title, party_size, budget, ...next, ...(currency ? { currency } : {}) })
    .eq("id", tripId);
  if (error) return { error: "Only owners and editors can change this trip." };

  const { data: existing } = await supabase.from("trip_stops").select("id").eq("trip_id", tripId);
  const keep = new Set(stops.map((s) => s.id).filter(Boolean));
  const removed = (existing ?? []).map((s) => s.id).filter((id) => !keep.has(id));
  if (removed.length) await supabase.from("trip_stops").delete().in("id", removed);
  for (const stop of stops) {
    if (stop.id && (existing ?? []).some((e) => e.id === stop.id)) {
      await supabase.from("trip_stops").update(withoutId(stop)).eq("id", stop.id);
    } else {
      await supabase.from("trip_stops").insert({ ...withoutId(stop), trip_id: tripId });
    }
  }

  revalidatePath("/trips");
  revalidatePath(`/trips/${tripId}`, "layout");
  redirect(`/trips/${tripId}/itinerary`);
}

export async function deleteTrip(tripId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  if (formData.get("confirm") !== "DELETE") return { error: "Type DELETE to confirm." };
  const { supabase } = await requireUserId();
  const { data, error } = await supabase.from("trips").delete().eq("id", tripId).select("id");
  if (error || !data?.length) return { error: "Only the trip's owner can delete it." };
  revalidatePath("/trips");
  redirect("/trips");
}
