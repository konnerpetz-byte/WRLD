import { CalendarClock, MessagesSquare, ScanText, Wallet } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { GroupChatHero } from "@/components/marketing/group-chat-hero";
import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { Button } from "@/components/ui/button";
import { TEMPLATES } from "@/features/trips/templates";

const startFrom = (id: string) => `/signup?next=${encodeURIComponent(`/trips/new?template=${id}`)}`;
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** One example booking, valued three ways: the decision a group has to make before anyone books. */
const SPLIT_EXAMPLE = { miles: 120_000, people: 4 };
const VALUES = [
  { cents: 1, why: "What the points get on a bank travel site. The safe, no-argument number." },
  { cents: 1.3, why: "Close to what airline miles are usually worth. A fair middle." },
  { cents: 1.5, why: "Good value for points moved to an airline. Fair when the booker found a great deal." },
];

const FEATURES = [
  {
    icon: CalendarClock,
    title: "Days planned around real flights",
    body: "Land at 2:40 pm and the first day starts at 2:40 pm. Check-in and check-out times sit on the right days.",
  },
  {
    icon: ScanText,
    title: "Drop in the confirmation",
    body: "Upload the email, PDF or a screenshot from the airline or hotel app. Flights, stays and prices fill in for you.",
  },
  {
    icon: Wallet,
    title: "One budget for cash and points",
    body: "Everything in your currency, euros converted for you. Split any cost by who was there.",
  },
  {
    icon: MessagesSquare,
    title: "The group decides in one place",
    body: "Invite with a link, vote on dates and plans, and chat right next to the plan. Guests don't need to pay anything.",
  },
];

export default function Home() {
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />

      <main>
        {/* Hero: the moment every group trip starts, and what WRLD turns it into */}
        <section className="mx-auto grid max-w-6xl gap-12 px-5 pt-8 pb-16 sm:px-6 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-16 lg:pt-16 lg:pb-24">
          <div>
            <h1 className="font-display text-[2.75rem] leading-[1.02] font-bold tracking-[-0.035em] text-balance sm:text-6xl">
              From group chat to booked.
            </h1>
            <p className="mt-5 max-w-[34rem] text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Plan the days together, see what everyone&rsquo;s points can cover, and split it all fairly, even when someone pays in miles.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg" className="h-12 rounded-full px-7 text-base">
                <Link href="/signup">Start a trip</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="h-12 rounded-full px-5 text-base text-primary">
                <Link href="/points-check">See what your points cover</Link>
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

        {/* The part nobody else handles: paying a friend back for points */}
        <section aria-labelledby="fair-split" className="bg-primary text-primary-foreground">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-16 lg:py-24">
            <div>
              <h2 id="fair-split" className="font-display text-3xl leading-tight font-bold tracking-[-0.02em] text-balance sm:text-[2.5rem]">
                Your miles paid for the flights. Now get paid back.
              </h2>
              <p className="mt-5 max-w-[34rem] text-lg leading-relaxed opacity-85">
                When one friend books with points, nobody knows what to owe them. In WRLD the group agrees what a point is worth before anyone
                books, and the points show up in who-owes-whom like any other cost.
              </p>
              <p className="mt-4 max-w-[34rem] text-base opacity-70">
                Points never count as cash spent, so your budget stays honest.
              </p>
            </div>

            <div className="rounded-3xl bg-primary-foreground/[0.07] p-5 ring-1 ring-primary-foreground/15 sm:p-7">
              <p className="text-[15px] opacity-85">
                {SPLIT_EXAMPLE.miles.toLocaleString("en-US")} miles for {SPLIT_EXAMPLE.people} round-trip flights. Each friend owes:
              </p>
              <ul className="mt-4 grid gap-3">
                {VALUES.map((v) => {
                  const total = (SPLIT_EXAMPLE.miles * v.cents) / 100;
                  const each = total / SPLIT_EXAMPLE.people;
                  return (
                    <li key={v.cents} className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 border-t border-primary-foreground/15 pt-3 sm:grid-cols-[4rem_1fr_auto]">
                      <span className="font-display text-lg font-semibold">{v.cents}¢</span>
                      <span className="col-span-2 row-start-2 text-sm opacity-75 sm:col-span-1 sm:col-start-2 sm:row-start-1">{v.why}</span>
                      <span className="col-start-2 row-start-1 font-display text-2xl font-bold tabular-nums text-travel sm:col-start-3">{usd(each)}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-4 text-sm opacity-70">Pick one together, or set your own. Each booking can have its own value too.</p>
            </div>
          </div>
        </section>

        {/* Start from the kind of trip they're actually planning */}
        <section aria-labelledby="templates" className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:py-24">
          <h2 id="templates" className="font-display text-3xl font-bold tracking-[-0.02em] sm:text-[2.5rem]">
            Start from the trip you&rsquo;re planning
          </h2>
          <p className="mt-3 max-w-[38rem] text-lg text-muted-foreground">
            Each one comes with a group size, a starting budget per person and a checklist, so the first message to the group is a plan.
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
        </section>

        {/* Everything else, briefly */}
        <section aria-labelledby="features" className="border-t">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:py-24">
            <h2 id="features" className="max-w-[30rem] font-display text-3xl font-bold tracking-[-0.02em] text-balance sm:text-[2.5rem]">
              Less herding. More going.
            </h2>
            <ul className="mt-10 grid gap-x-12 gap-y-10 sm:grid-cols-2">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-secondary text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <p className="mt-1 max-w-[30rem] text-base leading-relaxed text-muted-foreground">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* No account needed: the hook for points people */}
        <section aria-labelledby="check" className="px-5 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 rounded-[2rem] bg-travel px-6 py-10 text-travel-foreground sm:px-10 md:flex-row md:items-center md:justify-between">
            <div className="max-w-[36rem]">
              <h2 id="check" className="font-display text-2xl font-bold tracking-[-0.02em] sm:text-3xl">
                Sitting on Chase, Amex or Capital One points?
              </h2>
              <p className="mt-2 text-base sm:text-lg">
                Enter your balances and your home airport. See which trips they could cover for your whole group. No account needed.
              </p>
            </div>
            <Button asChild size="lg" className="h-12 shrink-0 rounded-full bg-travel-foreground px-7 text-base text-travel hover:bg-travel-foreground/90">
              <Link href="/points-check">Check my points</Link>
            </Button>
          </div>
        </section>

        {/* Price, said plainly, and one last way in */}
        <section aria-labelledby="close" className="mx-auto max-w-6xl px-5 py-20 text-center sm:px-6 lg:py-28">
          <h2 id="close" className="mx-auto max-w-[40rem] font-display text-3xl font-bold tracking-[-0.02em] text-balance sm:text-5xl">
            Get everyone on the same page before the deposit is due.
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
