import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";

import { requireUserId } from "@/lib/supabase/server";
import type { ItineraryItem, Lodging, TimeBlock, TransitSegment, TripDay, TripStop } from "@/types/database";

/** The trip + its budget numbers. Cached per request, so layout and pages share one fetch. */
export const getTrip = cache(async (tripId: string) => {
  const { supabase, userId } = await requireUserId();
  const [{ data: trip }, { data: budget }, { data: member }, { data: stops }] = await Promise.all([
    supabase.from("trips").select("*").eq("id", tripId).maybeSingle(),
    supabase.from("trip_budget_overview").select("*").eq("trip_id", tripId).maybeSingle(),
    supabase.from("trip_members").select("role").eq("trip_id", tripId).eq("user_id", userId).maybeSingle(),
    supabase.from("trip_stops").select("*").eq("trip_id", tripId).order("arrive_date").order("position"),
  ]);
  if (!trip) notFound();
  return {
    trip,
    stops: (stops ?? []) as TripStop[],
    budget, role: member?.role ?? "viewer", canEdit: member?.role === "owner" || member?.role === "editor" };
});

export type DayPlan = TripDay & {
  blocks: (TimeBlock & { items: ItineraryItem[] })[];
  /** The city you're in that day, and its clock */
  stop: TripStop | null;
  tz: string;
};

export const getItinerary = cache(async (tripId: string) => {
  const { supabase, userId } = await requireUserId();
  const [{ trip, stops }, days, blocks, items, transit, lodging, votes] = await Promise.all([
    getTrip(tripId),
    supabase.from("trip_days").select("*").eq("trip_id", tripId).order("date"),
    supabase.from("time_blocks").select("*").eq("trip_id", tripId).order("starts_at"),
    supabase.from("itinerary_items").select("*").eq("trip_id", tripId).order("position").order("created_at"),
    supabase.from("transit_segments").select("*").eq("trip_id", tripId).order("depart_at"),
    supabase.from("lodging").select("*").eq("trip_id", tripId).order("check_in_at"),
    supabase.from("item_votes").select("item_id, user_id").eq("trip_id", tripId),
  ]);

  const voteCounts = new Map<string, { count: number; mine: boolean }>();
  for (const v of votes.data ?? []) {
    const cur = voteCounts.get(v.item_id) ?? { count: 0, mine: false };
    voteCounts.set(v.item_id, { count: cur.count + 1, mine: cur.mine || v.user_id === userId });
  }

  const itemsByBlock = new Map<string, ItineraryItem[]>();
  for (const item of items.data ?? []) {
    itemsByBlock.set(item.time_block_id, [...(itemsByBlock.get(item.time_block_id) ?? []), item]);
  }
  const blocksByDay = new Map<string, DayPlan["blocks"]>();
  for (const block of blocks.data ?? []) {
    blocksByDay.set(block.day_id, [...(blocksByDay.get(block.day_id) ?? []), { ...block, items: itemsByBlock.get(block.id) ?? [] }]);
  }

  return {
    days: (days.data ?? []).map((d) => ({
      ...d,
      blocks: blocksByDay.get(d.id) ?? [],
      stop: stops.find((s) => s.id === d.stop_id) ?? null,
      tz: d.timezone ?? trip.timezone,
    })) as DayPlan[],
    transit: (transit.data ?? []) as TransitSegment[],
    lodging: (lodging.data ?? []) as Lodging[],
    votes: voteCounts,
  };
});
