import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { allTicketPlaces } from "@/features/tickets/data";
import { LinkCheckForm } from "@/features/tickets/link-check-form";

export const metadata: Metadata = {
  title: "Official ticket sites for famous attractions",
  description:
    "The real ticket sites for the Louvre, Colosseum, Sagrada Família, Alhambra and 100+ more, checked by hand. Lookalike sites charge up to 7 times the official price.",
  alternates: { canonical: "/tickets" },
};

export default async function TicketsPage() {
  const places = await allTicketPlaces();
  const byCity = new Map<string, typeof places>();
  for (const p of places) byCity.set(p.city, [...(byCity.get(p.city) ?? []), p]);
  const cities = [...byCity.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 pt-8 pb-20 sm:px-6 lg:pt-14">
        <div className="max-w-[44rem]">
          <h1 className="font-display text-4xl leading-[1.05] font-bold tracking-[-0.03em] text-balance sm:text-5xl">
            Buy from the real site. Pay the real price.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Lookalike ticket sites buy the top search ads for famous attractions and charge two to seven times the official price. In
            June 2026 reporters found a €22 Louvre ticket selling for €76. Here are the official sites, checked by hand.
          </p>
        </div>

        <section aria-labelledby="check-h" className="mt-10 max-w-[44rem] rounded-3xl bg-primary p-5 text-primary-foreground sm:p-7">
          <h2 id="check-h" className="text-xl font-semibold">
            Not sure about a link?
          </h2>
          <p className="mt-1 mb-4 opacity-80">Paste it and we&rsquo;ll tell you if it&rsquo;s the official site.</p>
          <LinkCheckForm />
        </section>

        <section aria-labelledby="list-h" className="mt-14">
          <h2 id="list-h" className="font-display text-2xl font-bold tracking-[-0.02em]">
            {places.length} attractions in {cities.length} cities
          </h2>
          <div className="mt-6 columns-1 gap-10 sm:columns-2 lg:columns-3">
            {cities.map(([city, list]) => (
              <div key={city} className="mb-8 break-inside-avoid">
                <h3 className="text-sm font-semibold text-muted-foreground">{city}</h3>
                <ul className="mt-2 grid">
                  {list.map((p) => (
                    <li key={p.slug}>
                      <Link
                        href={`/tickets/${p.slug}`}
                        className="flex min-h-11 items-center rounded-lg text-[17px] font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        {p.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <p className="mt-6 max-w-[44rem] text-sm text-muted-foreground">
          Sources: Indicator and Maldita.es investigation of lookalike ticket sites (June 24, 2026); Catalan police warnings about fake
          Sagrada Família sites (August 2026). Official addresses checked by hand; each page shows when.
        </p>
      </main>
      <div className="border-t pb-[env(safe-area-inset-bottom)]">
        <SiteFooter />
      </div>
    </div>
  );
}
