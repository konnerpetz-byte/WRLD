import { BedDouble, FileUp, Plane, Ticket } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * The fastest way to fill a trip: bring in what's already booked. Shown big on
 * new or empty trips, and as a compact strip once the trip has travel in it.
 */
export function ImportBanner({ tripId, emptyTrip = false, compact = false }: { tripId: string; emptyTrip?: boolean; compact?: boolean }) {
  const href = `/trips/${tripId}/import`;
  if (compact) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-primary/40 bg-open-soft/60 px-4 py-3">
        <p className="flex items-center gap-2 text-sm">
          <FileUp className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>
            <strong>Booked something already?</strong> Paste the confirmation and it&rsquo;s filled in for you.
          </span>
        </p>
        <Button asChild size="sm">
          <Link href={href}>Import bookings</Link>
        </Button>
      </div>
    );
  }
  return (
    <section aria-labelledby="import-cta" className="mb-6 grid gap-4 overflow-hidden rounded-2xl bg-sidebar p-5 text-sidebar-foreground sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-6 sm:p-6">
      <div className="flex -space-x-2" aria-hidden="true">
        {[Plane, BedDouble, Ticket].map((Icon, i) => (
          <span key={i} className="grid size-11 place-items-center rounded-full border-2 border-sidebar bg-white/10 text-brand-cream">
            <Icon className="size-5" />
          </span>
        ))}
      </div>
      <div>
        <h2 id="import-cta" className="text-xl font-semibold text-white">
          {emptyTrip ? "Start with what you've already booked" : "Booked something already?"}
        </h2>
        <p className="mt-1 text-sm text-sidebar-foreground/85">
          Paste a confirmation email, or drop in a ticket PDF or calendar file. WRLD puts every flight, stay and ticket on the right
          day{emptyTrip ? ", and your first day starts when you land" : ""}. No typing.
        </p>
      </div>
      <Button asChild size="lg" className="h-11 bg-travel px-6 text-travel-foreground hover:bg-travel/90">
        <Link href={href}>
          <FileUp aria-hidden="true" /> Import bookings
        </Link>
      </Button>
    </section>
  );
}
