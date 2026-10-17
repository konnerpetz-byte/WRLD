import { ExternalLink, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { Button } from "@/components/ui/button";
import { allTicketPlaces, durationLabel, hostOf, slotLabel, ticketPlace } from "@/features/tickets/data";
import { LinkCheckForm } from "@/features/tickets/link-check-form";
import { formatMoney } from "@/lib/format";

export async function generateStaticParams() {
  const places = await allTicketPlaces();
  // Cache Components needs at least one; if the list can't load at build time, pages render on request.
  return places.length ? places.map((p) => ({ slug: p.slug })) : [{ slug: "louvre" }];
}

export async function generateMetadata({ params }: PageProps<"/tickets/[slug]">): Promise<Metadata> {
  const p = await ticketPlace((await params).slug);
  if (!p) return {};
  return {
    title: `Official ${p.name} tickets: the real site`,
    description: `The official ticket site for ${p.name} in ${p.city}, checked by hand, plus when to go and how to avoid lookalike sites that charge more.`,
    alternates: { canonical: `/tickets/${p.slug}` },
  };
}

const country = (code: string) => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
};

const local = (n: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);

const longDate = (iso: string | null) =>
  iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : null;

export default async function TicketPage({ params }: PageProps<"/tickets/[slug]">) {
  const p = await ticketPlace((await params).slug);
  if (!p) notFound();
  const buyAt = p.tickets_url ?? p.official_url;
  const buyHost = hostOf(buyAt);
  const officialHost = hostOf(p.official_url);
  const nearby = (await allTicketPlaces()).filter((x) => x.city === p.city && x.slug !== p.slug);
  const facts = [
    p.timed_entry ? { k: "Entry", v: "Timed tickets. Book ahead; popular slots sell out." } : { k: "Entry", v: "No time slot needed." },
    p.best_slot ? { k: "Best time to go", v: slotLabel[p.best_slot] ?? p.best_slot } : null,
    durationLabel(p.duration_minutes) ? { k: "Plan for", v: durationLabel(p.duration_minutes)! } : null,
    {
      k: "Price",
      v:
        p.adult_price != null
          ? `${local(Number(p.adult_price), p.currency ?? "USD")}${p.currency && p.currency !== "USD" ? ` (about ${formatMoney(Number(p.adult_price), p.currency)})` : ""} for an adult on the official site. ${p.price_note ?? ""}`.trim()
          : (p.price_note ?? "See the official site."),
    },
  ].filter((f): f is { k: string; v: string } => Boolean(f));

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 pt-8 pb-20 sm:px-6 lg:pt-14">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link href="/tickets" className="underline-offset-4 hover:underline">
            Official ticket sites
          </Link>
          <span aria-hidden="true"> / </span>
          {p.city}
        </nav>
        <h1 className="mt-3 font-display text-4xl leading-[1.05] font-bold tracking-[-0.03em] text-balance sm:text-5xl">
          Official {p.name} tickets
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          {p.city}{p.country_code ? `, ${country(p.country_code)}` : ""}
        </p>

        {buyAt && (
          <section aria-labelledby="real-h" className="mt-8 rounded-3xl bg-primary p-6 text-primary-foreground sm:p-8">
            <h2 id="real-h" className="flex items-center gap-2 text-lg font-semibold">
              <ShieldCheck className="size-5 text-travel" aria-hidden="true" />
              The real site
            </h2>
            <p className="mt-2 font-display text-2xl font-bold break-all sm:text-3xl">{buyHost}</p>
            {officialHost && buyHost && !buyHost.endsWith(officialHost) && (
              <p className="mt-1 opacity-80">
                Tickets are sold on the official partner site linked from <span className="font-medium">{officialHost}</span>.
              </p>
            )}
            <Button asChild size="lg" className="mt-5 h-12 rounded-full bg-travel px-7 text-base text-travel-foreground hover:bg-travel/90">
              <a href={buyAt} target="_blank" rel="noopener noreferrer">
                Go to the official site <ExternalLink aria-hidden="true" />
              </a>
            </Button>
            {p.verified_on && <p className="mt-4 text-sm opacity-70">Checked by hand on {longDate(p.verified_on)}.</p>}
          </section>
        )}

        <dl className="mt-10 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {facts.map((f) => (
            <div key={f.k}>
              <dt className="text-sm font-medium text-muted-foreground">{f.k}</dt>
              <dd className="mt-1 text-[17px]">{f.v}</dd>
            </div>
          ))}
        </dl>
        {p.visit_note && <p className="mt-6 text-[17px] leading-relaxed">{p.visit_note}</p>}
        {p.hours_note && <p className="mt-2 text-muted-foreground">{p.hours_note}</p>}

        <section aria-labelledby="fake-h" className="mt-12">
          <h2 id="fake-h" className="font-display text-2xl font-bold tracking-[-0.02em]">
            How to spot a lookalike
          </h2>
          <ul className="mt-4 grid list-disc gap-2 pl-5 text-[17px] leading-relaxed">
            <li>
              The address isn&rsquo;t <strong>{buyHost}</strong>. Lookalikes add words like &ldquo;tickets&rdquo; or
              &ldquo;official&rdquo; to the name.
            </li>
            <li>It&rsquo;s the top result marked &ldquo;Sponsored&rdquo;. Scroll past the ads.</li>
            <li>The price is far above the official one, or there&rsquo;s a &ldquo;service fee&rdquo; at checkout.</li>
            <li>Some resellers are legitimate (tours, skip-the-line packages). Compare with the official price before you pay.</li>
          </ul>
          <div className="mt-6 rounded-3xl border bg-card p-5 sm:p-6">
            <p className="mb-3 font-medium">Have a link already? Check it.</p>
            <LinkCheckForm />
          </div>
        </section>

        <section aria-labelledby="trip-h" className="mt-12 rounded-3xl bg-travel p-6 text-travel-foreground sm:p-8">
          <h2 id="trip-h" className="font-display text-2xl font-bold">
            Going to {p.city} with friends?
          </h2>
          <p className="mt-2 max-w-[34rem]">
            WRLD plans the days around everyone&rsquo;s budget, links every ticket to the official site, and splits the costs, points
            included.
          </p>
          <Button asChild size="lg" className="mt-5 h-12 rounded-full bg-travel-foreground px-7 text-base text-travel hover:bg-travel-foreground/90">
            <Link href="/plan">See what our budget covers</Link>
          </Button>
        </section>

        {nearby.length > 0 && (
          <section aria-labelledby="more-h" className="mt-12">
            <h2 id="more-h" className="text-lg font-semibold">
              More official sites in {p.city}
            </h2>
            <ul className="mt-2 grid">
              {nearby.map((x) => (
                <li key={x.slug}>
                  <Link href={`/tickets/${x.slug}`} className="flex min-h-11 items-center text-[17px] underline-offset-4 hover:underline">
                    {x.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <div className="border-t pb-[env(safe-area-inset-bottom)]">
        <SiteFooter />
      </div>
    </div>
  );
}
