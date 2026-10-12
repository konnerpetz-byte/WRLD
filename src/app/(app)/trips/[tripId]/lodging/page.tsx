import { BedDouble, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { deleteLodging } from "@/features/trips/actions";
import { LodgingForm } from "@/features/trips/lodging-form";
import { getItinerary, getTrip } from "@/features/trips/queries";
import { formatMoney, formatPoints } from "@/lib/format";

export const metadata = { title: "Stays" };

export default async function LodgingPage({ params }: PageProps<"/trips/[tripId]/lodging">) {
  const { tripId } = await params;
  const [{ trip, canEdit }, { lodging }] = await Promise.all([getTrip(tripId), getItinerary(tripId)]);
  const when = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: trip.timezone }).format(new Date(iso));

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_26rem] lg:items-start">
      <section aria-labelledby="stays">
        <h2 id="stays" className="mb-4 text-xl font-semibold">Where you&rsquo;re staying</h2>
        {!lodging.length ? (
          <p className="rounded-xl border border-dashed bg-card p-6 text-muted-foreground">
            No stays yet. Add one and it shows up on your arrival day as the place to check in.
          </p>
        ) : (
          <ul className="grid gap-3">
            {lodging.map((stay) => {
              const nights = Math.round((new Date(stay.check_out_at).getTime() - new Date(stay.check_in_at).getTime()) / 86_400_000);
              return (
                <li key={stay.id} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_auto]">
                  <div>
                    <p className="flex items-center gap-2 font-display text-lg font-semibold">
                      <BedDouble className="size-4" aria-hidden="true" /> {stay.name}
                    </p>
                    {stay.address && <p className="text-sm text-muted-foreground">{stay.address}</p>}
                    <p className="mt-2 text-sm">
                      {when(stay.check_in_at)} to {when(stay.check_out_at)}, {nights} night{nights === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex items-start gap-3 sm:flex-col sm:items-end">
                    <span className="text-sm">
                      {stay.cost !== null && <span className="block font-medium">{formatMoney(stay.cost, stay.currency ?? trip.currency)}</span>}
                      {stay.points_used !== null && <span className="block text-muted-foreground">{formatPoints(stay.points_used)} points</span>}
                    </span>
                    {canEdit && (
                      <form action={deleteLodging.bind(null, tripId, stay.id)}>
                        <Button type="submit" variant="ghost" size="sm" aria-label={`Remove ${stay.name}`}>
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
      {canEdit && <LodgingForm tripId={tripId} tripCurrency={trip.currency} startDate={trip.start_date} endDate={trip.end_date} />}
    </div>
  );
}
