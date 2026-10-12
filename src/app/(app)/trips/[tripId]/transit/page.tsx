import { Plane, TrainFront, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteTransit } from "@/features/trips/actions";
import { getItinerary, getTrip } from "@/features/trips/queries";
import { allTimezones } from "@/features/trips/timezones";
import { TransitForm } from "@/features/trips/transit-form";
import { formatMoney, formatPoints } from "@/lib/format";

export const metadata = { title: "Flights & trains" };

const DIRECTION = { outbound: "Getting there", within: "Between stops", return: "Going home" } as const;

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

export default async function TransitPage({ params }: PageProps<"/trips/[tripId]/transit">) {
  const { tripId } = await params;
  const [{ trip, canEdit }, { transit }] = await Promise.all([getTrip(tripId), getItinerary(tripId)]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_26rem] lg:items-start">
      <section aria-labelledby="legs">
        <h2 id="legs" className="mb-4 text-xl font-semibold">Your legs</h2>
        {!transit.length ? (
          <p className="rounded-xl border border-dashed bg-card p-6 text-muted-foreground">
            No flights or trains yet. Add the one that gets you there, and the itinerary will block out the time before you land.
          </p>
        ) : (
          <ul className="grid gap-3">
            {transit.map((leg) => {
              const Icon = leg.mode === "train" ? TrainFront : Plane;
              return (
                <li key={leg.id} className="perforated grid gap-3 rounded-xl border bg-card p-4 pl-6 sm:grid-cols-[1fr_auto]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Icon className="size-4" aria-hidden="true" />
                      <span className="font-display text-lg font-semibold">
                        {leg.service_number ?? leg.carrier ?? leg.mode}
                      </span>
                      <Badge variant="secondary">{DIRECTION[leg.direction]}</Badge>
                      {leg.carrier && leg.service_number && <span className="text-sm text-muted-foreground">{leg.carrier}</span>}
                      {leg.booking_status !== "booked" && <Badge variant="outline">{leg.booking_status === "idea" ? "Idea" : leg.booking_status === "held" ? "On hold" : "Cancelled"}</Badge>}
                    </div>
                    <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-muted-foreground">Departs {leg.origin_code}</dt>
                        <dd>{localTime(leg.depart_at, leg.origin_timezone)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Arrives {leg.destination_code}</dt>
                        <dd>{localTime(leg.arrive_at, leg.destination_timezone)}</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="flex items-start gap-3 sm:flex-col sm:items-end">
                    <span className="text-sm">
                      {leg.cost !== null && <span className="block font-medium">{formatMoney(leg.cost, leg.currency ?? trip.currency)}</span>}
                      {leg.points_used !== null && <span className="block text-muted-foreground">{formatPoints(leg.points_used)} points</span>}
                    </span>
                    {canEdit && (
                      <form action={deleteTransit.bind(null, tripId, leg.id)}>
                        <Button type="submit" variant="ghost" size="sm" aria-label={`Remove ${leg.service_number ?? leg.mode}`}>
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
      {canEdit && <TransitForm tripId={tripId} tripTimezone={trip.timezone} tripCurrency={trip.currency} timezones={allTimezones()} />}
    </div>
  );
}
