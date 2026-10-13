import Image from "next/image";
import Link from "next/link";

import { LegalLinks } from "@/components/layout/legal-links";

import { LisbonDayMap } from "@/components/brand/lisbon-day-map";
import { WrldMark } from "@/components/brand/wrld-mark";
import { TravelTypeBadge } from "@/features/traveler-profile/travel-type-icon";
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
              <Link href="/signup">Start free</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero: one promise, one action, the product itself */}
        <section className="mx-auto grid max-w-6xl gap-12 px-6 pt-10 pb-20 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:pt-16">
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">For points travelers and their friends</p>
            <h1 className="mt-3 text-[2.75rem] leading-[1.04] font-bold tracking-[-0.035em] sm:text-[3.5rem]">
              <span className="block">Plan the trip.</span>
              <span className="block text-primary">Pay with the points you have.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted-foreground">
              WRLD plans each day around your real flights, shows whether points or cash is cheaper for every flight, and keeps
              the whole group on one budget.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button asChild size="lg" className="h-12 bg-travel px-7 text-base text-travel-foreground hover:bg-travel/90">
                <Link href="/signup">Start free</Link>
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

        {/* The guided path: the same four steps a new account walks through */}
        <section id="how" aria-labelledby="how-title" className="border-t bg-card">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 id="how-title" className="max-w-2xl text-3xl font-bold sm:text-4xl">
              Four steps from &ldquo;where should we go?&rdquo; to booked.
            </h2>
            <p className="mt-3 max-w-xl text-muted-foreground">WRLD walks you through them, in order, the first time you sign in.</p>
            <ol className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              <Benefit
                n={1}
                title="Find your travel type"
                body="Ten quick questions. Every suggestion after that fits how you like to travel."
                example={
                  <div className="flex items-center gap-3 text-xs">
                    <TravelTypeBadge type="flaneur" size={48} />
                    <span>
                      <span className="block text-muted-foreground">You are</span>
                      <span className="block text-base font-semibold">The Flâneur</span>
                    </span>
                  </div>
                }
              />
              <Benefit
                n={2}
                title="Add your points"
                body="Card and airline balances, typed in once. No logins. WRLD tells you which ones can pay for each flight."
                example={
                  <div className="grid gap-1 text-xs">
                    {[
                      ["Chase Ultimate Rewards", "84,000"],
                      ["Amex Membership Rewards", "52,500"],
                      ["Delta SkyMiles", "31,200"],
                    ].map(([n, b]) => (
                      <p key={n} className="flex justify-between gap-2 rounded bg-card px-2 py-1 shadow-sm">
                        <span className="truncate">{n}</span>
                        <span className="font-semibold tabular-nums">{b}</span>
                      </p>
                    ))}
                  </div>
                }
              />
              <Benefit
                n={3}
                title="Start a trip with friends"
                body="Cities and dates. Invite the group to vote, chat and split costs. Days start when you land."
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
                n={4}
                title="Points or cash"
                body="The cheapest way to pay for each flight, and every price says how WRLD knows it."
                example={
                  <div className="rounded-md bg-card px-3 py-2 text-xs shadow-sm">
                    <p className="flex justify-between font-semibold">
                      <span>DTW → LIS</span>
                      <span>61,200 pts</span>
                    </p>
                    <p className="text-muted-foreground">Chase Travel, any seat · or $612 cash</p>
                    <p className="mt-1.5 w-fit rounded-full bg-travel/20 px-1.5 py-0.5 font-medium">Any seat, today&rsquo;s fare</p>
                  </div>
                }
              />
            </ol>
            <p className="mt-8 text-xs text-muted-foreground">Examples. Prices and balances change.</p>
          </div>
        </section>

        {/* What only WRLD does: the gaps the award tools and trip planners leave */}
        <section aria-labelledby="more-title" className="border-t">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 id="more-title" className="max-w-2xl text-3xl font-bold sm:text-4xl">
              Award tools stop at the flight. Trip planners skip the points. WRLD does both.
            </h2>
            <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              <Benefit
                title="One budget, cash and points"
                body="Flights, stays and tickets add up for the whole group, in dollars and points, with what's left per person each day."
                example={
                  <div className="rounded-md bg-sidebar px-3 py-2 text-sidebar-foreground">
                    <p className="text-[11px]">This trip costs</p>
                    <p className="text-2xl font-bold text-brand-cream">$1,982</p>
                    <p className="text-[11px] text-travel">+ 60,000 points</p>
                  </div>
                }
              />
              <Benefit
                title="Prices you can trust"
                body="Seen on the airline's site, any seat at today's fare, or predicted: each price is labelled, so you never move points on a guess."
                example={
                  <div className="flex flex-wrap gap-1.5 text-[11px] font-medium">
                    <span className="rounded-full bg-open-soft px-2 py-0.5 text-primary">Seen on the airline&rsquo;s site</span>
                    <span className="rounded-full bg-travel/20 px-2 py-0.5">Any seat, today&rsquo;s fare</span>
                    <span className="rounded-full border border-dashed border-travel-ink/40 px-2 py-0.5 text-travel-ink">Predicted</span>
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
                body="Paste a confirmation email or drop in a ticket PDF or calendar file. Flights, stays and tickets land on the right day."
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
              <p className="max-w-md text-2xl font-semibold text-brand-cream">Your next trip, paid for with the points you already have.</p>
            </div>
            <Button asChild size="lg" className="h-12 bg-travel px-7 text-base text-travel-foreground hover:bg-travel/90">
              <Link href="/signup">Start free</Link>
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

function Benefit({ n, title, body, example }: { n?: number; title: string; body: string; example: React.ReactNode }) {
  const Tag = n ? "li" : "div";
  return (
    <Tag className="grid content-start gap-4">
      {/* Fixed height keeps every heading on the same line across the row. */}
      <div className="flex h-32 items-center rounded-xl border bg-background p-3 [&>*]:w-full">{example}</div>
      <h3 className="flex items-baseline gap-2 text-xl font-semibold">
        {n ? (
          <span className="grid size-7 shrink-0 place-items-center self-center rounded-full bg-primary text-sm text-primary-foreground" aria-hidden="true">
            {n}
          </span>
        ) : null}
        {title}
      </h3>
      <p className="text-muted-foreground">{body}</p>
    </Tag>
  );
}

/** The hero shows the product: a day's route on a map beside its plan. */
function HeroProduct() {
  return (
    <figure className="relative rounded-2xl bg-brand p-4 shadow-[0_30px_60px_-30px_rgb(29_43_38/0.6)] sm:p-5" aria-label="Example: a day in Lisbon">
      <figcaption className="absolute -top-3 left-5 rounded-full bg-card px-2.5 py-0.5 text-xs font-medium text-muted-foreground shadow-sm">Example trip</figcaption>
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
