import { Car } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { Shelf } from "@/components/shelf";

import { PhotoSkeleton, PlacePhoto } from "@/features/places/place-photo";

import { type DriveOption, formatDrive, MPG } from "./drive";
import { driveTitle } from "./photo-titles";
import { seasonWord } from "./seasons";
import { fridayIn } from "./stay-links";
import { EstMark } from "./est-mark";
import { StayRow } from "./stay-row";

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

function startUrl(t: DriveOption, nights: number, travelers: number, cash: number, start: string, signedIn: boolean) {
  const p = new URLSearchParams({
    city: t.getaway.name,
    country: "US",
    lat: String(t.getaway.latitude),
    lng: String(t.getaway.longitude),
    start,
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
    <section aria-labelledby="drive-h" className="grid gap-6">
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

      {popular.length > 0 && <Shelf title="Popular getaways">{popular.map(card)}</Shelf>}
      {gems.length > 0 && <Shelf title="Hidden gems and small towns">{gems.map(card)}</Shelf>}
      {close.length > 0 && (
        <Shelf
          tone="muted"
          title={allFits.length ? "Just over your budget" : "Closest to your budget"}
          subtitle={allFits.length ? undefined : "Try the budget travel style, or fewer people per room."}
        >
          {close.map(card)}
        </Shelf>
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

export function DriveCard({
  t,
  cash,
  travelers,
  month,
  signedIn,
  checkIn,
}: {
  t: DriveOption;
  cash: number;
  travelers: number;
  month: string;
  signedIn: boolean;
  /** The Friday the weekend starts; worked out from today when not given (pre-built pages pass it in). */
  checkIn?: string;
}) {
  const start = checkIn ?? fridayIn(month);
  const show = t.best ?? t.lengths[0];
  const others = t.lengths.filter((l) => l !== show);
  const photo = driveTitle(t.getaway);
  const busy = seasonWord(t.season.factor);
  const budget = Number.isFinite(cash);
  const over = budget && !show.fits ? show.total - cash : 0;
  const who = travelers === 1 ? "" : ` for ${travelers}`;
  const badge = t.getaway.gem ? (
    <span className="absolute left-3 top-3 rounded-full bg-background/85 px-2.5 py-1 text-xs font-medium backdrop-blur-md">Hidden gem</span>
  ) : null;
  return (
    <li className="flex flex-col overflow-hidden rounded-2xl border bg-card">
      <Suspense fallback={<PhotoSkeleton>{badge}</PhotoSkeleton>}>
        <PlacePhoto title={photo.title} search={photo.search} alt={`${t.getaway.name}, ${t.getaway.state}`}>
          {badge}
        </PlacePhoto>
      </Suspense>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="text-[17px] font-semibold leading-tight tracking-[-0.01em]">
            {t.getaway.name}, {t.getaway.state}
          </h3>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
            {t.routed ? "" : "About "}
            {formatDrive(t.hours)} drive{t.getaway.why ? ` · ${t.getaway.why}` : ""}
          </p>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-2xl font-semibold leading-none tabular-nums tracking-[-0.02em]">
              {money(show.total)}
              <EstMark />
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {show.label}
              {who}
              {travelers > 1 ? ` · ${money(show.total / travelers)} each` : ""}
            </p>
          </div>
          {others.length > 0 && (
            <ul className="text-right text-xs tabular-nums text-muted-foreground">
              {others.map((l) => (
                <li key={l.nights}>
                  {l.label} {money(l.total)}
                </li>
              ))}
            </ul>
          )}
        </div>
        {over > 0 && <p className="text-sm font-medium text-muted-foreground">{money(over)} over your budget</p>}
        {t.getaway.free?.length ? <p className="line-clamp-2 text-sm">Free: {t.getaway.free[0]}</p> : null}
        <StayRow place={`${t.getaway.name.replace(/\s*\(.*?\)/g, "")}, ${t.getaway.state}`} checkIn={start} nights={show.nights} people={travelers} />

        <details className="group text-sm">
          <summary className="tap w-fit cursor-pointer list-none text-primary [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">What&rsquo;s included</span>
            <span className="hidden group-open:inline">Hide details</span>
          </summary>
          <div className="mt-2 grid gap-1.5 text-muted-foreground">
            <p>
              {show.label}: gas {money(show.gas)} (${t.gasPrice.toFixed(2)} a gallon, {t.roadMiles.toLocaleString("en-US")} miles each way),{" "}
              {show.stay === "rental" ? "a vacation house with cleaning and service fees" : travelers > 1 ? "hotel rooms for two" : "a hotel room"}{" "}
              {money(show.hotel)}
              {busy ? ` (${busy} in ${monthName(month)})` : ""}, food and fun {money(show.days)}. All estimates;{" "}
              <Link href="/how-wrld-works#prices" className="text-primary hover:underline">
                how WRLD estimates
              </Link>
              .
            </p>
            {t.getaway.free && t.getaway.free.length > 1 && <p>Also free: {t.getaway.free.slice(1).join("; ")}.</p>}
          </div>
        </details>

        <Link
          href={startUrl(t, show.nights, travelers, cash, start, signedIn)}
          className="tap mt-auto inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-transform active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Start this trip
        </Link>
      </div>
    </li>
  );
}

const monthName = (month: string) =>
  new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
