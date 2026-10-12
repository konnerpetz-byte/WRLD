"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fromAttraction, wikidataPlace } from "@/features/attractions/search";
import { SLOT_LABEL, type PlaceSuggestion } from "@/features/attractions/types";
import { geocode } from "@/features/places/geocode";
import { lookupActivityPrice } from "@/features/pricing/lookup";
import type { ActionState } from "@/features/trips/actions";
import { distanceKm } from "@/lib/geo";
import { requireUserId } from "@/lib/supabase/server";
import type { Attraction, TimeBlock, TimeBlockSlot } from "@/types/database";
import { formatClock, planTime } from "./schedule";

type Supabase = Awaited<ReturnType<typeof requireUserId>>["supabase"];
type Point = { latitude: number; longitude: number };

const blankToNull = (v: unknown) => (v === "" || v === undefined ? null : v);
const refresh = (tripId: string) => revalidatePath(`/trips/${tripId}`, "layout");
const SLOTS: TimeBlockSlot[] = ["morning", "afternoon", "evening"];
/** A day counts as "in the area" when its city is within this distance. */
const NEAR_KM = 120;

const pickSchema = z.object({
  source: z.preprocess(blankToNull, z.enum(["official", "wikidata", "nearby"]).nullable()),
  ref: z.preprocess(blankToNull, z.string().max(64).nullable()),
});

// ---------------------------------------------------------------------------
// Shared lookups
// ---------------------------------------------------------------------------
async function loadTrip(supabase: Supabase, tripId: string) {
  const [{ data: trip }, { data: stops }, { data: days }, { data: blocks }, { data: items }] = await Promise.all([
    supabase.from("trips").select("id, destination, currency, timezone, latitude, longitude").eq("id", tripId).single(),
    supabase.from("trip_stops").select("id, city, latitude, longitude, timezone").eq("trip_id", tripId),
    supabase.from("trip_days").select("id, date, stop_id, timezone").eq("trip_id", tripId).order("date"),
    supabase.from("time_blocks").select("*").eq("trip_id", tripId).order("starts_at"),
    supabase.from("itinerary_items").select("id, time_block_id, end_time, start_time").eq("trip_id", tripId),
  ]);
  if (!trip) return null;
  const stopById = new Map((stops ?? []).map((s) => [s.id, s]));
  const dayList = (days ?? []).map((d) => {
    const stop = d.stop_id ? stopById.get(d.stop_id) : undefined;
    const point =
      stop?.latitude != null && stop.longitude != null
        ? { latitude: stop.latitude, longitude: stop.longitude }
        : trip.latitude !== null && trip.longitude !== null
          ? { latitude: trip.latitude, longitude: trip.longitude }
          : null;
    return {
      ...d,
      city: stop?.city ?? trip.destination,
      point,
      timeZone: d.timezone ?? trip.timezone,
      blocks: (blocks ?? []).filter((b) => b.day_id === d.id) as TimeBlock[],
    };
  });
  return { trip, days: dayList, items: items ?? [] };
}

type Loaded = NonNullable<Awaited<ReturnType<typeof loadTrip>>>;

async function resolvePick(supabase: Supabase, source: string | null, ref: string | null, near: Point | null) {
  if (!source || !ref) return null;
  if (source === "official") {
    const { data } = await supabase.from("attractions").select("*").eq("id", ref).maybeSingle();
    return data ? fromAttraction(data as Attraction, near) : null;
  }
  return wikidataPlace(ref, near);
}

/** Insert one item into a block, with time, place, official links and price filled in. */
async function insertItem(
  supabase: Supabase,
  userId: string,
  loaded: Loaded,
  block: TimeBlock,
  input: { title: string; place: PlaceSuggestion | null; address: string | null; unitPrice: number | null; startTime: string | null },
): Promise<ActionState> {
  const { trip, days, items } = loaded;
  const day = days.find((d) => d.id === block.day_id)!;
  const place = input.place;
  const notes: string[] = [];

  // Where is it? Picked places carry coordinates; otherwise look up the
  // address (or the name) near that day's city.
  let point: { latitude: number; longitude: number; address: string | null } | null = place
    ? { latitude: place.latitude, longitude: place.longitude, address: place.address }
    : null;
  if (!point) {
    const found = await geocode(input.address ?? `${input.title}${day.city ? `, ${day.city}` : ""}`, { near: day.point });
    const retry = !found && input.address === null ? await geocode(input.title, { near: day.point }) : null;
    const hit = found ?? retry;
    if (hit) point = { latitude: hit.latitude, longitude: hit.longitude, address: input.address ?? hit.address };
    else if (input.address) notes.push("Couldn't find that address on the map — check the spelling.");
  }
  if (place && day.point) {
    const km = distanceKm(day.point, place);
    if (km > NEAR_KM) notes.push(`Heads up: it's ${Math.round(km)} km from ${day.city ?? "where you're staying"} that day.`);
  }

  // When? Fill the slot automatically for picked places.
  let start = input.startTime;
  let end: string | null = null;
  if (!start && place) {
    const plan = planTime({
      block,
      timeZone: day.timeZone,
      busyUntil: items.filter((i) => i.time_block_id === block.id).map((i) => i.end_time?.slice(0, 5) ?? i.start_time?.slice(0, 5) ?? null),
      suggestedStart: place.suggestedStart,
      durationMinutes: place.durationMinutes,
    });
    start = plan.start;
    end = plan.end;
    if (place.bestSlot && place.bestSlot !== block.slot) {
      notes.push(`Best in the ${SLOT_LABEL[place.bestSlot].toLowerCase()}${place.suggestedStart ? ` (from ${formatClock(place.suggestedStart)})` : ""}.`);
    }
  }

  // Price: what you typed → official price → provider lookup.
  let price: Record<string, unknown> = {};
  if (input.unitPrice !== null) {
    price = { unit_price: input.unitPrice, currency: trip.currency, price_source: "manual" };
  } else if (place?.source === "official" && place.price !== null) {
    price = {
      unit_price: place.price,
      currency: place.currency ?? trip.currency,
      price_source: "official",
      provider: "official",
      provider_ref: place.ref,
      price_checked_at: new Date().toISOString(),
    };
  } else {
    const match = await lookupActivityPrice({ title: place?.name ?? input.title, destination: day.city, currency: trip.currency });
    if (match) {
      price = {
        unit_price: match.unitPrice,
        currency: match.currency,
        price_source: "estimate",
        provider: match.provider,
        provider_ref: match.providerRef,
        booking_url: match.bookingUrl,
        price_checked_at: new Date().toISOString(),
      };
      notes.push(`Found a price: ${match.title}.`);
    } else {
      notes.push("No price found — add one so it counts in the budget.");
    }
  }

  const { error } = await supabase.from("itinerary_items").insert({
    trip_id: trip.id,
    time_block_id: block.id,
    title: place?.name ?? input.title,
    kind: place ? "sightseeing" : "activity",
    start_time: start,
    end_time: end,
    latitude: point?.latitude ?? null,
    longitude: point?.longitude ?? null,
    address: point?.address ?? null,
    location_name: place?.name ?? null,
    description: place ? [place.visitNote, place.hoursNote].filter(Boolean).join("\n") || null : null,
    attraction_id: place?.source === "official" ? place.ref : null,
    official_url: place?.officialUrl ?? null,
    booking_url: place?.ticketsUrl ?? null,
    created_by: userId,
    ...price,
  });
  if (error) return { error: "Only owners and editors can add to this trip." };

  const when = start ? `${formatClock(start)}${end ? `–${formatClock(end)}` : ""}` : null;
  return {
    ok: true,
    note: [when ? `Added for ${when}.` : null, place?.timedEntry ? "Timed entry — book your slot on the official site." : null, ...notes]
      .filter(Boolean)
      .join(" "),
  };
}

// ---------------------------------------------------------------------------
// Add from a specific Morning/Afternoon/Evening block
// ---------------------------------------------------------------------------
const blockAddSchema = pickSchema.extend({
  time_block_id: z.uuid(),
  title: z.string().trim().min(1, "Name the activity.").max(200),
  address: z.preprocess(blankToNull, z.string().trim().max(300).nullable()),
  unit_price: z.preprocess(blankToNull, z.coerce.number().min(0, "Prices can't be negative.").nullable()),
});

export async function addActivity(tripId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = blockAddSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const input = parsed.data;

  const { supabase, userId } = await requireUserId();
  const loaded = await loadTrip(supabase, tripId);
  if (!loaded) return { error: "Trip not found." };
  const block = loaded.days.flatMap((d) => d.blocks).find((b) => b.id === input.time_block_id);
  if (!block) return { error: "That part of the day no longer exists. Refresh and try again." };
  const day = loaded.days.find((d) => d.id === block.day_id)!;

  const place = await resolvePick(supabase, input.source, input.ref, day.point);
  const result = await insertItem(supabase, userId, loaded, block, {
    title: input.title,
    place,
    address: input.address,
    unitPrice: input.unit_price,
    startTime: null,
  });
  if (result.ok) refresh(tripId);
  return result;
}

// ---------------------------------------------------------------------------
// "Add a place" at the top of the itinerary: picks the day and time for you
// ---------------------------------------------------------------------------
const placeAddSchema = pickSchema.extend({
  title: z.string().trim().min(1, "Type a place, like Sintra or Neuschwanstein.").max(200),
  day_id: z.preprocess(blankToNull, z.uuid().nullable()),
});

export async function addPlace(tripId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = placeAddSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const input = parsed.data;

  const { supabase, userId } = await requireUserId();
  const loaded = await loadTrip(supabase, tripId);
  if (!loaded) return { error: "Trip not found." };

  const anchor = loaded.days.find((d) => d.id === input.day_id)?.point ?? loaded.days.find((d) => d.point)?.point ?? null;
  let place = await resolvePick(supabase, input.source, input.ref, anchor);
  if (!place) {
    // Typed without picking a suggestion: use the best official match if there is one.
    const { data } = await supabase.rpc("search_attractions", { p_query: input.title, p_limit: 1 });
    const top = (data as Attraction[] | null)?.[0];
    if (top) place = fromAttraction(top, anchor);
  }

  const block = chooseBlock(loaded, place, input.day_id);
  if (!block) return { error: "Every part of the trip is taken by travel. Add more days on Edit trip." };

  const result = await insertItem(supabase, userId, loaded, block, {
    title: input.title,
    place,
    address: null,
    unitPrice: null,
    startTime: null,
  });
  if (result.ok) {
    const day = loaded.days.find((d) => d.id === block.day_id)!;
    const [y, m, d] = day.date.split("-").map(Number);
    const label = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(
      new Date(Date.UTC(y, m - 1, d)),
    );
    result.note = `${label}, ${SLOT_LABEL[block.slot].toLowerCase()}. ${result.note ?? ""}`.trim();
    refresh(tripId);
  }
  return result;
}

/**
 * Best day and block for a place: a day in that area (or the day you chose),
 * the sight's best time of day, preferring blocks with nothing planned yet.
 */
function chooseBlock(loaded: Loaded, place: PlaceSuggestion | null, dayId: string | null): TimeBlock | null {
  const usable = (b: TimeBlock) => b.status !== "unavailable";
  const busy = new Set(loaded.items.map((i) => i.time_block_id));
  const slotOrder = place?.bestSlot ? [place.bestSlot, ...SLOTS.filter((s) => s !== place.bestSlot)] : SLOTS;

  let days = loaded.days;
  if (dayId) days = days.filter((d) => d.id === dayId);
  else if (place) {
    const near = days.filter((d) => d.point && distanceKm(d.point, place) <= NEAR_KM);
    if (near.length) days = near;
  }

  for (const preferEmpty of [true, false]) {
    for (const slotRank of [0, 1, 2]) {
      for (const day of days) {
        const block = day.blocks.find((b) => b.slot === slotOrder[slotRank]);
        if (block && usable(block) && (!preferEmpty || !busy.has(block.id))) return block;
      }
      if (!place?.bestSlot) break; // without a best time, take the first usable block of the first day
    }
  }
  for (const day of days) {
    const block = day.blocks.find(usable);
    if (block) return block;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Explore nearby → add to the same day (next free block)
// ---------------------------------------------------------------------------
export async function addNearby(tripId: string, fromItemId: string, formData: FormData): Promise<ActionState> {
  const parsed = pickSchema.extend({ title: z.string().trim().min(1).max(200) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Couldn't add that place." };

  const { supabase, userId } = await requireUserId();
  const loaded = await loadTrip(supabase, tripId);
  if (!loaded) return { error: "Trip not found." };
  const { data: from } = await supabase.from("itinerary_items").select("time_block_id").eq("id", fromItemId).single();
  const fromBlock = loaded.days.flatMap((d) => d.blocks).find((b) => b.id === from?.time_block_id);
  if (!fromBlock) return { error: "Couldn't find that day." };
  const day = loaded.days.find((d) => d.id === fromBlock.day_id)!;

  const place = await resolvePick(supabase, parsed.data.source, parsed.data.ref, day.point);
  // Same block if it still has room after what's there, else the next usable block that day.
  const order = SLOTS.slice(SLOTS.indexOf(fromBlock.slot));
  const block =
    order.map((s) => day.blocks.find((b) => b.slot === s)).find((b) => b && b.status !== "unavailable") ?? fromBlock;

  const result = await insertItem(supabase, userId, loaded, block, {
    title: parsed.data.title,
    place,
    address: null,
    unitPrice: null,
    startTime: null,
  });
  if (result.ok) refresh(tripId);
  return result;
}

// ---------------------------------------------------------------------------
// Put something on the map by address or name
// ---------------------------------------------------------------------------
export async function setItemLocation(tripId: string, itemId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const query = String(formData.get("query") ?? "").trim().slice(0, 300);
  const { supabase } = await requireUserId();
  const loaded = await loadTrip(supabase, tripId);
  const { data: item } = await supabase.from("itinerary_items").select("title, time_block_id").eq("id", itemId).single();
  if (!loaded || !item) return { error: "Couldn't find that plan." };
  const block = loaded.days.flatMap((d) => d.blocks).find((b) => b.id === item.time_block_id);
  const day = loaded.days.find((d) => d.id === block?.day_id);
  const near = day?.point ?? null;

  const place =
    (query && (await geocode(query, { near }))) ||
    (query ? null : await geocode([item.title, day?.city].filter(Boolean).join(", "), { near }));
  if (place) {
    await supabase
      .from("itinerary_items")
      .update({ latitude: place.latitude, longitude: place.longitude, address: query || place.address })
      .eq("id", itemId);
    refresh(tripId);
    return { ok: true };
  }
  return { error: query ? "Couldn't find that address. Try adding the city." : "Couldn't find it. Type the address." };
}
