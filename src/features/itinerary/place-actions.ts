"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fromAttraction, wikidataPlace } from "@/features/attractions/search";
import { myInterests, suggestionsForBlock } from "@/features/experiences/for-trip";
import { suggestExperiences } from "@/features/experiences/suggest";
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
  source: z.preprocess(blankToNull, z.enum(["official", "wikidata", "nearby", "osm"]).nullable()),
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

async function resolvePick(supabase: Supabase, source: string | null, ref: string | null, near: Point | null, name?: string) {
  if (!source || !ref) return null;
  if (source === "osm") {
    // An OpenStreetMap place from the category search: the ref is its coordinates.
    const m = ref.match(/^(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)$/);
    if (!m || !name) return null;
    const p = { latitude: Number(m[1]), longitude: Number(m[2]) };
    if (Math.abs(p.latitude) > 90 || Math.abs(p.longitude) > 180) return null;
    return namedSuggestion({ name, ...p, address: null });
  }
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
  input: {
    title: string;
    place: PlaceSuggestion | null;
    address: string | null;
    unitPrice: number | null;
    startTime: string | null;
    /** A bookable listing (Viator…): its price, link and length */
    offer?: { provider: string; ref: string; url: string; price: number | null; currency: string; durationMinutes: number | null } | null;
  },
): Promise<ActionState & { itemId?: string }> {
  const { trip, days, items } = loaded;
  const day = days.find((d) => d.id === block.day_id)!;
  const place = input.place;
  const notes: string[] = [];

  // Where is it? Picked places carry coordinates; otherwise look up the
  // address (or the name) near that day's city.
  let point: { latitude: number; longitude: number; address: string | null } | null = place
    ? { latitude: place.latitude, longitude: place.longitude, address: place.address }
    : null;
  // Tours start at a meeting point the listing doesn't give us; leave those for the traveler to pin.
  if (!point && !input.offer) {
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
  if (!start && (place || input.offer)) {
    const plan = planTime({
      block,
      timeZone: day.timeZone,
      busyUntil: items.filter((i) => i.time_block_id === block.id).map((i) => i.end_time?.slice(0, 5) ?? i.start_time?.slice(0, 5) ?? null),
      suggestedStart: place?.suggestedStart ?? null,
      durationMinutes: place?.durationMinutes ?? input.offer?.durationMinutes ?? null,
    });
    start = plan.start;
    end = plan.end;
    if (place?.bestSlot && place.bestSlot !== block.slot) {
      notes.push(`Best in the ${SLOT_LABEL[place.bestSlot].toLowerCase()}${place.suggestedStart ? ` (from ${formatClock(place.suggestedStart)})` : ""}.`);
    }
  }

  // Price: what you typed → bookable listing → official price → provider lookup.
  let price: Record<string, unknown> = {};
  if (input.offer) {
    price = {
      unit_price: input.offer.price,
      currency: input.offer.currency,
      price_source: input.offer.price === null ? null : "provider",
      provider: input.offer.provider,
      provider_ref: input.offer.ref,
      booking_url: input.offer.url,
      price_checked_at: input.offer.price === null ? null : new Date().toISOString(),
    };
  } else if (input.unitPrice !== null) {
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
  } else if (place?.source === "osm") {
    notes.push("Free to visit or price not listed. Add a price if you spend money there.");
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

  const { data: inserted, error } = await supabase.from("itinerary_items").insert({
    trip_id: trip.id,
    time_block_id: block.id,
    title: place?.name ?? input.title,
    kind: input.offer ? "tour" : place ? "sightseeing" : "activity",
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
  }).select("id").single();
  if (error || !inserted) return { error: "Only owners and editors can add to this trip." };

  const when = start ? `${formatClock(start)}${end ? `–${formatClock(end)}` : ""}` : null;
  return {
    ok: true,
    itemId: inserted.id,
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

  const place = await resolvePick(supabase, input.source, input.ref, day.point, input.title);
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
  let place = await resolvePick(supabase, input.source, input.ref, anchor, input.title);
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

  const place = await resolvePick(supabase, parsed.data.source, parsed.data.ref, day.point, parsed.data.title);
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

// ---------------------------------------------------------------------------
// A saved spot (reel, TikTok, link) → onto a day, with time and map pin
// ---------------------------------------------------------------------------
export async function addSpotToItinerary(tripId: string, spotId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const dayId = z.preprocess(blankToNull, z.uuid().nullable()).catch(null).parse(formData.get("day_id"));
  const { supabase, userId } = await requireUserId();
  const [loaded, { data: spot }] = await Promise.all([
    loadTrip(supabase, tripId),
    supabase.from("saved_spots").select("*").eq("id", spotId).eq("trip_id", tripId).maybeSingle(),
  ]);
  if (!loaded || !spot) return { error: "Couldn't find that spot." };

  let place: PlaceSuggestion | null = null;
  if (spot.attraction_id) place = await resolvePick(supabase, "official", spot.attraction_id, null);
  if (!place && spot.latitude !== null && spot.longitude !== null) {
    place = {
      source: "nearby",
      ref: spot.id,
      name: spot.place_name ?? spot.title ?? "Saved spot",
      detail: null,
      latitude: spot.latitude,
      longitude: spot.longitude,
      address: spot.address,
      officialUrl: null,
      ticketsUrl: null,
      timedEntry: false,
      bestSlot: null,
      suggestedStart: null,
      durationMinutes: null,
      price: null,
      currency: null,
      priceNote: null,
      hoursNote: null,
      visitNote: null,
      km: null,
    };
  }

  const block = chooseBlock(loaded, place, dayId);
  if (!block) return { error: "Every part of the trip is taken by travel." };
  const result = await insertItem(supabase, userId, loaded, block, {
    title: spot.place_name ?? spot.title?.slice(0, 200) ?? "Saved spot",
    place,
    address: spot.address,
    unitPrice: null,
    startTime: null,
  });
  if (result.ok && result.itemId) {
    // Keep the link to the video on the itinerary item, and the item on the spot.
    if (spot.url) {
      await supabase
        .from("itinerary_items")
        .update({ description: `Saved from ${spot.url}` })
        .eq("id", result.itemId)
        .is("description", null);
    }
    await supabase.from("saved_spots").update({ itinerary_item_id: result.itemId }).eq("id", spot.id);
    refresh(tripId);
  }
  return { ok: result.ok, error: result.error, note: result.note };
}

// ---------------------------------------------------------------------------
// Bookable experiences (Viator…) suggested for a block
// ---------------------------------------------------------------------------
export async function addExperience(tripId: string, blockId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id") ?? "").slice(0, 120);
  const { supabase, userId } = await requireUserId();
  const loaded = await loadTrip(supabase, tripId);
  if (!loaded) return { error: "Trip not found." };
  const block = loaded.days.flatMap((d) => d.blocks).find((b) => b.id === blockId);
  if (!block) return { error: "That part of the day no longer exists." };

  // Look the listing up again on the server (cached), so prices can't be edited in the browser.
  const result = await suggestionsForBlock(supabase, userId, tripId, blockId, 20);
  const offer = result?.offers.find((o) => o.id === id);
  if (!offer) return { error: "That listing isn't available anymore. Refresh the suggestions." };

  const added = await insertItem(supabase, userId, loaded, block, {
    title: offer.title.slice(0, 200),
    place: null,
    address: null,
    unitPrice: null,
    startTime: null,
    offer: {
      provider: offer.provider,
      ref: offer.id,
      url: offer.url,
      price: offer.price,
      currency: offer.currency,
      durationMinutes: offer.durationMinutes,
    },
  });
  if (added.ok) refresh(tripId);
  return { ok: added.ok, error: added.error, note: added.ok ? "Added. Book it on the provider's site to lock in your spot." : undefined };
}

/** From the Travel type carousel: put a bookable listing on the best free block in that city. */
export async function addOfferToTrip(tripId: string, city: string, offerId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const dayId = String(formData.get("day_id") ?? "").slice(0, 64) || null;
  const { supabase, userId } = await requireUserId();
  const loaded = await loadTrip(supabase, tripId);
  if (!loaded) return { error: "Trip not found." };
  const { data: trip } = await supabase.from("trips").select("currency").eq("id", tripId).single();
  const result = await suggestExperiences({
    city,
    currency: trip?.currency ?? "USD",
    interests: await myInterests(supabase, userId),
    limit: 30,
  });
  const offer = result.offers.find((o) => o.id === offerId);
  if (!offer) return { error: "That listing isn't available anymore." };

  const chosen = dayId ? loaded.days.filter((d) => d.id === dayId) : [];
  const inCity = loaded.days.filter((d) => d.city === city);
  const days = chosen.length ? chosen : inCity.length ? inCity : loaded.days;
  const order: TimeBlockSlot[] = offer.slot ? [offer.slot, ...SLOTS.filter((s) => s !== offer.slot)] : ["afternoon", "morning", "evening"];
  const busy = new Set(loaded.items.map((i) => i.time_block_id));
  let block: TimeBlock | undefined;
  for (const preferEmpty of [true, false]) {
    for (const slot of order) {
      block = days.flatMap((d) => d.blocks).find((b) => b.slot === slot && b.status !== "unavailable" && (!preferEmpty || !busy.has(b.id)));
      if (block) break;
    }
    if (block) break;
  }
  if (!block) return { error: "No free time left in that city." };

  const added = await insertItem(supabase, userId, loaded, block, {
    title: offer.title.slice(0, 200),
    place: null,
    address: null,
    unitPrice: null,
    startTime: null,
    offer: { provider: offer.provider, ref: offer.id, url: offer.url, price: offer.price, currency: offer.currency, durationMinutes: offer.durationMinutes },
  });
  if (!added.ok) return added;
  refresh(tripId);
  const day = loaded.days.find((d) => d.id === block!.day_id)!;
  const [y, m, d] = day.date.split("-").map(Number);
  const when = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
  return { ok: true, note: `Added to ${when}, ${SLOT_LABEL[block.slot].toLowerCase()}.` };
}

// ---------------------------------------------------------------------------
// A named place from "Picked for your travel type" (cafés near your stay…)
// ---------------------------------------------------------------------------
const namedSchema = z.object({
  name: z.string().trim().min(1).max(200),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  address: z.preprocess(blankToNull, z.string().trim().max(300).nullable()),
});

function namedSuggestion(p: { name: string; latitude: number; longitude: number; address: string | null }, bestSlot: TimeBlockSlot | null = null): PlaceSuggestion {
  return {
    source: "osm", ref: `${p.latitude},${p.longitude}`, name: p.name, detail: null, latitude: p.latitude, longitude: p.longitude, address: p.address,
    officialUrl: null, ticketsUrl: null, timedEntry: false, bestSlot, suggestedStart: null, durationMinutes: null,
    price: null, currency: null, priceNote: null, hoursNote: null, visitNote: null, km: null,
  };
}

/** One-tap add from recommendation cards: picks the best day (nearest city) and part of the day. */
export async function addNamedPlaceToTrip(tripId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = namedSchema
    .extend({
      slot: z.enum(["morning", "afternoon", "evening"]).nullable().catch(null),
      day_id: z.preprocess(blankToNull, z.string().max(64).nullable()).catch(null),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Couldn't add that place." };
  const { supabase, userId } = await requireUserId();
  const loaded = await loadTrip(supabase, tripId);
  if (!loaded) return { error: "Trip not found." };
  const place = namedSuggestion(parsed.data, parsed.data.slot);
  const block = chooseBlock(loaded, place, parsed.data.day_id) ?? chooseBlock(loaded, place, null);
  if (!block) return { error: "Every part of the trip is taken by travel. Add more days on Edit trip." };
  const result = await insertItem(supabase, userId, loaded, block, { title: place.name, place, address: place.address, unitPrice: null, startTime: null });
  if (result.ok) {
    const day = loaded.days.find((d) => d.id === block.day_id)!;
    const [y, m, d] = day.date.split("-").map(Number);
    const label = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
    result.note = `Added to ${label}, ${SLOT_LABEL[block.slot].toLowerCase()}.`;
    refresh(tripId);
  }
  return result;
}

export async function addNamedPlace(tripId: string, blockId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = namedSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Couldn't add that place." };
  const { supabase, userId } = await requireUserId();
  const loaded = await loadTrip(supabase, tripId);
  if (!loaded) return { error: "Trip not found." };
  const block = loaded.days.flatMap((d) => d.blocks).find((b) => b.id === blockId);
  if (!block) return { error: "That part of the day no longer exists. Refresh and try again." };
  const day = loaded.days.find((d) => d.id === block.day_id)!;
  const p = parsed.data;
  // Places come from a nearby search; refuse anything implausibly far from that day's city.
  if (day.point && distanceKm(day.point, p) > 80) return { error: "That place is too far from this day's city." };

  const result = await insertItem(supabase, userId, loaded, block, {
    title: p.name,
    place: namedSuggestion(p),
    address: p.address,
    unitPrice: null,
    startTime: null,
  });
  if (result.ok) refresh(tripId);
  return result;
}
