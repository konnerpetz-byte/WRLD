import { Radio } from "lucide-react";

import { disconnectSeatsAero } from "./actions";

/**
 * Live seats status: link a Seats.aero Pro account ("Login with Seats.aero") so
 * the explorer searches real, current award space with the traveler's own access.
 */
export function LiveLink({ connected, seats, error, notice }: { connected: boolean; seats: number; error?: string; notice?: string | null }) {
  if (connected) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-open-soft px-4 py-2.5 text-sm" role="status">
        <span className="inline-flex items-center gap-1.5 font-medium text-primary">
          <Radio className="size-4" aria-hidden="true" /> Live seats on
        </span>
        <span className="text-muted-foreground">
          {error ?? `${seats.toLocaleString()} live award ${seats === 1 ? "seat" : "seats"} from Seats.aero for this search.`}
        </span>
        <form action={disconnectSeatsAero} className="ml-auto">
          <button type="submit" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
            Disconnect
          </button>
        </form>
      </div>
    );
  }
  return (
    <div className="grid gap-2 rounded-2xl border bg-card p-4 sm:flex sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 font-medium">
          <Radio className="size-4 text-primary" aria-hidden="true" /> See live award seats from 26 programs
        </p>
        <p className="text-sm text-muted-foreground">
          Link your Seats.aero Pro account and the explorer searches real, current seats and taxes for every route, including cheap
          domestic flights. Uses your own Seats.aero access; WRLD never sees your password.
        </p>
        {notice && <p className="mt-1 text-sm font-medium text-destructive">{notice}</p>}
      </div>
      <a
        href="/api/seats/connect"
        className="inline-flex min-h-10 w-fit shrink-0 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-[transform,background-color] hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-safe:active:scale-[0.97]"
      >
        Connect Seats.aero
      </a>
    </div>
  );
}
