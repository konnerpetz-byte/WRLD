import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";

import { requireUserId } from "@/lib/supabase/server";
import type { ItineraryItem, Lodging, TimeBlock, TransitSegment, TripDay } from "@/types/database";

/** The trip + its budget numbers. Cached per request, so layout and pages share one fetch. */
export const getTrip = cache(async (tripId: string) => {
  const { supabase, userId } = await requireUserId();
  const [{ data: trip }, { data: budget }, { data: member }] = await Promise.all([
    supabase.from("trips").select("*").eq("id", tripId).maybeSingle(),
    supabase.from("trip_budget_overview").select("*").eq("trip_id", tripId).maybeSingle(),
    supabase.from("trip_members").select("role").eq("trip_id", tripId).eq("user_id", userId).maybeSingle(),
  ]);
  if (!trip) notFound();
  return { trip, budget, role: member?.role ?? "viewer", canEdit: member?.role === "owner" || member?.role === "editor" };
});

export type DayPlan = TripDay & { blocks: (TimeBlock & { items: ItineraryItem[] })[] };

export const getItinerary = cache(async (tripId: string) => {
  const { supabase } = await requireUserId();
  const [days, blocks, items, transit, lodging] = await Promise.all([
    supabase.from("trip_days").select("*").eq("trip_id", tripId).order("date"),
    supabase.from("time_blocks").select("*").eq("trip_id", tripId).order("starts_at"),
    supabase.from("itinerary_items").select("*").eq("trip_id", tripId).order("position").order("created_at"),
    supabase.from("transit_segments").select("*").eq("trip_id", tripId).order("depart_at"),
    supabase.from("lodging").select("*").eq("trip_id", tripId).order("check_in_at"),
  ]);

  const itemsByBlock = new Map<string, ItineraryItem[]>();
  for (const item of items.data ?? []) {
    itemsByBlock.set(item.time_block_id, [...(itemsByBlock.get(item.time_block_id) ?? []), item]);
  }
  const blocksByDay = new Map<string, DayPlan["blocks"]>();
  for (const block of blocks.data ?? []) {
    blocksByDay.set(block.day_id, [...(blocksByDay.get(block.day_id) ?? []), { ...block, items: itemsByBlock.get(block.id) ?? [] }]);
  }

  return {
    days: (days.data ?? []).map((d) => ({ ...d, blocks: blocksByDay.get(d.id) ?? [] })) as DayPlan[],
    transit: (transit.data ?? []) as TransitSegment[],
    lodging: (lodging.data ?? []) as Lodging[],
  };
});
