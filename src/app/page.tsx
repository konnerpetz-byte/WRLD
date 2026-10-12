import Link from "next/link";

import { Wordmark } from "@/components/layout/wordmark";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-dvh bg-sidebar text-sidebar-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="text-white">
          <Wordmark />
        </span>
        <Button asChild variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
          <Link href="/login">Sign in</Link>
        </Button>
      </header>

      <main className="mx-auto grid max-w-6xl gap-12 px-6 pt-12 pb-24 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div>
          <h1 className="text-5xl leading-[1.05] font-semibold text-white sm:text-6xl">
            Your trip starts when you land.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-sidebar-foreground/85">
            Layover builds each day around your real flight times, pulls in your points balances, and adds every ticket
            to one budget — so the plan you make is the trip you can take.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-board text-board-foreground hover:bg-board/90">
              <Link href="/signup">Plan a trip</Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
              <Link href="/login">I have an account</Link>
            </Button>
          </div>
        </div>

        <ArrivalPreview />
      </main>
    </div>
  );
}

/** A miniature day grid: the product's core idea in one picture. */
function ArrivalPreview() {
  const days = [
    { day: "Sun, Nov 1", blocks: ["hatched", "hatched", "arrival"] },
    { day: "Mon, Nov 2", blocks: ["Tram 28 + Alfama", "Sintra palaces", "Fado dinner"] },
    { day: "Tue, Nov 3", blocks: ["LX Factory", "departure", "hatched"] },
  ];
  return (
    <div className="rounded-2xl bg-background p-4 text-foreground shadow-2xl" aria-label="Example itinerary">
      <div className="mb-3 grid grid-cols-[6rem_repeat(3,1fr)] gap-2 px-1 text-xs text-muted-foreground">
        <span />
        <span>Morning</span>
        <span>Afternoon</span>
        <span>Evening</span>
      </div>
      {days.map(({ day, blocks }) => (
        <div key={day} className="grid grid-cols-[6rem_repeat(3,1fr)] gap-2 py-1">
          <span className="self-center text-sm font-medium">{day}</span>
          {blocks.map((b, i) =>
            b === "hatched" ? (
              <div key={i} className="hatched h-14 rounded-md border" />
            ) : b === "arrival" || b === "departure" ? (
              <div key={i} className="perforated flex h-14 flex-col justify-center rounded-md bg-board px-3 text-board-foreground">
                <span className="text-xs">{b === "arrival" ? "Land 11:00 PM" : "Leave by noon"}</span>
                <span className="text-sm font-semibold">{b === "arrival" ? "Check in" : "TP 213 home"}</span>
              </div>
            ) : (
              <div key={i} className="flex h-14 items-center rounded-md bg-lagoon-soft px-3 text-sm">
                {b}
              </div>
            ),
          )}
        </div>
      ))}
      <div className="mt-4 flex items-baseline justify-between border-t pt-3 text-sm">
        <span className="text-muted-foreground">Planned so far</span>
        <span className="font-display text-2xl font-semibold">$1,284</span>
      </div>
    </div>
  );
}
