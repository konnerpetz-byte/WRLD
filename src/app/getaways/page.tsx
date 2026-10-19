import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { GETAWAY_CITIES } from "@/features/planner/getaway-cities";

export const metadata: Metadata = {
  title: "Weekend getaways you can drive to, with what they cost",
  description: "Pick your city to see lake towns, small towns, parks and cities within a weekend's drive, each priced for two.",
  alternates: { canonical: "/getaways" },
};

export default function GetawaysIndex() {
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-5 pt-8 pb-20 sm:px-6 lg:pt-14">
        <h1 className="max-w-[40rem] font-display text-4xl leading-[1.05] font-bold tracking-[-0.03em] text-balance sm:text-5xl">
          Weekend getaways you can drive to
        </h1>
        <p className="mt-4 mb-10 max-w-[38rem] text-lg text-muted-foreground">
          Pick where you&rsquo;re starting. Every place is priced for two: gas, a place to stay, food and fun.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GETAWAY_CITIES.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/getaways/${c.slug}`}
                className="tap flex h-14 items-center justify-between rounded-xl border bg-card px-4 font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              >
                From {c.name}, {c.state}
                <span aria-hidden="true" className="text-muted-foreground">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <div className="border-t pb-[env(safe-area-inset-bottom)]">
        <SiteFooter />
      </div>
    </div>
  );
}
