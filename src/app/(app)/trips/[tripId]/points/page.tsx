import { Suspense } from "react";

import { PageSkeleton } from "@/components/layout/page-skeleton";
import { PlannerView } from "@/features/planner/planner-view";

export const metadata = { title: "Cost with points" };

/** This trip, priced with your points: flights, hotel and days there, against the trip budget. */
export default function TripPointsPage({ params, searchParams }: PageProps<"/trips/[tripId]/points">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TripPoints params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function TripPoints({ params, searchParams }: Pick<PageProps<"/trips/[tripId]/points">, "params" | "searchParams">) {
  const { tripId } = await params;
  const sp = (await searchParams) as Record<string, string | undefined>;
  return <PlannerView sp={sp} basePath={`/trips/${tripId}/points`} tripId={tripId} />;
}
