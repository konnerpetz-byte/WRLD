import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/layout/page-skeleton";
import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { PlannerView } from "@/features/planner/planner-view";

export const metadata: Metadata = {
  title: "Where can our budget take us?",
  description:
    "Enter a budget, where you fly from and how many are going. WRLD prices flights, hotel and days there for dozens of places and shows the trips that fit, including what your points can cover.",
  alternates: { canonical: "/plan" },
};

/** The budget-first planner, open to everyone: the dream trip that actually fits. */
export default function PublicPlanPage({ searchParams }: PageProps<"/plan">) {
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-5 pt-8 pb-20 sm:px-6 lg:pt-14">
        <h1 className="max-w-[40rem] font-display text-4xl leading-[1.05] font-bold tracking-[-0.03em] text-balance sm:text-5xl">
          Where can your budget take you?
        </h1>
        <p className="mt-4 mb-10 max-w-[38rem] text-lg text-muted-foreground">
          Put in what you can spend. WRLD prices the whole trip, flights, hotel and days there, and shows the places that fit. Got credit card points?
          Add them and watch the list grow. No account needed.
        </p>
        <Suspense fallback={<PageSkeleton />}>
          <Planner searchParams={searchParams} />
        </Suspense>
        <p className="mt-10 text-sm text-muted-foreground">
          Found one? <Link href="/signup" className="font-medium text-primary underline underline-offset-4">Start the trip</Link> and invite the group.
        </p>
      </main>
      <div className="border-t pb-[env(safe-area-inset-bottom)]">
        <SiteFooter />
      </div>
    </div>
  );
}

async function Planner({ searchParams }: { searchParams: PageProps<"/plan">["searchParams"] }) {
  const sp = (await searchParams) as Record<string, string | undefined>;
  return <PlannerView sp={sp} basePath="/plan" publicMode />;
}
