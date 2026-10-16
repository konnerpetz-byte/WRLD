import { Suspense } from "react";

import { PageSkeleton } from "@/components/layout/page-skeleton";
import { loadExport } from "@/features/export/data";
import { ExportBuilder } from "@/features/export/export-builder";
import { type BookingOption, TripFiles } from "@/features/export/trip-files";
import { getTrip } from "@/features/trips/queries";
import { formatDay } from "@/lib/format";

export const metadata = { title: "Export" };

/** Take the trip with you: tickets and files kept together, and the whole trip in the formats you want. */
export default function ExportPage({ params }: PageProps<"/trips/[tripId]/export">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Export params={params} />
    </Suspense>
  );
}

async function Export({ params }: { params: PageProps<"/trips/[tripId]/export">["params"] }) {
  const { tripId } = await params;
  const [{ canEdit }, data] = await Promise.all([getTrip(tripId), loadExport(tripId, { signFiles: false })]);
  const bookings: BookingOption[] = [
    ...data.transit.map((e) => ({ id: e.bookingId, type: "transit" as const, label: `${formatDay(e.date)} · ${e.title}` })),
    ...data.stays.filter((e) => e.type === "stay_in").map((e) => ({ id: e.bookingId, type: "lodging" as const, label: `${formatDay(e.date)} · ${e.title.replace(/^Check in: /, "Stay: ")}` })),
    ...data.items.map((e) => ({ id: e.bookingId, type: "item" as const, label: `${formatDay(e.date)} · ${e.title}` })),
  ].sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="grid gap-10">
      <section aria-labelledby="files-h" className="grid gap-3">
        <div>
          <h2 id="files-h" className="text-xl font-semibold">
            Tickets &amp; files
          </h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Keep boarding passes, tickets and confirmations with the booking they belong to. They go into every export.
          </p>
        </div>
        <TripFiles
          tripId={tripId}
          canEdit={canEdit}
          bookings={bookings}
          files={data.files.map((f) => ({ id: f.id, name: f.name, path: f.path, size: f.size, bookingId: f.bookingId }))}
        />
      </section>

      <section aria-labelledby="export-h" className="grid gap-4">
        <div>
          <h2 id="export-h" className="text-xl font-semibold">
            Export the trip
          </h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Choose what goes in and in what order, then download. The .zip has everything, including your tickets, and works offline.
          </p>
        </div>
        <ExportBuilder tripId={tripId} fileCount={data.files.length} />
      </section>
    </div>
  );
}
