import Image from "next/image";
import Link from "next/link";

import { LegalLinks } from "@/components/layout/legal-links";

import { LisbonDayMap, LisbonWalkMap } from "@/components/brand/lisbon-day-map";
import { WrldMark } from "@/components/brand/wrld-mark";
import { Wordmark } from "@/components/layout/wordmark";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-dvh bg-background">
      {/* Translucent bar: the page scrolls under it; a hairline appears only once content is beneath. */}
      <header className="material-light scroll-edge sticky top-0 z-30 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3.5">
          <Link href="/" aria-label="WRLD home" className="rounded-md text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button asChild variant="ghost">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild className="max-sm:hidden">
              <Link href="/signup">Take the quiz, free</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero: one promise, one action, the product itself */}
        <section className="mx-auto grid max-w-6xl gap-12 px-6 pt-10 pb-20 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:pt-16">
          <div>
            <h1 className="text-[2.75rem] leading-[1.04] font-bold tracking-[-0.035em] sm:text-[3.5rem]">
              <span className="block">Take the quiz.</span>
              <span className="block">Set your budget.</span>
              <span className="block text-primary">We&rsquo;ll take it from here.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted-foreground">
              WRLD plans each day around your real flights and the way you like to travel, then prices the whole trip in cash
              and points, at a budget everyone in the group can afford.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button asChild size="lg" className="h-12 bg-travel px-7 text-base text-travel-foreground hover:bg-travel/90">
                <Link href="/signup">Take the quiz, free</Link>
              </Button>
              <Link href="#how" className="rounded-md px-1 py-2 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                See how it works
              </Link>
            </div>
          </div>
          <HeroProduct />
        </section>

        {/* A real place from the example day: the view a few streets from Memmo Alfama */}
        <figure className="relative isolate overflow-hidden bg-sidebar">
          <Image
            src="/photos/lisbon-alfama-sunset.webp"
            alt="Lisbon at sunset from the Alfama: red roofs running down to the Tagus, with the 25 de Abril bridge in the distance"
            width={2400}
            height={1800}
            sizes="100vw"
            className="h-[58vh] max-h-[680px] min-h-80 w-full object-cover object-[50%_62%]"
          />
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-6 pt-32 pb-8 text-white">
            <div className="mx-auto max-w-6xl">
              <p className="max-w-xl font-display text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">The Alfama at 7:51&nbsp;PM.</p>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-white/90 sm:text-base">
                A few streets from Memmo Alfama, the stay in the day above. Land in the morning, and WRLD keeps the evening free for a view
                like this.
              </p>
            </div>
          </figcaption>
        </figure>

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
                example={<LisbonWalkMap className="h-24 w-full rounded-md" />}
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

        {/* What sets WRLD apart: points, group, official tickets, saved reels */}
        <section aria-labelledby="more-title" className="border-t">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">For points travelers and their friends</p>
            <h2 id="more-title" className="mt-2 max-w-2xl text-3xl font-bold sm:text-4xl">
              One app from &ldquo;where should we go?&rdquo; to the last ticket.
            </h2>
            <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              <Benefit
                title="Points explorer"
                body="See where your miles and card points can fly you from home, cheapest first, and which balance covers it."
                example={
                  <div className="rounded-md bg-card px-3 py-2 text-xs shadow-sm">
                    <p className="flex justify-between font-semibold">
                      <span>Lisbon</span>
                      <span>60k</span>
                    </p>
                    <p className="text-muted-foreground">Business, nonstop</p>
                    <p className="mt-1.5 rounded bg-open-soft px-1.5 py-0.5 font-medium text-primary">Your Chase points can book this</p>
                  </div>
                }
              />
              <Benefit
                title="Plan as a group"
                body="Invite friends, chat in the trip, vote on plans and split costs. WRLD shows how your travel types fit together."
                example={
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2" aria-hidden="true">
                      {["K", "S", "A"].map((l, i) => (
                        <span key={l} className={`grid size-9 place-items-center rounded-full border-2 border-background text-sm font-semibold ${["bg-brand text-brand-cream", "bg-travel text-travel-foreground", "bg-sidebar text-sidebar-foreground"][i]}`}>
                          {l}
                        </span>
                      ))}
                    </div>
                    <div className="text-xs">
                      <p className="text-2xl leading-none font-bold">82</p>
                      <p className="text-muted-foreground">Good match</p>
                    </div>
                  </div>
                }
              />
              <Benefit
                title="Official tickets, not resellers"
                body="Type São Jorge Castle or Pena Palace and get the official ticket page, timed-entry rules and the best time to go."
                example={
                  <div className="flex items-center gap-3 rounded-md bg-card p-2 text-xs shadow-sm">
                    <Image
                      src="/photos/lisbon-sao-jorge-castle.webp"
                      alt="The walls of São Jorge Castle above Lisbon's rooftops"
                      width={1200}
                      height={1600}
                      sizes="56px"
                      className="h-[5.5rem] w-14 shrink-0 rounded object-cover"
                    />
                    <span className="grid gap-0.5">
                      <span className="font-semibold">São Jorge Castle</span>
                      <span className="text-muted-foreground">Afternoon, from 5:00 PM</span>
                      <span className="mt-1 w-fit rounded bg-travel-soft px-1.5 py-0.5 font-medium">Official site</span>
                    </span>
                  </div>
                }
              />
              <Benefit
                title="Import what you've booked"
                body="Paste a confirmation email or drop in a ticket PDF or calendar file. Flights, stays and tickets land on the right day. No typing."
                example={
                  <div className="grid gap-1.5 text-xs">
                    <div className="rounded-md bg-card px-2.5 py-1.5 shadow-sm">
                      <p className="font-semibold">Your flight is confirmed</p>
                      <p className="truncate text-muted-foreground">UA 958 · DTW → LIS · Nov 2, 6:05 PM</p>
                    </div>
                    <p className="flex items-center gap-1.5 rounded-md bg-travel px-2.5 py-1.5 font-medium text-travel-foreground">
                      <span aria-hidden="true">↓</span> Added to Day 1: lands 7:20 AM
                    </p>
                  </div>
                }
              />
            </div>
          </div>
        </section>

        {/* Real trips, matched to different travel types */}
        <section aria-labelledby="trips-title" className="border-t bg-card">
          <div className="mx-auto max-w-6xl px-6 pt-20 pb-6">
            <h2 id="trips-title" className="max-w-2xl text-3xl font-bold sm:text-4xl">
              Every trip, matched to how you travel.
            </h2>
            <p className="mt-3 max-w-xl text-muted-foreground">Photos from our founder&rsquo;s own trips this summer: a city, a coast, a lake town, a beach and a ruin.</p>
          </div>
          <ul className="mx-auto flex max-w-6xl snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-20 [scrollbar-width:none] lg:grid lg:grid-cols-5 lg:overflow-visible [&::-webkit-scrollbar]:hidden">
            {TRIPS.map((t) => (
              <li key={t.src} className="w-[68%] shrink-0 snap-start sm:w-[42%] lg:w-auto">
                <figure className="group overflow-hidden rounded-2xl bg-muted">
                  <div className="relative aspect-[4/5] overflow-hidden">
                    <Image
                      src={t.src}
                      alt={t.alt}
                      fill
                      sizes="(min-width: 1024px) 20vw, (min-width: 640px) 42vw, 68vw"
                      className="object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.04]"
                      style={{ objectPosition: t.focus }}
                    />
                  </div>
                  <figcaption className="grid gap-0.5 px-3 py-3">
                    <span className="text-sm font-semibold">{t.place}</span>
                    <span className="text-xs text-muted-foreground">{t.type}</span>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </section>

        {/* Closing call to action repeats the one action */}
        <section className="bg-sidebar text-sidebar-foreground">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-16 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <WrldMark className="size-14 shrink-0" />
              <p className="max-w-md text-2xl font-semibold text-brand-cream">Your next trip, planned around how you travel.</p>
            </div>
            <Button asChild size="lg" className="h-12 bg-travel px-7 text-base text-travel-foreground hover:bg-travel/90">
              <Link href="/signup">Take the quiz, free</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground">
        <p>
          © 2026 WRLD. Map data ©{" "}
          <a href="https://www.openstreetmap.org/copyright" className="underline underline-offset-4">
            OpenStreetMap contributors
          </a>
          .
        </p>
        <LegalLinks />
      </footer>
    </div>
  );
}

const TRIPS = [
  { src: "/photos/porto-douro-dusk.webp", place: "Porto, Portugal", type: "For food and culture lovers", alt: "Dusk over the Douro river in Porto, with houses stepping down to the water", focus: "50% 50%" },
  { src: "/photos/marseille-calanque.webp", place: "Marseille, France", type: "For outdoor swimmers", alt: "A turquoise cove among white limestone cliffs in the Marseille calanques", focus: "45% 60%" },
  { src: "/photos/annecy-canal.webp", place: "Annecy, France", type: "For slow wanderers", alt: "Annecy's canal lined with flower boxes and cafés, mountains behind", focus: "45% 55%" },
  { src: "/photos/arrabida-beach.webp", place: "Arrábida, Portugal", type: "For a day off the itinerary", alt: "A wide sandy beach in Arrábida with calm blue water and green hills", focus: "50% 70%" },
  { src: "/photos/paestum-temple.webp", place: "Paestum, Italy", type: "For history buffs", alt: "A Greek temple at Paestum under a summer sky", focus: "72% 55%" },
];

function Benefit({ title, body, example }: { title: string; body: string; example: React.ReactNode }) {
  return (
    <div className="grid content-start gap-4">
      {/* Fixed height keeps every heading on the same line across the row. */}
      <div className="flex h-32 items-center rounded-xl border bg-background p-3 [&>*]:w-full">{example}</div>
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="text-muted-foreground">{body}</p>
    </div>
  );
}

/** The hero shows the product: a day's route on a map beside its plan. */
function HeroProduct() {
  return (
    <figure className="relative rounded-2xl bg-brand p-4 shadow-[0_30px_60px_-30px_rgb(29_43_38/0.6)] sm:p-5" aria-label="Example: a day in Lisbon">
      <div className="grid gap-3 sm:grid-cols-[1.45fr_1fr]">
        <LisbonDayMap className="aspect-[3/2] w-full self-center rounded-xl" />
        <div className="grid content-start gap-2 rounded-xl bg-card p-3">
          <p className="flex items-baseline justify-between text-sm">
            <span className="font-semibold">Mon, Nov 2</span>
            <span className="text-xs text-muted-foreground">31 mi</span>
          </p>
          {[
            ["◆", "Memmo Alfama", "Start the day here", "stay"],
            ["1", "Tram 28 and the Alfama", "Morning", "activity"],
            ["2", "Pena Palace, Sintra", "Afternoon, $45", "activity"],
            ["3", "Fado in Mouraria", "Evening, $95", "activity"],
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
            <span className="text-lg font-bold">$1,982</span>
          </p>
          <p className="-mt-1 flex items-baseline justify-between text-xs">
            <span className="whitespace-nowrap text-muted-foreground">$496 each for 4</span>
            <span className="whitespace-nowrap rounded-full bg-open-soft px-2 py-0.5 font-medium text-primary">Fits the budget</span>
          </p>
        </div>
      </div>
    </figure>
  );
}
