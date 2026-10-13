import { Suspense } from "react";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { Plus } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { startSteps } from "@/features/onboarding/progress";
import { StepList } from "@/features/onboarding/step-list";
import { formatDateRange, formatMoney } from "@/lib/format";
import { requireUserId } from "@/lib/supabase/server";
import type { Trip } from "@/types/database";

export const metadata = { title: "Trips" };

/** Today's date where the trip is, so "happening now" flips at local midnight. */
function todayIn(timeZone: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

type Row = Trip & { route: string; total: number | null; when: string };

export default function TripsPage(props: PageProps<"/trips">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TripsPageContent {...props} />
    </Suspense>
  );
}

async function TripsPageContent({ searchParams }: PageProps<"/trips">) {
  const { show } = await searchParams;
  const { supabase, userId } = await requireUserId();
  const [{ data: trips }, { data: budgets }, { data: stops }, steps] =
    await Promise.all([
      supabase.from("trips").select("*").order("start_date"),
      supabase
        .from("trip_budget_overview")
        .select("trip_id, projected_total, currency"),
      supabase
        .from("trip_stops")
        .select("trip_id, city, arrive_date, position")
        .order("arrive_date")
        .order("position"),
      startSteps(supabase, userId),
    ]);
  const totals = new Map((budgets ?? []).map((b) => [b.trip_id, b]));

  const now: Row[] = [];
  const upcoming: Row[] = [];
  const past: Row[] = [];
  for (const trip of trips ?? []) {
    const cities = (stops ?? [])
      .filter((s) => s.trip_id === trip.id)
      .map((s) => s.city);
    const today = todayIn(trip.timezone);
    const base = {
      ...trip,
      route: cities.length ? cities.join(" → ") : trip.destination ?? "",
      total: totals.get(trip.id)?.projected_total ?? null,
    };
    if (trip.end_date < today) {
      past.push({
        ...base,
        when: `${daysBetween(trip.end_date, today)} days ago`,
      });
    } else if (trip.start_date > today) {
      const n = daysBetween(today, trip.start_date);
      upcoming.push({ ...base, when: n === 1 ? "Tomorrow" : `In ${n} days` });
    } else {
      const day = daysBetween(trip.start_date, today) + 1;
      now.push({
        ...base,
        when: `Day ${day} of ${
          daysBetween(trip.start_date, trip.end_date) + 1
        }`,
      });
    }
  }
  past.sort((a, b) => b.end_date.localeCompare(a.end_date));

  const filter =
    show === "past" ? "past" : show === "upcoming" ? "upcoming" : "all";
  const tabs = [
    { key: "all", label: "All", count: (trips ?? []).length },
    { key: "upcoming", label: "Upcoming", count: now.length + upcoming.length },
    { key: "past", label: "Past", count: past.length },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold">Trips</h1>
          <p className="mt-1 text-muted-foreground">
            Every trip you&rsquo;re planning, on, or remembering.
          </p>
        </div>
        <Button asChild>
          <Link href="/trips/new">
            <Plus aria-hidden="true" /> New trip
          </Link>
        </Button>
      </header>

      {steps && (
        <div className="mb-8">
          <StepList
            id="get-started"
            title="Get started"
            intro="Four steps from “where should we go?” to knowing exactly how to pay for the flights."
            steps={steps}
          />
        </div>
      )}

      {!trips?.length ? (
        steps ? null : <div className="rounded-xl border border-dashed bg-card p-10 text-center">
          <h2 className="text-xl font-semibold">Where to first?</h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">
            Add the cities and dates. Your days and time blocks are set up for
            you, and they adjust once you add flights.
          </p>
          <Button asChild className="mt-6">
            <Link href="/trips/new">Plan a trip</Link>
          </Button>
        </div>
      ) : (
        <>
          <nav aria-label="Filter trips" className="mb-6 flex gap-2">
            {tabs.map((t) => (
              <Link
                key={t.key}
                href={t.key === "all" ? "/trips" : `/trips?show=${t.key}`}
                aria-current={filter === t.key ? "page" : undefined}
                className={`rounded-full border px-4 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-ring ${
                  filter === t.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card hover:border-primary"
                }`}
              >
                {t.label} <span className="opacity-70">{t.count}</span>
              </Link>
            ))}
          </nav>

          <div className="grid gap-8">
            {filter !== "past" && (
              <TripSection title="Happening now" rows={now} tone="now" />
            )}
            {filter !== "past" && (
              <TripSection
                title="Upcoming"
                rows={upcoming}
                empty={
                  filter === "upcoming" && !now.length
                    ? "Nothing booked ahead yet."
                    : undefined
                }
              />
            )}
            {filter !== "upcoming" && (
              <TripSection
                title="Past trips"
                rows={past}
                empty={filter === "past" ? "No past trips yet." : undefined}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function TripSection({
  title,
  rows,
  tone,
  empty,
}: {
  title: string;
  rows: Row[];
  tone?: "now";
  empty?: string;
}) {
  if (!rows.length && !empty) return null;
  const id = `section-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-3 text-xl font-semibold">
        {title}
      </h2>
      {!rows.length ? (
        <p className="rounded-xl border border-dashed bg-card p-6 text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <ul
          className={`divide-y rounded-xl border bg-card ${
            tone === "now" ? "border-primary" : ""
          }`}
        >
          {rows.map((trip) => (
            <li key={trip.id}>
              <Link
                href={`/trips/${trip.id}`}
                className="grid gap-1 px-5 py-4 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-6"
              >
                <span className="min-w-0">
                  <span className="block font-display text-lg font-semibold">
                    {trip.title}
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {[
                      trip.route,
                      formatDateRange(trip.start_date, trip.end_date),
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </span>
                <Badge variant={tone === "now" ? "default" : "secondary"}>
                  {trip.when}
                </Badge>
                <span className="text-sm sm:text-right">
                  <span className="font-medium">
                    {formatMoney(trip.total ?? 0, trip.currency)}
                  </span>{" "}
                  <span className="text-muted-foreground sm:block">
                    planned
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
