import Image from "next/image";
import Link from "next/link";

import { GroupChatHero } from "@/components/marketing/group-chat-hero";
import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { Button } from "@/components/ui/button";
import { TEMPLATES } from "@/features/trips/templates";

const startFrom = (id: string) => `/signup?next=${encodeURIComponent(`/trips/new?template=${id}`)}`;
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** How WRLD stretches a group's money, in the order a trip actually happens. */
const STEPS = [
  {
    title: "Everyone sets a private max",
    body: "Each person enters what they can spend. The group only sees the lowest number, so nobody has to say \u201cI can\u2019t afford that\u201d in the chat.",
  },
  {
    title: "See every trip that fits it",
    body: "Flights or a road trip, the place to stay and your days there, priced for the whole group. Over budget? You see the closest options and cheaper places just like the one you wanted.",
    link: { href: "/plan", label: "Try it with your budget" },
  },
  {
    title: "Plan it together, split it fairly",
    body: "Vote on ideas picked for how each of you likes to travel, then split every cost by who was there. Points count too, if anyone has them.",
  },
];

export default function Home() {
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />

      <main>
        {/* Hero: the group chat every trip starts in, and the plan that fits everyone's wallet */}
        <section className="mx-auto grid max-w-6xl gap-12 px-5 pt-8 pb-16 sm:px-6 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-16 lg:pt-16 lg:pb-24">
          <div>
            <h1 className="font-display text-[2.75rem] leading-[1.02] font-bold tracking-[-0.035em] text-balance sm:text-6xl">
              The dream trip, on a budget the whole group can do.
            </h1>
            <p className="mt-5 max-w-[34rem] text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Everyone sets a private max. WRLD finds the best trip that fits the whole group, flights or a road trip, stays and days
              included, and splits it fairly when you&rsquo;re back.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg" className="h-12 rounded-full px-7 text-base">
                <Link href="/plan">See where our budget goes</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="h-12 rounded-full px-5 text-base text-primary">
                <Link href="/signup">Start a trip</Link>
              </Button>
            </div>

          </div>
          <GroupChatHero />
        </section>

        {/* The loop, in the order a trip happens: this one is a real sequence, so it's numbered */}
        <section aria-labelledby="how" className="bg-primary text-primary-foreground">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:py-24">
            <h2 id="how" className="max-w-[36rem] font-display text-3xl leading-tight font-bold tracking-[-0.02em] text-balance sm:text-[2.5rem]">
              Prices keep going up. Your trip doesn&rsquo;t have to shrink.
            </h2>
            <p className="mt-4 max-w-[36rem] text-lg opacity-85">
              Most travel apps help one person find one cheap flight. WRLD makes the whole trip fit the whole group.
            </p>
            <ol className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="grid grid-cols-[2.5rem_1fr] gap-x-3">
                  <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-travel font-display text-base font-bold text-travel-foreground">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold">{s.title}</h3>
                    <p className="mt-1 text-base leading-relaxed opacity-80">{s.body}</p>
                    {s.link && (
                      <Link href={s.link.href} className="mt-2 inline-flex min-h-11 items-center font-medium text-travel underline underline-offset-4">
                        {s.link.label}
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Two extras that save real money, kept short: the core story is the budget */}
        <section aria-labelledby="extras" className="border-t">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:py-20">
            <h2 id="extras" className="font-display text-3xl font-bold tracking-[-0.02em] sm:text-[2.5rem]">
              Two more ways the budget stretches
            </h2>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              <div className="rounded-3xl border bg-card p-6 sm:p-8">
                <h3 className="text-xl font-semibold">Official tickets, not resellers</h3>
                <p className="mt-2 text-muted-foreground">
                  Lookalike sites buy the top ad for famous attractions and charge two to seven times the price. Reporters found a €22 Louvre
                  ticket selling for €76 in June 2026. Every ticket in WRLD links to the real site, checked by hand.
                </p>
                <Link href="/tickets" className="mt-3 inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4">
                  Check a ticket link
                </Link>
              </div>
              <div className="rounded-3xl border bg-card p-6 sm:p-8">
                <h3 className="text-xl font-semibold">Points, if someone has them</h3>
                <p className="mt-2 text-muted-foreground">
                  One friend with a pile of credit card points can cover the flights. Agree what a point is worth before anyone books, and WRLD
                  pays them back in the split like any other cost. No points? Nothing changes.
                </p>
                <Link href="/points-check" className="mt-3 inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4">
                  See what points could cover
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Start from the kind of trip they're actually planning */}
        <section aria-labelledby="templates" className="border-t">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:py-24">
            <h2 id="templates" className="font-display text-3xl font-bold tracking-[-0.02em] sm:text-[2.5rem]">
              Start from the trip you&rsquo;re planning
            </h2>
            <p className="mt-3 max-w-[38rem] text-lg text-muted-foreground">
              Each one comes with a group size, a checklist and a starting budget set from what Americans actually spend on that kind of trip,
              so the first number the group sees is realistic.
            </p>
            <ul className="mt-10 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {TEMPLATES.map((t, i) => (
                <li key={t.id} className={i === 0 ? "sm:col-span-2 lg:col-span-1 lg:row-span-2" : undefined}>
                  <Link href={startFrom(t.id)} className="group block rounded-3xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                    <div className={`relative overflow-hidden rounded-3xl bg-muted ${i === 0 ? "aspect-[4/3] lg:aspect-[3/4]" : "aspect-[4/3]"}`}>
                      <Image
                        src={t.photo.src}
                        alt={t.photo.alt}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
                        style={{ objectPosition: t.photo.focus }}
                      />
                      <span className="absolute top-3 left-3 rounded-full bg-black/45 px-3 py-1 text-[13px] font-medium text-white backdrop-blur-sm">
                        {t.photo.place}
                      </span>
                      <span className="absolute right-3 bottom-2 text-[11px] text-white/90 [text-shadow:0_1px_2px_rgb(0_0_0/0.6)]">
                        Photo: {t.photo.credit}, Unsplash
                      </span>
                    </div>
                    <div className="mt-3 flex items-baseline justify-between gap-3">
                      <h3 className="text-lg font-semibold group-hover:underline group-hover:underline-offset-4">{t.name}</h3>
                      <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                        {t.party} people, {usd(t.perPerson)} each
                      </span>
                    </div>
                    <p className="mt-1 text-[15px] text-muted-foreground">{t.blurb}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* No account needed: the budget planner is the front door */}
        <section aria-labelledby="try" className="px-5 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 rounded-[2rem] bg-travel px-6 py-10 text-travel-foreground sm:px-10 md:flex-row md:items-center md:justify-between">
            <div className="max-w-[36rem]">
              <h2 id="try" className="font-display text-2xl font-bold tracking-[-0.02em] sm:text-3xl">
                Have $1,500 and a long weekend?
              </h2>
              <p className="mt-2 text-base sm:text-lg">
                That&rsquo;s about what Americans spend on a trip. Enter your budget, where you fly from and who&rsquo;s coming, and see every
                trip that fits, flights, hotel and days there included. No account needed.
              </p>
            </div>
            <Button asChild size="lg" className="h-12 shrink-0 rounded-full bg-travel-foreground px-7 text-base text-travel hover:bg-travel-foreground/90">
              <Link href="/plan">See where it goes</Link>
            </Button>
          </div>
        </section>

        {/* Price, said plainly, and one last way in */}
        <section aria-labelledby="close" className="mx-auto max-w-6xl px-5 py-20 text-center sm:px-6 lg:py-28">
          <h2 id="close" className="mx-auto max-w-[40rem] font-display text-3xl font-bold tracking-[-0.02em] text-balance sm:text-5xl">
            Go somewhere great. Come back with money left.
          </h2>
          <p className="mx-auto mt-5 max-w-[34rem] text-lg text-muted-foreground">
            Free for the whole group while we&rsquo;re in beta. Guests never pay.
          </p>
          <Button asChild size="lg" className="mt-8 h-12 rounded-full px-8 text-base">
            <Link href="/signup">Start a trip</Link>
          </Button>
        </section>
      </main>

      <div className="border-t pb-[env(safe-area-inset-bottom)]">
        <SiteFooter />
      </div>
    </div>
  );
}
