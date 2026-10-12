import Link from "next/link";

import { WrldMark } from "@/components/brand/wrld-mark";
import { Wordmark } from "@/components/layout/wordmark";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Wordmark className="text-foreground" />
        <Button asChild variant="ghost">
          <Link href="/login">Sign in</Link>
        </Button>
      </header>

      <main>
        {/* Hero: one promise, one action, the product itself */}
        <section className="mx-auto grid max-w-6xl gap-12 px-6 pt-10 pb-20 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:pt-16">
          <div>
            <h1 className="text-5xl leading-[1.02] font-bold sm:text-6xl">Plan the trip you&rsquo;ll actually take.</h1>
            <p className="mt-6 max-w-lg text-lg text-muted-foreground">
              WRLD builds each day around your real flight times, maps your route, and adds every ticket and point to
              one budget.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button asChild size="lg" className="h-12 bg-travel px-7 text-base text-travel-foreground hover:bg-travel/90">
                <Link href="/signup">Plan a trip, free</Link>
              </Button>
              <Link href="#how" className="font-medium text-primary underline-offset-4 hover:underline">
                See how it works
              </Link>
            </div>
          </div>
          <HeroProduct />
        </section>

        {/* Three concrete benefits, each shown with a real example */}
        <section id="how" aria-labelledby="how-title" className="border-t bg-card">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 id="how-title" className="max-w-2xl text-3xl font-bold sm:text-4xl">
              Built around the parts other planners skip.
            </h2>
            <div className="mt-12 grid gap-10 md:grid-cols-3">
              <Benefit
                title="Days start when you land"
                body="Add your flight and WRLD blocks out the time before you land and after you leave. An 11 PM arrival becomes a check-in, not a wasted evening."
                example={
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="hatched h-12 rounded-md border" />
                    <div className="hatched h-12 rounded-md border" />
                    <div className="perforated flex h-12 flex-col justify-center rounded-md bg-travel px-2 text-travel-foreground">
                      <span className="text-[10px]">Land 11 PM</span>
                      <span className="text-xs font-semibold">Check in</span>
                    </div>
                  </div>
                }
              />
              <Benefit
                title="See your route"
                body="Every activity lands on a map in the order you'll visit it, starting from your hotel, so a day that zig-zags across town is obvious before you go."
                example={<MiniMap className="h-24 w-full rounded-md" />}
              />
              <Benefit
                title="Know the total"
                body="Ticket prices are looked up and multiplied by your group. Flights, stays and points add up as you plan."
                example={
                  <div className="rounded-md bg-sidebar px-3 py-2 text-sidebar-foreground">
                    <p className="text-[11px]">This trip costs</p>
                    <p className="text-2xl font-bold text-brand-cream">$1,982</p>
                    <p className="text-[11px] text-travel">+ 60,000 points</p>
                  </div>
                }
              />
            </div>
          </div>
        </section>

        {/* Closing call to action repeats the one action */}
        <section className="bg-sidebar text-sidebar-foreground">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-16 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <WrldMark className="size-14 shrink-0" />
              <p className="max-w-md text-2xl font-semibold text-brand-cream">Your next trip, planned around how you travel.</p>
            </div>
            <Button asChild size="lg" className="h-12 bg-travel px-7 text-base text-travel-foreground hover:bg-travel/90">
              <Link href="/signup">Plan a trip, free</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-6 py-8 text-sm text-muted-foreground">
        Map data © OpenStreetMap contributors.
      </footer>
    </div>
  );
}

function Benefit({ title, body, example }: { title: string; body: string; example: React.ReactNode }) {
  return (
    <div className="grid content-start gap-4">
      <div className="rounded-xl border bg-background p-3">{example}</div>
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="text-muted-foreground">{body}</p>
    </div>
  );
}

/** The hero shows the product: a day's route on a map beside its plan. */
function HeroProduct() {
  return (
    <div className="relative rounded-2xl bg-brand p-4 shadow-[0_30px_60px_-30px_rgb(29_43_38/0.6)] sm:p-5" aria-label="Example: a day in Lisbon">
      <div className="grid gap-3 sm:grid-cols-[1.1fr_1fr]">
        <MiniMap fit="meet" className="aspect-[4/3] w-full rounded-xl sm:aspect-auto sm:h-full" />
        <div className="grid content-start gap-2 rounded-xl bg-card p-3">
          <p className="flex items-baseline justify-between text-sm">
            <span className="font-semibold">Mon, Nov 2</span>
            <span className="text-xs text-muted-foreground">4.1 mi</span>
          </p>
          {[
            ["◆", "Memmo Alfama", "Start the day here", "stay"],
            ["1", "Tram 28 and the Alfama", "Morning", "activity"],
            ["2", "Pena Palace, Sintra", "Afternoon, €40", "activity"],
            ["3", "Fado in Mouraria", "Evening, €90", "activity"],
          ].map(([n, title, detail, kind]) => (
            <div key={title} className="flex items-center gap-2.5 rounded-lg border px-2.5 py-2">
              <span
                className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
                  kind === "stay" ? "bg-sidebar text-sidebar-foreground" : "bg-brand text-brand-cream"
                }`}
              >
                {n}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{title}</span>
                <span className="block text-xs text-muted-foreground">{detail}</span>
              </span>
            </div>
          ))}
          <p className="mt-1 flex items-baseline justify-between border-t pt-2 text-sm">
            <span className="text-muted-foreground">Trip total</span>
            <span className="text-lg font-bold">€1,982</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/** A drawn (not live) map for marketing: water, streets, a numbered route. */
function MiniMap({ className = "", fit = "slice" }: { className?: string; fit?: "slice" | "meet" }) {
  const pins: [number, number, string, string][] = [
    [62, 128, "◆", "var(--sidebar)"],
    [118, 92, "1", "var(--brand)"],
    [196, 58, "2", "var(--brand)"],
    [232, 132, "3", "var(--brand)"],
  ];
  return (
    <svg viewBox="0 0 300 200" className={className} role="img" aria-label="Map with a numbered route between four stops" preserveAspectRatio={`xMidYMid ${fit}`} style={{ background: "#F7EEE5" }}>
      <rect width="300" height="200" fill="#F7EEE5" />
      <path d="M0 160 C60 150 110 175 170 168 S260 150 300 158 V200 H0Z" fill="#C9DAD2" />
      <g stroke="#E6D8CA" strokeWidth="6" fill="none" strokeLinecap="round">
        <path d="M-10 40 L310 70" />
        <path d="M40 -10 L90 210" />
        <path d="M150 -10 L170 150" />
        <path d="M-10 110 L310 100" />
        <path d="M240 -10 L260 150" />
      </g>
      <path d="M62 128 L118 92 L196 58 L232 132 L62 128" fill="none" stroke="var(--brand)" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
      {pins.map(([x, y, label, fill]) => (
        <g key={label} transform={`translate(${x} ${y})`}>
          <circle r="11" fill={fill} stroke="#FBE8D8" strokeWidth="2.5" />
          <text textAnchor="middle" dy="4" fontSize="11" fontWeight="700" fill="#FBE8D8">
            {label}
          </text>
        </g>
      ))}
    </svg>
  );
}
