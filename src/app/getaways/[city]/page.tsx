import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/layout/page-skeleton";
import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { Shelf } from "@/components/shelf";
import { DriveCard } from "@/features/planner/drive-results";
import type { DriveOption } from "@/features/planner/drive";
import { GETAWAY_CITIES, getawayCity, getawaysFrom } from "@/features/planner/getaway-cities";
import { driveMeta } from "@/features/planner/vibes";

export function generateStaticParams() {
  return GETAWAY_CITIES.map((c) => ({ city: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/getaways/[city]">): Promise<Metadata> {
  const c = getawayCity((await params).city);
  if (!c) return {};
  return {
    title: `Weekend getaways from ${c.name}, with what they cost`,
    description: `Lake towns, small towns, parks and cities within a weekend's drive of ${c.name}, ${c.state}, each priced for two: gas, a place to stay, food and fun, plus free things to do.`,
    alternates: { canonical: `/getaways/${c.slug}` },
  };
}

const monthName = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/** Each place goes in the first group it fits, so nothing shows twice. */
const GROUPS: { title: string; fits: (o: DriveOption) => boolean }[] = [
  { title: "Lake and beach towns", fits: (o) => driveMeta(o.getaway.key).vibes.includes("water") },
  { title: "Small towns and hidden gems", fits: (o) => Boolean(o.getaway.gem) || driveMeta(o.getaway.key).vibes.includes("quiet") },
  { title: "Hiking and parks", fits: (o) => driveMeta(o.getaway.key).vibes.includes("outdoors") },
  { title: "Cities", fits: (o) => driveMeta(o.getaway.key).vibes.includes("city") },
  { title: "More places", fits: () => true },
];

export default function GetawaysPage({ params }: PageProps<"/getaways/[city]">) {
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-5 pt-8 pb-20 sm:px-6 lg:pt-14">
        <Suspense fallback={<PageSkeleton />}>
          <Getaways params={params} />
        </Suspense>
      </main>
      <div className="border-t pb-[env(safe-area-inset-bottom)]">
        <SiteFooter />
      </div>
    </div>
  );
}

async function Getaways({ params }: { params: PageProps<"/getaways/[city]">["params"] }) {
  const city = getawayCity((await params).city);
  if (!city) notFound();
  const data = await getawaysFrom(city.slug);
  if (!data) notFound();
  const { month, checkIn, options } = data;
  const placed = new Set<string>();
  const groups = GROUPS.map((g) => {
    const items = options.filter((o) => !placed.has(o.getaway.key) && g.fits(o));
    items.forEach((o) => placed.add(o.getaway.key));
    return { ...g, items };
  }).filter((g) => g.items.length);
  const plan = `/plan?${new URLSearchParams({ from: city.airport, go: "drive", month, nights: "2", travelers: "2" })}`;

  return (
    <>
      <h1 className="max-w-[40rem] font-display text-4xl leading-[1.05] font-bold tracking-[-0.03em] text-balance sm:text-5xl">
        Weekend getaways from {city.name}
      </h1>
      <p className="mt-4 max-w-[38rem] text-lg text-muted-foreground">
        {options.length} places within a weekend&rsquo;s drive of {city.name}, each priced for two for a weekend in {monthName(month)}: gas, a place to
        stay, food and fun. These are estimates to compare places; check live stays before you book.
      </p>
      <div className="mt-6 mb-10 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          href={plan}
          className="tap inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-transform active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Price it for your group and budget
        </Link>
        <Link href="/how-wrld-works#prices" className="text-sm font-medium text-primary hover:underline">
          How WRLD estimates
        </Link>
      </div>
      <div className="grid gap-10">
        {groups.map((g) => (
          <Shelf key={g.title} title={g.title}>
            {g.items.map((o) => (
              <DriveCard key={o.getaway.key} t={o} cash={Infinity} travelers={2} month={month} checkIn={checkIn} signedIn={false} />
            ))}
          </Shelf>
        ))}
      </div>
      <nav aria-label="Getaways from other cities" className="mt-14 border-t pt-6">
        <h2 className="text-lg font-semibold">Getaways from other cities</h2>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {GETAWAY_CITIES.filter((c) => c.slug !== city.slug).map((c) => (
            <li key={c.slug}>
              <Link href={`/getaways/${c.slug}`} className="text-primary hover:underline">
                {c.name}, {c.state}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
