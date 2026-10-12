import Link from "next/link";

import { DayGrid } from "@/features/itinerary/day-grid";
import { getItinerary, getTrip } from "@/features/trips/queries";

export const metadata = { title: "Itinerary" };

export default async function ItineraryPage({ params }: PageProps<"/trips/[tripId]/itinerary">) {
  const { tripId } = await params;
  const [{ trip, canEdit }, { days, transit, lodging }] = await Promise.all([getTrip(tripId), getItinerary(tripId)]);

  return (
    <>
      {!transit.some((t) => t.direction === "outbound") && (
        <p className="mb-4 rounded-lg border border-travel bg-travel-soft px-4 py-3 text-sm">
          Add your flight or train there and the first day will start when you actually arrive.{" "}
          <Link href={`/trips/${tripId}/transit`} className="font-medium underline underline-offset-2">
            Add travel
          </Link>
        </p>
      )}
      <DayGrid trip={trip} days={days} transit={transit} lodging={lodging} canEdit={canEdit} />
    </>
  );
}
