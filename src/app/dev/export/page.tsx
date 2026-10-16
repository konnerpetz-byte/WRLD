import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ExportBuilder } from "@/features/export/export-builder";
import { TripFiles } from "@/features/export/trip-files";
import { WelcomeTour } from "@/features/onboarding/welcome-tour";

/** Development-only: export controls and the first-run tour, for design and accessibility review. */
export default function ExportPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto grid max-w-5xl gap-10 p-6">
      <h1 className="text-4xl font-semibold">Export</h1>
      <TripFiles
        tripId="x"
        canEdit
        bookings={[
          { id: "t1", type: "transit", label: "Tue, Nov 10 · Flight DTW → LIS · Delta 128" },
          { id: "l1", type: "lodging", label: "Wed, Nov 11 · Stay: Memmo Alfama" },
        ]}
        files={[
          { id: "f1", name: "Boarding pass DL128.pdf", path: "x/f1", size: 182000, bookingId: "t1" },
          { id: "f2", name: "Memmo confirmation.pdf", path: "x/f2", size: 96000, bookingId: "l1" },
        ]}
      />
      <ExportBuilder tripId="x" fileCount={2} />
      <Suspense>
        <WelcomeTour seen={false} />
      </Suspense>
    </main>
  );
}
