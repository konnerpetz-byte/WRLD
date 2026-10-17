import Image from "next/image";
import Link from "next/link";

import { GroupChatHero } from "@/components/marketing/group-chat-hero";
import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { Button } from "@/components/ui/button";
import { LinkCheckForm } from "@/features/tickets/link-check-form";
import { TEMPLATES } from "@/features/trips/templates";

const startFrom = (id: string) => `/signup?next=${encodeURIComponent(`/trips/new?template=${id}`)}`;
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** How WRLD stretches a group's money, in the order a trip actually happens. */
const STEPS = [
  {
    title: "Everyone sets a private max",
    body: "Each person enters what they can spend. The group only sees the lowest number, so nobody has to say “I can’t afford that” in the chat.",
  },
  {
    title: "See where that money goes furthest",
    body: "WRLD prices flights, hotel and days on the ground across the U.S., Mexico, the Caribbean, Europe and beyond, and shows what fits. On a typical budget most fits are closer to home; points and off-peak months bring Europe within reach.",
    link: { href: "/plan", label: "Try it with your budget" },
  },
  {
    title: "Plans picked for your travel types",
    body: "A two-minute quiz finds how each person likes to travel. Ideas are scored for the whole group, so nothing one person would hate makes the list.",
  },
  {
    title: "Pay the real price for tickets",
    body: "Every attraction links to its official site, checked by hand, not a reseller charging double.",
    link: { href: "/tickets", label: "See official ticket sites" },
  },
  {
    title: "Split it fairly, points included",
    body: "One budget in your currency. Costs split by who was there, and a friend who books with miles gets paid back at a value you all agree on.",
  },
];

/** One example booking, valued three ways: the decision a group has to make before anyone books. */
const SPLIT_EXAMPLE = { miles: 120_000, people: 4 };
const VALUES = [
  { cents: 1, why: "What the points get on a bank travel site. The safe, no-argument number." },
  { cents: 1.3, why: "Close to what airline miles are usually worth. A fair middle." },
  { cents: 1.5, why: "Good value for points moved to an airline. Fair when the booker found a great deal." },
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
              WRLD finds where your money goes furthest, plans days around how each of you likes to travel, sends you to official ticket sites
              instead of marked-up resellers, and splits it all fairly.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg" className="h-12 rounded-full px-7 text-base">
                <Link href="/plan">See where our budget goes</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="h-12 rounded-full px-5 text-base text-primary">
                <Link href="/signup">Start a trip</Link>
              </Button>
            </div>

            <nav aria-labelledby="trip-types" className="mt-10">
              <h2 id="trip-types" className="text-sm font-medium text-muted-foreground">
                Planning one of these?
              </h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {TEMPLATES.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={startFrom(t.id)}
                      className="inline-flex min-h-11 items-center rounded-full border bg-card px-4 text-[15px] font-medium transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {t.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
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
            <ol className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
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

        {/* Official tickets: the measurable money leak, and the free tool that fixes it */}
        <section aria-labelledby="tickets" className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16 lg:py-24">
          <div>
            <h2 id="tickets" className="font-display text-3xl leading-tight font-bold tracking-[-0.02em] text-balance sm:text-[2.5rem]">
              That &ldquo;Louvre tickets&rdquo; ad might cost you three times as much.
            </h2>
            <p className="mt-5 max-w-[34rem] text-lg leading-relaxed text-muted-foreground">
              Lookalike sites buy the top search ad for famous attractions and charge two to seven times the official price. Reporters found a
              €22 Louvre ticket selling for €76 in June 2026. WRLD links every ticket to the real site, checked by hand.
            </p>
            <Link href="/tickets" className="mt-4 inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4">
              See 100+ official ticket sites
            </Link>
          </div>
          <div className="rounded-3xl border bg-card p-5 sm:p-7">
            <p className="text-lg font-semibold">Got a ticket link? Check it.</p>
            <p className="mt-1 mb-4 text-muted-foreground">Free, no account.</p>
            <LinkCheckForm />
          </div>
        </section>

        {/* Points: the extra the one friend with a stash brings */}
        <section aria-labelledby="fair-split" className="border-t">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-16 lg:py-24">
            <div>
              <h2 id="fair-split" className="font-display text-3xl leading-tight font-bold tracking-[-0.02em] text-balance sm:text-[2.5rem]">
                One friend has a pile of points? Use them, and pay them back fairly.
              </h2>
              <p className="mt-5 max-w-[34rem] text-lg leading-relaxed text-muted-foreground">
                Credit card points can cover a group&rsquo;s flights. Agree what a point is worth before anyone books, and WRLD adds it to
                who-owes-whom like any other cost. Points never count as cash spent, so the budget stays honest.
              </p>
              <Link href="/points-check" className="mt-4 inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4">
                See what your points could cover
              </Link>
            </div>

            <div className="rounded-3xl bg-card p-5 ring-1 ring-border sm:p-7">
              <p className="text-[15px] text-muted-foreground">
                {SPLIT_EXAMPLE.miles.toLocaleString("en-US")} miles for {SPLIT_EXAMPLE.people} round-trip flights. Each friend owes:
              </p>
              <ul className="mt-4 grid gap-3">
                {VALUES.map((v) => {
                  const each = (SPLIT_EXAMPLE.miles * v.cents) / 100 / SPLIT_EXAMPLE.people;
                  return (
                    <li key={v.cents} className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 border-t pt-3 sm:grid-cols-[4rem_1fr_auto]">
                      <span className="font-display text-lg font-semibold">{v.cents}¢</span>
                      <span className="col-span-2 row-start-2 text-sm text-muted-foreground sm:col-span-1 sm:col-start-2 sm:row-start-1">{v.why}</span>
                      <span className="col-start-2 row-start-1 font-display text-2xl font-bold tabular-nums sm:col-start-3">{usd(each)}</span>
                    </li>
                  );
                })}
              </ul>
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
