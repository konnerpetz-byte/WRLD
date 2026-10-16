import "server-only";

import { nearestAirports } from "@/features/places/airports";
import type { requireUserId } from "@/lib/supabase/server";
import type { TripStop } from "@/types/database";

import type { Step } from "./step-list";

type Supabase = Awaited<ReturnType<typeof requireUserId>>["supabase"];

/** The airport a trip flies into: the first stop's nearest real airport. */
export function tripAirport(stops: Pick<TripStop, "latitude" | "longitude">[]): string | null {
  const s = stops.find((x) => x.latitude != null && x.longitude != null);
  if (!s) return null;
  return nearestAirports({ latitude: s.latitude!, longitude: s.longitude! }, 1)[0]?.code ?? null;
}

/** "Points or cash" prefilled for one flight of a trip. */
export function pointsOrCashUrl(o: { from: string | null; to: string | null; date: string; tripId?: string }) {
  const p = new URLSearchParams();
  if (o.from) p.set("from", o.from);
  if (o.to) p.set("to", o.to);
  p.set("start", o.date);
  p.set("end", o.date);
  if (o.tripId) p.set("trip", o.tripId);
  return `/points?${p}`;
}

/**
 * The first-run path, in the order WRLD is built around:
 * how you travel → what points you have → a trip → how to pay for its flights.
 * Returns null once every step is done (the guide goes away).
 */
export async function startSteps(supabase: Supabase, userId: string): Promise<Step[] | null> {
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: traveler }, { data: profile }, { count: programs }, { data: trips }] = await Promise.all([
    supabase.from("traveler_profiles").select("quiz_completed_at").eq("user_id", userId).maybeSingle(),
    supabase.from("profiles").select("home_airport").eq("id", userId).maybeSingle(),
    supabase.from("loyalty_accounts").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("trips").select("id, title, start_date").gte("end_date", today).order("start_date").limit(1),
  ]);
  const trip = trips?.[0] ?? null;
  const [{ count: flights }, { data: stops }] = trip
    ? await Promise.all([
        supabase.from("transit_segments").select("id", { count: "exact", head: true }).eq("trip_id", trip.id).eq("mode", "flight"),
        supabase.from("trip_stops").select("latitude, longitude").eq("trip_id", trip.id).order("arrive_date").order("position").limit(3),
      ])
    : [{ count: 0 }, { data: [] }];

  const home = profile?.home_airport ?? null;
  const steps: Step[] = [
    {
      key: "type",
      title: "Find your travel type",
      body: "Ten quick questions. WRLD uses your answers to suggest what to do on every trip.",
      done: Boolean(traveler?.quiz_completed_at),
      href: traveler?.quiz_completed_at ? "/profile" : "/profile/quiz",
      cta: "Take the quiz",
    },
    {
      key: "points",
      title: "Add your points and home airport",
      body: "Your card and airline balances, so WRLD can tell you which ones pay for a flight. Two minutes, no logins.",
      done: Boolean(programs) && Boolean(home),
      doneNote: home ? `flying from ${home}` : undefined,
      href: "/points/wallet",
      cta: programs ? "Set your home airport" : "Add your points",
    },
    {
      key: "trip",
      title: "Start a trip",
      body: "Where and when. Invite friends now or later; WRLD sets up the days for you.",
      done: Boolean(trip),
      doneNote: trip?.title,
      href: trip ? `/trips/${trip.id}` : "/trips/new",
      cta: "Plan a trip",
    },
    {
      key: "flights",
      title: "Cost the trip with your points",
      body: "Flights, hotel and days there, with the best way to use each point against your budget. Then add the flight you book.",
      done: Boolean(flights),
      href: trip ? pointsOrCashUrl({ from: home, to: tripAirport((stops ?? []) as TripStop[]), date: trip.start_date, tripId: trip.id }) : "/points",
      cta: "Cost it with my points",
      secondary: trip ? { href: `/trips/${trip.id}/transit`, label: "I've already booked" } : undefined,
    },
  ];
  return steps.every((s) => s.done) ? null : steps;
}
