import { Suspense } from "react";

import { PageSkeleton } from "@/components/layout/page-skeleton";
import { GroupBudgetCard } from "@/features/budget/group-budget-card";
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
  const [{ trip, stops, canEdit }, { data: profile }, flights, stays, members, invites, items, comfort] = await Promise.all([
    getTrip(tripId),
    supabase.from("profiles").select("home_airport").eq("id", userId).maybeSingle(),
    supabase.from("transit_segments").select("direction, origin_code, destination_code").eq("trip_id", tripId).eq("mode", "flight"),
    supabase.from("lodging").select("id", { count: "exact", head: true }).eq("trip_id", tripId),
    supabase.from("trip_members").select("user_id", { count: "exact", head: true }).eq("trip_id", tripId),
    supabase.from("trip_invites").select("id", { count: "exact", head: true }).eq("trip_id", tripId).is("revoked_at", null),
    supabase.from("itinerary_items").select("id", { count: "exact", head: true }).eq("trip_id", tripId).neq("kind", "note"),
    supabase.rpc("trip_budget_comfort_summary", { p_trip_id: tripId }),
  ]);
  const c = comfort.data?.[0];
  const comfortSummary = {
    responses: Number(c?.responses ?? 0),
    members: Number(c?.members ?? 1),
    comfortable: c?.comfortable == null ? null : Number(c.comfortable),
    mine: c?.mine == null ? null : Number(c.mine),
  };

  const home = profile?.home_airport ?? null;
  const there = tripAirport(stops);
  const legs = flights.data ?? [];
  const hasOut = legs.some((l) => l.direction === "outbound");
  const hasBack = legs.some((l) => l.direction === "return");
  const people = members.count ?? 1;
  const base = `/trips/${tripId}`;

  // In the order a group trip actually comes together: who's coming, what everyone can spend,
  // then getting there, staying and the days, all planned to that number.
  const steps: Step[] = [
    {
      key: "group",
      title: "Bring your group",
      body: "Invite everyone who's coming. Each person gets to set their own private max, vote on ideas and see who owes what. Free for everyone.",
      done: people > 1 || Boolean(invites.count),
      doneNote: people > 1 ? `${people} people` : "invite sent",
      href: `${base}/group`,
      cta: "Invite people",
    },
    {
      key: "budget",
      title: "Agree on a budget without the awkward talk",
      body: "Everyone answers privately below. The group only sees the lowest number, and WRLD plans the whole trip to it.",
      done: trip.budget != null,
      doneNote: trip.budget != null ? formatMoney(Number(trip.budget), trip.currency, { cents: false }) : undefined,
      href: "#group-budget",
      cta: "Set my max",
    },
    {
      key: "flights",
      title: "Price getting there",
      body: `Flights ${home ? `from ${home}` : "from your airport"} to ${there ?? trip.destination ?? "your first stop"} in cash, or with points if anyone has them. Then add the flight you book.`,
      done: hasOut,
      doneNote: hasBack ? "both ways" : "flight there added",
      href: pointsOrCashUrl({ from: home, to: there, date: trip.start_date, tripId }),
      cta: "Price flights",
      secondary: { href: `${base}/transit`, label: "We've already booked" },
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
      key: "days",
      title: "Plan the days",
      body: "Ideas matched to how each of you likes to travel, with official ticket sites and times filled in.",
      done: Boolean(items.count),
      doneNote: items.count ? `${items.count} plans` : undefined,
      href: `${base}/itinerary`,
      cta: "Plan day 1",
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
      <div id="group-budget" className="mt-10 scroll-mt-20">
        <GroupBudgetCard
          tripId={tripId}
          currency={trip.currency}
          partySize={trip.party_size}
          summary={comfortSummary}
          canEdit={canEdit}
          currentBudget={trip.budget == null ? null : Number(trip.budget)}
        />
      </div>
    </div>
  );
}
