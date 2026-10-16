import { Suspense } from "react";

import { PageSkeleton } from "@/components/layout/page-skeleton";
import { PlannerView } from "@/features/planner/planner-view";

export const metadata = { title: "Explore" };

/** Explore: budget first. "Where can my cash and points take me?" */
export default function ExplorePage({ searchParams }: PageProps<"/points">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Explore searchParams={searchParams} />
    </Suspense>
  );
}

async function Explore({ searchParams }: { searchParams: PageProps<"/points">["searchParams"] }) {
  const sp = (await searchParams) as Record<string, string | undefined>;
  // Old links from a trip ("?trip=…") now open the planner inside that trip.
  return <PlannerView sp={sp} basePath="/points" />;
}
