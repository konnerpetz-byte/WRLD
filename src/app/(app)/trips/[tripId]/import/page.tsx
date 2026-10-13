import Link from "next/link";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/layout/page-skeleton";
import { ImportFlow } from "@/features/import/import-flow";
import { allTimezones } from "@/features/trips/timezones";
import { getTrip } from "@/features/trips/queries";

export const metadata = { title: "Import bookings" };

export default function ImportPage(props: PageProps<"/trips/[tripId]/import">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ImportContent {...props} />
    </Suspense>
  );
}

async function ImportContent({ params }: PageProps<"/trips/[tripId]/import">) {
  const { tripId } = await params;
  const { canEdit } = await getTrip(tripId);
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div>
        <h2 className="text-2xl font-semibold">Import bookings</h2>
        <p className="mt-1 text-muted-foreground">
          Already booked flights, a hotel or tickets? Bring them in and WRLD puts each one on the right day: flights and trains under
          Getting around, places to sleep under Stays, and tickets into the itinerary.
        </p>
      </div>
      {canEdit ? (
        <ImportFlow tripId={tripId} timezones={allTimezones()} />
      ) : (
        <p className="rounded-xl border border-dashed bg-card p-5 text-sm">
          Only the trip&rsquo;s organizers can add bookings. Ask one of them, or{" "}
          <Link href={`/trips/${tripId}/group`} className="font-medium text-primary underline underline-offset-2">
            post it in the group chat
          </Link>
          .
        </p>
      )}
    </div>
  );
}
