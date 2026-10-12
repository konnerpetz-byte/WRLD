"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { lookupActivityPrice } from "@/features/pricing/lookup";
import { zonedTimeToUtc } from "@/lib/format";
import { requireUserId } from "@/lib/supabase/server";
import { BOOKING_STATUSES, EXPENSE_CATEGORIES, TRANSIT_DIRECTIONS, TRANSIT_MODES } from "@/types/database";

export type ActionState = { error?: string; ok?: boolean; note?: string };

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
// Trips
// ---------------------------------------------------------------------------
const tripSchema = z
  .object({
    title: z.string().trim().min(1, "Give the trip a name.").max(120),
    destination: optionalText,
    destination_country: z.preprocess(blankToNull, z.string().length(2).nullable()),
    start_date: z.iso.date("Pick a start date."),
    end_date: z.iso.date("Pick an end date."),
    timezone: z.string().min(1),
    party_size: z.coerce.number().int().min(1).max(50),
    budget: optionalMoney,
  })
  .refine((t) => t.end_date >= t.start_date, { message: "The trip can't end before it starts.", path: ["end_date"] });

export async function createTrip(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = tripSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { supabase, userId } = await requireUserId();
  const { data, error } = await supabase
    .from("trips")
    .insert({ ...parsed.data, owner_id: userId })
    .select("id")
    .single();
  if (error) return { error: "We couldn't create the trip. Try again." };

  redirect(`/trips/${data.id}/itinerary`);
}

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
// Activities — price is filled in automatically when the user leaves it blank
// ---------------------------------------------------------------------------
const activitySchema = z.object({
  time_block_id: z.uuid(),
  title: z.string().trim().min(1, "Name the activity.").max(200),
  kind: z.enum(["activity", "tour", "meal", "sightseeing", "free_time", "note"]).default("activity"),
  start_time: z.preprocess(blankToNull, z.string().regex(/^\d{2}:\d{2}$/).nullable()),
  unit_price: optionalMoney,
  currency: currencyCode,
});

export async function addActivity(tripId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = activitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const input = parsed.data;

  const { supabase, userId } = await requireUserId();
  const { data: trip } = await supabase.from("trips").select("destination, currency").eq("id", tripId).single();
  if (!trip) return { error: "Trip not found." };

  let price: {
    unit_price: number | null;
    currency: string | null;
    price_source: "manual" | "estimate" | null;
    provider?: string;
    provider_ref?: string;
    booking_url?: string | null;
  } = { unit_price: input.unit_price, currency: input.currency ?? trip.currency, price_source: input.unit_price === null ? null : "manual" };

  let note: string | undefined;
  if (input.unit_price === null && input.kind !== "note" && input.kind !== "free_time") {
    const match = await lookupActivityPrice({ title: input.title, destination: trip.destination, currency: trip.currency });
    if (match) {
      price = {
        unit_price: match.unitPrice,
        currency: match.currency,
        price_source: "estimate",
        provider: match.provider,
        provider_ref: match.providerRef,
        booking_url: match.bookingUrl,
      };
      note = `Found a price: ${match.title}.`;
    } else {
      note = "No price found — add one so it counts in the budget.";
    }
  }

  const { error } = await supabase.from("itinerary_items").insert({
    trip_id: tripId,
    time_block_id: input.time_block_id,
    title: input.title,
    kind: input.kind,
    start_time: input.start_time,
    created_by: userId,
    price_checked_at: price.price_source ? new Date().toISOString() : null,
    ...price,
  });
  if (error) return { error: "Only owners and editors can add to this trip." };

  refresh(tripId);
  return { ok: true, note };
}

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
  const { error } = await supabase.from("transit_segments").insert({
    ...rest,
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
  const { data: trip } = await supabase.from("trips").select("timezone").eq("id", tripId).single();
  if (!trip) return { error: "Trip not found." };

  const check_in_at = zonedTimeToUtc(check_in_local, trip.timezone);
  const check_out_at = zonedTimeToUtc(check_out_local, trip.timezone);
  if (check_out_at <= check_in_at) return { error: "Check-out has to be after check-in." };

  const { error } = await supabase
    .from("lodging")
    .insert({ ...rest, trip_id: tripId, check_in_at, check_out_at, created_by: userId });
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
