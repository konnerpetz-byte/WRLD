import { Car } from "lucide-react";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { PlacePhoto } from "@/features/places/place-photo";

import { type DriveOption, formatDrive, MPG } from "./drive";
import { driveTitle } from "./photo-titles";
import { seasonWord } from "./seasons";
import { driveMeta, VIBES } from "./vibes";

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** The next Friday at least a week out, inside the chosen month when possible: when a weekend trip would start. */
function fridayIn(month: string) {
  const today = new Date();
  const soonest = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 7));
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  if (d < soonest) d.setTime(soonest.getTime());
  while (d.getUTCDay() !== 5) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function startUrl(t: DriveOption, nights: number, travelers: number, cash: number, month: string, signedIn: boolean) {
  const p = new URLSearchParams({
    city: t.getaway.name,
    country: "US",
    lat: String(t.getaway.latitude),
    lng: String(t.getaway.longitude),
    start: fridayIn(month),
    nights: String(nights),
    party: String(travelers),
  });
  if (Number.isFinite(cash) && cash > 0) p.set("budget", String(Math.round(cash)));
  const path = `/trips/new?${p}`;
  return signedIn ? path : `/signup?next=${encodeURIComponent(path)}`;
}

/** Road trips: weekend and long-weekend getaways in driving range, priced with gas, hotel and days there. */
export function DriveResults({
  options,
  cash,
  travelers,
  month,
  home,
  gasNote,
  signedIn,
  filterNote,
}: {
  /** Shown under the heading, e.g. which vibes the list is filtered to */
  filterNote?: string | null;
  options: DriveOption[];
  cash: number;
  travelers: number;
  month: string;
  home: string;
  gasNote: string;
  signedIn: boolean;
}) {
  const allFits = options.filter((o) => o.best);
  const popular = allFits.filter((o) => !o.getaway.gem);
  const gems = allFits.filter((o) => o.getaway.gem);
  // Just over: the weekend is within 15% of the budget.
  const near = options.filter((o) => !o.best && o.lengths[0].total <= cash * 1.15);
  const close = allFits.length ? near : options.filter((o) => !o.best).slice(0, 6);
  const who = travelers === 1 ? "" : ` for ${travelers}`;
  const card = (t: DriveOption) => <DriveCard key={t.getaway.key} t={t} cash={cash} travelers={travelers} month={month} signedIn={signedIn} />;
  return (
    <section aria-labelledby="drive-h" className="grid gap-4">
      <div className="px-1">
        <h2 id="drive-h" className="flex items-center gap-2 text-lg font-semibold">
          <Car className="size-5 text-primary" aria-hidden="true" />
          {allFits.length ? `${allFits.length} road trips fit ${money(cash)}${who}` : `No road trip fits ${money(cash)}${who} yet`}
        </h2>
        <p className="text-sm text-muted-foreground">
          Weekend (2 nights) and long-weekend (3 nights) getaways within a few hours&rsquo; drive of {home}, with gas, hotel, food and fun
          included. Hotels are priced for {monthName(month)}.
        </p>
        {filterNote && <p className="mt-1 text-sm">{filterNote}</p>}
      </div>

      {popular.length > 0 && <CardList items={popular} render={card} />}
      {gems.length > 0 && (
        <>
          <h3 className="mt-2 px-1 font-semibold">Hidden gems and small towns, many with free things to do</h3>
          <CardList items={gems} render={card} />
        </>
      )}
      {close.length > 0 && (
        <>
          <h3 className="mt-2 px-1 font-semibold">{allFits.length ? "Just over your budget" : "Closest to your budget"}</h3>
          {!allFits.length && <p className="px-1 text-sm">Try the budget travel style, or fewer people per room.</p>}
          <CardList items={close} render={card} />
        </>
      )}
      <p className="px-1 text-xs text-muted-foreground">
        {gasNote} {MPG} miles a gallon and one car for every four people.{" "}
        {options.some((o) => o.routed)
          ? "Drive times and miles are real road routes from OpenRouteService, with a short stop every couple of hours."
          : "Drive times are estimates from distance (about 1.2 times the straight line at 63 mph), so routes around lakes or borders take longer."}{" "}
        Hotels start from WRLD&rsquo;s estimate for a 3-star room in that kind of place and follow the month: GSA&rsquo;s monthly
        government rates where GSA lists the town, blended with WRLD&rsquo;s season pattern for lake towns, ski towns, beaches and
        cities. Tolls and parking aren&rsquo;t included.
      </p>
    </section>
  );
}

export function DriveCard({ t, cash, travelers, month, signedIn }: { t: DriveOption; cash: number; travelers: number; month: string; signedIn: boolean }) {
  const show = t.best ?? t.lengths[0];
  const meta = t.getaway.key.startsWith("place-") ? null : driveMeta(t.getaway.key);
  const photo = driveTitle(t.getaway);
  const busy = seasonWord(t.season.factor);
  return (
    <li className="grid content-start gap-3 overflow-hidden rounded-2xl border bg-card p-5">
      <Suspense fallback={<div className="-mx-5 -mt-5 aspect-[16/9] bg-muted" aria-hidden="true" />}>
        <PlacePhoto title={photo.title} search={photo.search} alt={`${t.getaway.name}, ${t.getaway.state}`} />
      </Suspense>
      <div>
        <h3 className="text-lg font-semibold">
          {t.getaway.name}, {t.getaway.state}
        </h3>
        {t.getaway.gem && <span className="mt-1 inline-block rounded-full bg-travel-soft px-2 py-0.5 text-xs font-medium text-travel-ink">Hidden gem</span>}
        <p className="text-sm text-muted-foreground">{t.getaway.why}</p>
        {meta && meta.vibes.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">{meta.vibes.map((v) => VIBES.find((x) => x.key === v)?.label).join(" · ")}</p>
        )}
        <p className="mt-1 text-sm">
          {t.routed ? "" : "About "}
          {formatDrive(t.hours)} each way, {t.routed ? "" : "about "}
          {t.roadMiles.toLocaleString("en-US")} miles
        </p>
      </div>
      {t.getaway.free?.length ? (
        <div className="text-sm">
          <p className="font-medium">Free to do</p>
          <ul className="mt-0.5 list-disc pl-5 text-muted-foreground">
            {t.getaway.free.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <ul className="grid gap-1 text-sm">
        {t.lengths.map((l) => (
          <li key={l.nights} className="flex items-baseline justify-between gap-3">
            <span>
              {l.label} <span className="text-muted-foreground">({l.nights} nights)</span>
            </span>
            <span className={`font-semibold tabular-nums ${l.fits ? "text-primary" : "text-muted-foreground"}`}>
              {money(l.total)}
              {!l.fits && <span className="ml-1 text-xs font-normal">({money(l.total - cash)} over)</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        {show.label}: gas {money(show.gas)} at ${t.gasPrice.toFixed(2)}/gal, hotel {money(show.hotel)}
        {busy ? ` (${busy} in ${monthName(month)})` : ""}, food and fun {money(show.days)}.
      </p>
      <Link href={startUrl(t, show.nights, travelers, cash, month, signedIn)} className="text-sm font-medium text-primary underline underline-offset-4">
        Start this trip
      </Link>
    </li>
  );
}

const monthName = (month: string) =>
  new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/** The first six cards, then the rest behind "Show more" so long lists stay scannable. */
export function CardList<T>({ items, render, first = 6, className = "grid gap-3 sm:grid-cols-2 lg:grid-cols-3" }: { items: T[]; render: (t: T) => ReactNode; first?: number; className?: string }) {
  const head = items.slice(0, first);
  const rest = items.slice(first);
  return (
    <>
      <ul className={className}>{head.map(render)}</ul>
      {rest.length > 0 && (
        <details className="group">
          <summary className="w-fit cursor-pointer list-none rounded-full border px-4 py-2 text-sm font-medium hover:bg-muted group-open:mb-3">
            <span className="group-open:hidden">Show {rest.length} more</span>
            <span className="hidden group-open:inline">Show fewer</span>
          </summary>
          <ul className={className}>{rest.map(render)}</ul>
        </details>
      )}
    </>
  );
}
