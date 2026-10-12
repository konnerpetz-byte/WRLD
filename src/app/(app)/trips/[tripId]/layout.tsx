import Link from "next/link";
import { Suspense } from "react";

import { TripTabs } from "@/components/layout/trip-tabs";
import { Progress } from "@/components/ui/progress";
import { getTrip } from "@/features/trips/queries";
import { formatDateRange, formatMoney, toNumber } from "@/lib/format";

export default function TripLayout({ children, params }: LayoutProps<"/trips/[tripId]">) {
  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/trips" className="text-sm text-muted-foreground hover:text-foreground">
        All trips
      </Link>
      <Suspense fallback={<HeaderSkeleton />}>
        <TripHeader params={params} />
      </Suspense>
      <Suspense fallback={<div className="h-[42px] border-b" />}>
        <TripTabs />
      </Suspense>
      <div className="pt-6">{children}</div>
    </div>
  );
}

async function TripHeader({ params }: { params: LayoutProps<"/trips/[tripId]">["params"] }) {
  const { tripId } = await params;
  const { trip, budget } = await getTrip(tripId);

  const projected = toNumber(budget?.projected_total) ?? 0;
  const limit = toNumber(trip.budget);
  const over = limit !== null && projected > limit;

  return (
    <header className="mt-2 mb-6 grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
      <div>
        <h1 className="text-4xl font-semibold">{trip.title}</h1>
        <p className="mt-1 text-muted-foreground">
          {[trip.destination, formatDateRange(trip.start_date, trip.end_date), `${trip.party_size} traveler${trip.party_size > 1 ? "s" : ""}`]
            .filter(Boolean)
            .join(", ")}
        </p>
      </div>
      <Link
        href={`/trips/${trip.id}/budget`}
        className="min-w-64 rounded-xl border bg-card px-4 py-3 hover:border-primary focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span className="flex items-baseline justify-between gap-4">
          <span className="text-sm text-muted-foreground">Trip total so far</span>
          <span className={`font-display text-2xl font-semibold ${over ? "text-destructive" : ""}`}>
            {formatMoney(projected, trip.currency)}
          </span>
        </span>
        {limit !== null && (
          <>
            <Progress value={Math.min(100, (projected / Math.max(limit, 1)) * 100)} className="mt-2 h-1.5" />
            <span className="mt-1 block text-xs text-muted-foreground">
              {over
                ? `${formatMoney(projected - limit, trip.currency)} over your ${formatMoney(limit, trip.currency)} budget`
                : `${formatMoney(limit - projected, trip.currency)} left of ${formatMoney(limit, trip.currency)}`}
            </span>
          </>
        )}
      </Link>
    </header>
  );
}

function HeaderSkeleton() {
  return (
    <div className="mt-2 mb-6 flex animate-pulse items-end justify-between gap-6" aria-hidden="true">
      <div>
        <div className="h-10 w-64 rounded-md bg-muted" />
        <div className="mt-2 h-4 w-80 rounded bg-muted" />
      </div>
      <div className="h-16 w-64 rounded-xl bg-muted" />
    </div>
  );
}
