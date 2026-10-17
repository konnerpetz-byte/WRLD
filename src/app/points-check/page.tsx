import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { REGIONS } from "@/features/awards/regions";
import { airportByCode } from "@/features/places/airports";
import { BANK_FIELDS, type CoverOption, pickHighlights, pointsValue, whatPointsCover } from "@/features/points-check/cover";

export const metadata: Metadata = {
  title: "What do my points cover?",
  description: "Enter your Chase, Amex, Capital One, Citi or Bilt points and home airport. See which round trips they could cover for your whole group.",
  alternates: { canonical: "/points-check" },
};

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const pts = (n: number) => n.toLocaleString("en-US");
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function PointsCheckPage({ searchParams }: PageProps<"/points-check">) {
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 pt-8 pb-20 sm:px-6 lg:pt-14">
        <h1 className="max-w-[40rem] font-display text-4xl leading-[1.05] font-bold tracking-[-0.03em] text-balance sm:text-5xl">
          What do your points cover?
        </h1>
        <p className="mt-4 max-w-[36rem] text-lg text-muted-foreground">
          Enter your credit card points and where you fly from. We&rsquo;ll show the round trips they could pay for, for everyone going.
        </p>
        <Suspense fallback={<CheckForm values={{}} />}>
          <Results searchParams={searchParams} />
        </Suspense>
      </main>
      <div className="border-t pb-[env(safe-area-inset-bottom)]">
        <SiteFooter />
      </div>
    </div>
  );
}

async function Results({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const home = one(sp.home).trim().toUpperCase().slice(0, 3);
  const travelers = Math.min(12, Math.max(1, Math.floor(Number(one(sp.n)) || 2)));
  const balances: Record<string, number> = {};
  for (const b of BANK_FIELDS) {
    const n = Math.floor(Number(one(sp[b.key]).replace(/[,\s]/g, "")));
    if (n > 0) balances[b.key] = Math.min(n, 50_000_000);
  }
  const asked = Boolean(home);
  const airport = asked ? airportByCode(home) : null;
  const hasPoints = Object.keys(balances).length > 0;
  const error = !asked ? null : !airport ? `We don't know the airport code "${home}". Try the 3-letter code, like JFK or ORD.` : !hasPoints ? "Add at least one points balance." : null;

  const values = { home, n: String(travelers), ...Object.fromEntries(Object.entries(balances).map(([k, v]) => [k, String(v)])) };

  return (
    <>
      <CheckForm values={values} error={error} />
      {asked && airport && hasPoints && <Answer home={home} city={airport.city} travelers={travelers} balances={balances} />}
    </>
  );
}

function CheckForm({ values, error }: { values: Record<string, string>; error?: string | null }) {
  return (
    <form method="get" action="/points-check" className="mt-10 grid gap-6 rounded-3xl border bg-card p-5 sm:p-7">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-[10rem_10rem]">
        <div className="grid gap-1.5">
          <Label htmlFor="home">Home airport</Label>
          <Input
            id="home"
            name="home"
            required
            maxLength={3}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="JFK"
            defaultValue={values.home}
            className="h-11 uppercase"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="n">People going</Label>
          <Input id="n" name="n" type="number" inputMode="numeric" min={1} max={12} defaultValue={values.n ?? "2"} className="h-11" />
        </div>
      </div>
      <fieldset>
        <legend className="text-sm font-medium">Your points (add the group&rsquo;s together)</legend>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {BANK_FIELDS.map((b) => (
            <div key={b.key} className="grid gap-1.5">
              <Label htmlFor={`b-${b.key}`} className="font-normal text-muted-foreground">
                <span className="sm:hidden">{b.short}</span>
                <span className="max-sm:hidden">{b.name}</span>
              </Label>
              <Input id={`b-${b.key}`} name={b.key} inputMode="numeric" placeholder="0" defaultValue={values[b.key]} className="h-11 tabular-nums" />
            </div>
          ))}
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="h-12 justify-self-start rounded-full px-7 text-base">
        Show what they cover
      </Button>
    </form>
  );
}

function Answer({ home, city, travelers, balances }: { home: string; city: string; travelers: number; balances: Record<string, number> }) {
  const { covered, almost } = pickHighlights(whatPointsCover(home, balances, travelers));
  const value = pointsValue(balances);
  const total = Object.values(balances).reduce((s, n) => s + n, 0);
  const regionLabel = (r: CoverOption["region"]) => REGIONS[r].label;

  return (
    <section aria-labelledby="answer" className="mt-12" aria-live="polite">
      <h2 id="answer" className="font-display text-3xl font-bold tracking-[-0.02em] text-balance">
        {covered.length
          ? `${pts(total)} points could fly ${travelers === 1 ? "you" : `all ${travelers} of you`} round trip from ${city} to ${covered[0].city}.`
          : `${pts(total)} points don't cover a round trip for ${travelers} from ${city} yet.`}
      </h2>
      <p className="mt-3 max-w-[40rem] text-lg text-muted-foreground">
        In cash terms that&rsquo;s about {usd(value.portal)} on your bank&rsquo;s travel site, or around {usd(value.partner)} moved to airline partners and used well.
      </p>

      {covered.length > 0 && (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {covered.map((o) => (
            <Option key={o.destination} o={o} region={regionLabel(o.region)} travelers={travelers} />
          ))}
        </ul>
      )}

      {almost.length > 0 && (
        <>
          <h3 className="mt-12 text-xl font-semibold">Close, with a few more points</h3>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {almost.map((o) => (
              <Option key={o.destination} o={o} region={regionLabel(o.region)} travelers={travelers} />
            ))}
          </ul>
        </>
      )}

      <div className="mt-12 grid gap-6 rounded-3xl bg-primary p-6 text-primary-foreground sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="font-display text-2xl font-bold">Turn it into a trip the group can see.</p>
          <p className="mt-2 max-w-[36rem] opacity-80">
            Plan the days, invite everyone, and if your points pay for their flights, the group pays you back at a value you all agree on.
          </p>
        </div>
        <Button asChild size="lg" className="h-12 rounded-full bg-travel px-7 text-base text-travel-foreground hover:bg-travel/90">
          <Link href="/signup?next=%2Ftrips%2Fnew">Start a trip</Link>
        </Button>
      </div>

      <div className="mt-8 max-w-[44rem] text-sm leading-relaxed text-muted-foreground">
        <p>
          How we work this out: published award charts for economy, round trip, reached by moving your bank points to a partner airline. Taxes and fees are extra, and a seat
          has to be open on the day you want; we don&rsquo;t check that here. Flights within the U.S. are mostly priced by the airline day to day, so they aren&rsquo;t
          listed. For those, figure your points are worth about 1¢ each on your bank&rsquo;s travel site. Point values from {value.checked}.
        </p>
      </div>
    </section>
  );
}

function Option({ o, region, travelers }: { o: CoverOption; region: string; travelers: number }) {
  return (
    <li className="grid gap-3 rounded-3xl border bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-xl font-semibold">{o.city}</p>
        <p className="text-sm text-muted-foreground">{region}</p>
      </div>
      <p className="text-[15px]">
        {pts(o.perPerson)} {o.program} points each, {pts(o.total)} for {travelers === 1 ? "you" : `all ${travelers}`}.
      </p>
      {o.from.length > 0 && (
        <p className="text-sm text-muted-foreground">Move {o.from.map((f) => `${pts(f.points)} ${f.bank}`).join(" and ")}.</p>
      )}
      {!o.covered && <p className="text-sm font-medium text-travel-ink">{pts(o.shortBy)} more {o.program} points needed</p>}
    </li>
  );
}
