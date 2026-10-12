import { Plus } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateRange, formatMoney } from "@/lib/format";
import { requireUserId } from "@/lib/supabase/server";

export const metadata = { title: "Trips" };

const STATUS_LABEL: Record<string, string> = {
  planning: "Planning",
  booked: "Booked",
  in_progress: "Happening now",
  completed: "Done",
  archived: "Archived",
};

export default async function TripsPage() {
  const { supabase } = await requireUserId();
  const [{ data: trips }, { data: budgets }] = await Promise.all([
    supabase.from("trips").select("*").order("start_date"),
    supabase.from("trip_budget_overview").select("trip_id, projected_total, currency"),
  ]);
  const totals = new Map((budgets ?? []).map((b) => [b.trip_id, b]));

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold">Trips</h1>
          <p className="mt-1 text-muted-foreground">Every trip you&rsquo;re planning or sharing with someone.</p>
        </div>
        <Button asChild>
          <Link href="/trips/new">
            <Plus aria-hidden="true" /> New trip
          </Link>
        </Button>
      </header>

      {!trips?.length ? (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center">
          <h2 className="text-xl font-semibold">Where to first?</h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">
            Add a trip with its dates. Your days and time blocks are set up for you, and they adjust once you add flights.
          </p>
          <Button asChild className="mt-6">
            <Link href="/trips/new">Plan a trip</Link>
          </Button>
        </div>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {trips.map((trip) => {
            const total = totals.get(trip.id);
            return (
              <li key={trip.id}>
                <Link
                  href={`/trips/${trip.id}/itinerary`}
                  className="grid gap-1 px-5 py-4 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-6"
                >
                  <span>
                    <span className="block font-display text-lg font-semibold">{trip.title}</span>
                    <span className="text-sm text-muted-foreground">
                      {[trip.destination, formatDateRange(trip.start_date, trip.end_date)].filter(Boolean).join(", ")}
                    </span>
                  </span>
                  <Badge variant="secondary">{STATUS_LABEL[trip.status]}</Badge>
                  <span className="text-right text-sm">
                    <span className="block font-medium">{formatMoney(total?.projected_total ?? 0, trip.currency)}</span>
                    <span className="text-muted-foreground">planned</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
