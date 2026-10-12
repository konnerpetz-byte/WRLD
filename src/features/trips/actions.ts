"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { geocode } from "@/features/places/geocode";
import { zonedTimeToUtc } from "@/lib/format";
import { requireUserId } from "@/lib/supabase/server";
import { BOOKING_STATUSES, EXPENSE_CATEGORIES, TRANSIT_DIRECTIONS, TRANSIT_MODES } from "@/types/database";

export type ActionState = { error?: string; ok?: boolean; note?: string; needsConfirm?: boolean };

const blankToNull = (v: unknown) => (v === "" || v === undefined ? null : v);
const optionalMoney = z.preprocess(blankToNull, z.coerce.number().min(0, "Prices can't be negative.").nullable());
const optionalInt = z.preprocess(blankToNull, z.coerce.number().int().min(0).nullable());
const optionalText = z.preprocess(blankToNull, z.string().trim().max(200).nullable());
const currencyCode = z.preprocess(blankToNull, z.string().regex(/^[A-Z]{3}$/).nullable());

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

const refresh = (tripId: string) => revalidatePath(`/trips/${tripId}`, "layout");

// ---------------------------------------------------------------------------
// Trips — create/edit/delete live in trip-actions.ts
// ---------------------------------------------------------------------------
export async function updateTripMoney(tripId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({ budget: optionalMoney, party_size: z.coerce.number().int().min(1, "At least 1 traveler.").max(50) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { supabase } = await requireUserId();
  const { error } = await supabase.from("trips").update(parsed.data).eq("id", tripId);
  if (error) return { error: "Only owners and editors can change the budget." };
  refresh(tripId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Activities — adding lives in features/itinerary/place-actions.ts
// ---------------------------------------------------------------------------
export async function updateActivityPrice(tripId: string, itemId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({ unit_price: optionalMoney, quantity: optionalInt, currency: currencyCode })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { supabase } = await requireUserId();
  const { unit_price, quantity, currency } = parsed.data;
  const { error } = await supabase
    .from("itinerary_items")
    .update({
      unit_price,
      quantity: quantity || null,
      ...(currency ? { currency } : {}),
      price_source: unit_price === null ? null : "manual",
      ...(unit_price === null ? { cost: null } : {}),
    })
    .eq("id", itemId);
  if (error) return { error: "Couldn't save the price." };
  refresh(tripId);
  return { ok: true };
}

export async function setItemStatus(tripId: string, itemId: string, formData: FormData) {
  const status = z.enum(BOOKING_STATUSES).parse(formData.get("booking_status"));
  const { supabase } = await requireUserId();
  await supabase.from("itinerary_items").update({ booking_status: status }).eq("id", itemId);
  refresh(tripId);
}

export async function deleteItem(tripId: string, itemId: string) {
  const { supabase } = await requireUserId();
  await supabase.from("itinerary_items").delete().eq("id", itemId);
  refresh(tripId);
}

// ---------------------------------------------------------------------------
// Flights & trains — times are typed in local time at each end
// ---------------------------------------------------------------------------
const transitSchema = z.object({
  mode: z.enum(TRANSIT_MODES),
  direction: z.enum(TRANSIT_DIRECTIONS),
  carrier: optionalText,
  service_number: optionalText,
  origin_code: optionalText,
  destination_code: optionalText,
  depart_local: z.string().min(1, "When does it leave?"),
  origin_timezone: z.string().min(1),
  arrive_local: z.string().min(1, "When does it arrive?"),
  destination_timezone: z.string().min(1),
  booking_status: z.enum(BOOKING_STATUSES).default("booked"),
  cost: optionalMoney,
  currency: currencyCode,
  points_used: optionalInt,
});

export async function addTransit(tripId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = transitSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { depart_local, arrive_local, ...rest } = parsed.data;

  const depart_at = zonedTimeToUtc(depart_local, rest.origin_timezone);
  const arrive_at = zonedTimeToUtc(arrive_local, rest.destination_timezone);
  if (arrive_at < depart_at) return { error: "Arrival is before departure. Check the times and time zones." };

  const { supabase, userId } = await requireUserId();
  const station = rest.mode === "flight" ? "airport" : "station";
  const [from, to] = await Promise.all([
    rest.origin_code ? geocode(`${rest.origin_code} ${station}`) : null,
    rest.destination_code ? geocode(`${rest.destination_code} ${station}`) : null,
  ]);
  const { error } = await supabase.from("transit_segments").insert({
    ...rest,
    origin_latitude: from?.latitude ?? null,
    origin_longitude: from?.longitude ?? null,
    destination_latitude: to?.latitude ?? null,
    destination_longitude: to?.longitude ?? null,
    origin_code: rest.origin_code?.toUpperCase() ?? null,
    destination_code: rest.destination_code?.toUpperCase() ?? null,
    trip_id: tripId,
    depart_at,
    arrive_at,
    created_by: userId,
  });
  if (error) return { error: "Couldn't save this leg." };
  refresh(tripId);
  return { ok: true };
}

export async function deleteTransit(tripId: string, id: string) {
  const { supabase } = await requireUserId();
  await supabase.from("transit_segments").delete().eq("id", id);
  refresh(tripId);
}

// ---------------------------------------------------------------------------
// Stays
// ---------------------------------------------------------------------------
const lodgingSchema = z.object({
  name: z.string().trim().min(1, "Name the place you're staying.").max(200),
  address: optionalText,
  check_in_local: z.string().min(1, "Add a check-in time."),
  check_out_local: z.string().min(1, "Add a check-out time."),
  booking_status: z.enum(BOOKING_STATUSES).default("booked"),
  confirmation_code: optionalText,
  cost: optionalMoney,
  currency: currencyCode,
  points_used: optionalInt,
});

export async function addLodging(tripId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = lodgingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { check_in_local, check_out_local, ...rest } = parsed.data;

  const { supabase, userId } = await requireUserId();
  const [{ data: trip }, { data: stops }] = await Promise.all([
    supabase.from("trips").select("timezone, latitude, longitude").eq("id", tripId).single(),
    supabase.from("trip_stops").select("city, latitude, longitude, timezone, arrive_date, leave_date").eq("trip_id", tripId).order("position"),
  ]);
  if (!trip) return { error: "Trip not found." };
  // The stay belongs to the city you're in on the check-in date.
  const checkInDate = check_in_local.slice(0, 10);
  const stop =
    (stops ?? []).find((s) => checkInDate >= s.arrive_date && checkInDate < s.leave_date) ??
    (stops ?? []).find((s) => checkInDate >= s.arrive_date && checkInDate <= s.leave_date);
  const timezone = stop?.timezone ?? trip.timezone;
  const near =
    stop?.latitude != null && stop.longitude != null
      ? { latitude: stop.latitude, longitude: stop.longitude }
      : trip.latitude !== null && trip.longitude !== null
        ? { latitude: trip.latitude, longitude: trip.longitude }
        : null;
  const place =
    (await geocode(rest.address ?? `${rest.name}${stop ? `, ${stop.city}` : ""}`, { near })) ??
    (rest.address ? await geocode(`${rest.name}${stop ? `, ${stop.city}` : ""}`, { near }) : null);

  const check_in_at = zonedTimeToUtc(check_in_local, timezone);
  const check_out_at = zonedTimeToUtc(check_out_local, timezone);
  if (check_out_at <= check_in_at) return { error: "Check-out has to be after check-in." };

  const { error } = await supabase
    .from("lodging")
    .insert({
      ...rest,
      trip_id: tripId,
      check_in_at,
      check_out_at,
      created_by: userId,
      latitude: place?.latitude ?? null,
      longitude: place?.longitude ?? null,
      address: rest.address ?? place?.address ?? null,
    });
  if (error) return { error: "Couldn't save this stay." };
  refresh(tripId);
  return { ok: true };
}

export async function deleteLodging(tripId: string, id: string) {
  const { supabase } = await requireUserId();
  await supabase.from("lodging").delete().eq("id", id);
  refresh(tripId);
}

// ---------------------------------------------------------------------------
// Expenses (money spent that isn't a planned booking, or paying for one)
// ---------------------------------------------------------------------------
const expenseSchema = z.object({
  description: z.string().trim().min(1, "What was it for?").max(200),
  amount: z.coerce.number().min(0, "Amounts can't be negative."),
  currency: z.string().regex(/^[A-Z]{3}$/),
  category: z.enum(EXPENSE_CATEGORIES),
  incurred_on: z.iso.date("Pick a date."),
});

export async function addExpense(tripId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = expenseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { supabase, userId } = await requireUserId();
  const { error } = await supabase.from("expenses").insert({ ...parsed.data, trip_id: tripId, paid_by: userId });
  if (error) return { error: "Couldn't save the expense." };
  refresh(tripId);
  return { ok: true };
}

export async function deleteExpense(tripId: string, id: string) {
  const { supabase } = await requireUserId();
  await supabase.from("expenses").delete().eq("id", id);
  refresh(tripId);
}
