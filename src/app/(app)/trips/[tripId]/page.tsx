import { Suspense } from "react";

import { PageSkeleton } from "@/components/layout/page-skeleton";
import { pointsOrCashUrl, tripAirport } from "@/features/onboarding/progress";
import { type Step, StepList } from "@/features/onboarding/step-list";
import { getTrip } from "@/features/trips/queries";
import { formatMoney } from "@/lib/format";
import { requireUserId } from "@/lib/supabase/server";

export const metadata = { title: "Plan" };

/**
 * A trip's front page: the plan, step by step, in the order trips get booked.
 * Each step is done when the trip has it, so the next one is always obvious.
 */
export default function TripPlanPage(props: PageProps<"/trips/[tripId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TripPlan {...props} />
    </Suspense>
  );
}

async function TripPlan({ params }: PageProps<"/trips/[tripId]">) {
  const { tripId } = await params;
  const { supabase, userId } = await requireUserId();
  const [{ trip, stops }, { data: profile }, flights, stays, members, invites, items] = await Promise.all([
    getTrip(tripId),
    supabase.from("profiles").select("home_airport").eq("id", userId).maybeSingle(),
    supabase.from("transit_segments").select("direction, origin_code, destination_code").eq("trip_id", tripId).eq("mode", "flight"),
    supabase.from("lodging").select("id", { count: "exact", head: true }).eq("trip_id", tripId),
    supabase.from("trip_members").select("user_id", { count: "exact", head: true }).eq("trip_id", tripId),
    supabase.from("trip_invites").select("id", { count: "exact", head: true }).eq("trip_id", tripId).is("revoked_at", null),
    supabase.from("itinerary_items").select("id", { count: "exact", head: true }).eq("trip_id", tripId).neq("kind", "note"),
  ]);

  const home = profile?.home_airport ?? null;
  const there = tripAirport(stops);
  const legs = flights.data ?? [];
  const hasOut = legs.some((l) => l.direction === "outbound");
  const hasBack = legs.some((l) => l.direction === "return");
  const people = members.count ?? 1;
  const base = `/trips/${tripId}`;

  const steps: Step[] = [
    {
      key: "flights",
      title: "Cost this trip with your points",
      body: `Flights ${home ?? "from your airport"} to ${there ?? trip.destination ?? "your first stop"}, the hotel and your days there, with the best way to use each point against your budget. Then add the flight you book.`,
      done: hasOut,
      doneNote: hasBack ? "both ways" : "flight there added",
      href: pointsOrCashUrl({ from: home, to: there, date: trip.start_date, tripId }),
      cta: "Cost it with my points",
      secondary: { href: `${base}/transit`, label: "I've already booked" },
    },
    {
      key: "stay",
      title: "Where you'll stay",
      body: "Add your hotel or rental. Each day starts and ends there on the map.",
      done: Boolean(stays.count),
      href: `${base}/lodging`,
      cta: "Add a stay",
    },
    {
      key: "group",
      title: "Bring your group",
      body: "Invite friends to plan, vote on ideas, chat and split costs. Free for everyone.",
      done: people > 1 || Boolean(invites.count),
      doneNote: people > 1 ? `${people} people` : "invite sent",
      href: `${base}/group`,
      cta: "Invite people",
    },
    {
      key: "days",
      title: "Plan the days",
      body: "Pick from ideas matched to your travel type, or add your own. Official ticket pages and times are filled in.",
      done: Boolean(items.count),
      doneNote: items.count ? `${items.count} plans` : undefined,
      href: `${base}/itinerary`,
      cta: "Plan day 1",
    },
    {
      key: "budget",
      title: "Set the budget",
      body: "One number for the trip. WRLD adds up flights, stays and tickets in cash and points and shows what's left each day.",
      done: trip.budget != null,
      doneNote: trip.budget != null ? formatMoney(Number(trip.budget), trip.currency, { cents: false }) : undefined,
      href: `${base}/budget`,
      cta: "Set a budget",
    },
  ];

  return (
    <div className="max-w-3xl">
      <StepList
        id="trip-plan"
        title={steps.every((s) => s.done) ? "Everything's in place" : "Your plan"}
        intro={steps.every((s) => s.done) ? "Keep adding to the days, or check the budget as bookings come in." : "Do these in any order. The next one is highlighted."}
        steps={steps}
      />
    </div>
  );
}
