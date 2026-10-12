import { Suspense } from "react";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { ExternalLink, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteTransit } from "@/features/trips/actions";
import { getItinerary, getTrip } from "@/features/trips/queries";
import { allTimezones } from "@/features/trips/timezones";
import { TransitForm } from "@/features/trips/transit-form";
import { findTicketsLinks, MODE, placeLabel } from "@/features/transit/modes";
import { formatMoney, formatPoints } from "@/lib/format";

export const metadata = { title: "Getting around" };

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
  const [{ trip, canEdit }, { transit }] = await Promise.all([
    getTrip(tripId),
    getItinerary(tripId),
  ]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_26rem] lg:items-start">
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
                <li
                  key={leg.id}
                  className="perforated grid gap-3 rounded-xl border bg-card p-4 pl-6 sm:grid-cols-[1fr_auto]"
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
                </li>
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
          timezones={allTimezones()}
        />
      )}
    </div>
  );
}
