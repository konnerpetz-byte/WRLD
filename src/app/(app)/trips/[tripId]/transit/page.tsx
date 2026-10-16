
import { ImportBanner } from "@/features/import/import-banner";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { ArrowRight, ExternalLink, Trash2 } from "lucide-react";
import Link from "next/link";

import { pointsOrCashUrl, tripAirport } from "@/features/onboarding/progress";
import { requireUserId } from "@/lib/supabase/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteTransit } from "@/features/trips/actions";
import { getItinerary, getTrip } from "@/features/trips/queries";
import { allTimezones } from "@/features/trips/timezones";
import { EditableLeg } from "@/features/trips/editable-leg";
import { TransitForm } from "@/features/trips/transit-form";
import { findTicketsLinks, MODE, placeLabel } from "@/features/transit/modes";
import { formatMoney, formatPoints } from "@/lib/format";

export const metadata = { title: "Flights & transit" };

const DIRECTION = {
  outbound: "Getting there",
  within: "Between stops",
  return: "Going home",
} as const;

function localTime(iso: string, tz: string | null) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz ?? "UTC",
    timeZoneName: "short",
  }).format(new Date(iso));
}

export default function TransitPage(
  props: PageProps<"/trips/[tripId]/transit">
) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TransitPageContent {...props} />
    </Suspense>
  );
}

async function TransitPageContent({
  params,
}: PageProps<"/trips/[tripId]/transit">) {
  const { tripId } = await params;
  const { supabase, userId } = await requireUserId();
  const [{ trip, canEdit, stops }, { transit }, { data: profile }] = await Promise.all([
    getTrip(tripId),
    getItinerary(tripId),
    supabase.from("profiles").select("home_airport").eq("id", userId).maybeSingle(),
  ]);
  const home = profile?.home_airport ?? null;
  const there = tripAirport(stops);
  const needsFlight = !transit.some((l) => l.mode === "flight" && l.direction === "outbound");
  const zones = allTimezones();

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_26rem] lg:items-start">
      {canEdit && needsFlight && (
        <Link
          href={pointsOrCashUrl({ from: home, to: there, date: trip.start_date, tripId })}
          className="group flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-sidebar px-5 py-4 text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:col-span-2"
        >
          <span>
            <span className="block font-semibold text-brand-cream">Not booked yet? Cost it with your points</span>
            <span className="block text-sm text-sidebar-foreground/80">
              Flights {home ?? "from home"} to {there ?? "your first stop"}, hotel and days there: the least cash with the points you have.
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-travel px-4 py-2 text-sm font-medium text-travel-foreground">
            Compare <ArrowRight className="size-4 transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </Link>
      )}
      {canEdit && (
        <div className="lg:col-span-2">
          <ImportBanner tripId={tripId} compact />
        </div>
      )}
      <section aria-labelledby="legs">
        <h2 id="legs" className="mb-4 text-xl font-semibold">
          Your legs
        </h2>
        {!transit.length ? (
          <p className="rounded-xl border border-dashed bg-card p-6 text-muted-foreground">
            Nothing yet. Add the flight that gets you there, plus any trains,
            buses, ferries or drives between stops. The itinerary blocks out
            the travel time and the time you need to get to the terminal.
          </p>
        ) : (
          <ul className="grid gap-3">
            {transit.map((leg) => {
              const mode = MODE[leg.mode];
              const Icon = mode.icon;
              const fromPlace = placeLabel(leg.origin_code, leg.origin_name);
              const toPlace = placeLabel(leg.destination_code, leg.destination_name);
              const links = mode.usesCodes || leg.mode === "car" ? [] : findTicketsLinks(leg.mode, fromPlace, toPlace).slice(0, 1);
              return (
                <EditableLeg
                  key={leg.id}
                  leg={leg}
                  tripId={tripId}
                  tripTimezone={trip.timezone}
                  tripCurrency={trip.currency}
                  timezones={zones}
                  canEdit={canEdit}
                  label={`${mode.label} ${leg.service_number ?? ""} from ${fromPlace ?? ""}`.replace(/\s+/g, " ").trim()}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Icon className="size-4" aria-hidden="true" />
                      <span className="sr-only">{mode.label}:</span>
                      <span className="font-display text-lg font-semibold">
                        {leg.service_number ?? leg.carrier ?? mode.label}
                      </span>
                      <Badge variant="secondary">
                        {DIRECTION[leg.direction]}
                      </Badge>
                      {leg.carrier && leg.service_number && (
                        <span className="text-sm text-muted-foreground">
                          {leg.carrier}
                        </span>
                      )}
                      {leg.booking_status !== "booked" && (
                        <Badge variant="outline">
                          {leg.booking_status === "idea"
                            ? "Idea"
                            : leg.booking_status === "held"
                            ? "On hold"
                            : "Cancelled"}
                        </Badge>
                      )}
                    </div>
                    <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-muted-foreground">
                          Departs {fromPlace}
                        </dt>
                        <dd>{localTime(leg.depart_at, leg.origin_timezone)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">
                          Arrives {toPlace}
                        </dt>
                        <dd>
                          {localTime(leg.arrive_at, leg.destination_timezone)}
                        </dd>
                      </div>
                    </dl>
                    {links.map((l) => (
                      <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2">
                        {l.label} <ExternalLink className="size-3" aria-hidden="true" />
                      </a>
                    ))}
                  </div>
                  <div className="flex items-start gap-3 sm:flex-col sm:items-end">
                    <span className="text-sm">
                      {leg.cost !== null && (
                        <span className="block font-medium">
                          {formatMoney(leg.cost, leg.currency ?? trip.currency)}
                        </span>
                      )}
                      {leg.points_used !== null && (
                        <span className="block text-muted-foreground">
                          {formatPoints(leg.points_used)} points
                        </span>
                      )}
                    </span>
                    {canEdit && (
                      <form action={deleteTransit.bind(null, tripId, leg.id)}>
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          aria-label={`Remove ${
                            leg.service_number ?? mode.label
                          }`}
                        >
                          <Trash2 aria-hidden="true" /> Remove
                        </Button>
                      </form>
                    )}
                  </div>
                </EditableLeg>
              );
            })}
          </ul>
        )}
      </section>
      {canEdit && (
        <TransitForm
          tripId={tripId}
          tripTimezone={trip.timezone}
          tripCurrency={trip.currency}
          timezones={zones}
        />
      )}
    </div>
  );
}
