import { Car } from "lucide-react";
import Link from "next/link";

import { type DriveOption, formatDrive, MPG } from "./drive";

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
    budget: String(Math.round(cash)),
  });
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
}: {
  options: DriveOption[];
  cash: number;
  travelers: number;
  month: string;
  home: string;
  gasNote: string;
  signedIn: boolean;
}) {
  const fits = options.filter((o) => o.best).slice(0, 9);
  const close = options.filter((o) => !o.best).slice(0, 3);
  const who = travelers === 1 ? "" : ` for ${travelers}`;
  return (
    <section aria-labelledby="drive-h" className="grid gap-4">
      <div className="px-1">
        <h2 id="drive-h" className="flex items-center gap-2 text-lg font-semibold">
          <Car className="size-5 text-primary" aria-hidden="true" />
          {fits.length ? `${fits.length} road trips fit ${money(cash)}${who}` : `No road trip fits ${money(cash)}${who} yet`}
        </h2>
        <p className="text-sm text-muted-foreground">
          Weekend (2 nights) and long-weekend (3 nights) getaways within a few hours&rsquo; drive of {home}, with gas, hotel, food and fun
          included.
        </p>
      </div>

      {fits.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fits.map((t) => (
            <DriveCard key={t.getaway.key} t={t} cash={cash} travelers={travelers} month={month} signedIn={signedIn} />
          ))}
        </ul>
      )}
      {!fits.length && close.length > 0 && (
        <>
          <p className="px-1 text-sm">Closest to your budget. Try the budget travel style, or fewer people per room.</p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {close.map((t) => (
              <DriveCard key={t.getaway.key} t={t} cash={cash} travelers={travelers} month={month} signedIn={signedIn} />
            ))}
          </ul>
        </>
      )}
      <p className="px-1 text-xs text-muted-foreground">
        {gasNote} {MPG} miles a gallon and one car for every four people.{" "}
        {options.some((o) => o.routed)
          ? "Drive times and miles are real road routes from OpenRouteService, with a short stop every couple of hours."
          : "Drive times are estimates from distance (about 1.2 times the straight line at 58 mph), so routes around lakes or borders take longer."}{" "}
        Hotels are
        WRLD&rsquo;s estimates for a 3-star room near the U.S. average rate; tolls and parking aren&rsquo;t included.
      </p>
    </section>
  );
}

function DriveCard({ t, cash, travelers, month, signedIn }: { t: DriveOption; cash: number; travelers: number; month: string; signedIn: boolean }) {
  const show = t.best ?? t.lengths[0];
  return (
    <li className="grid content-start gap-3 rounded-2xl border bg-card p-5">
      <div>
        <h3 className="text-lg font-semibold">
          {t.getaway.name}, {t.getaway.state}
        </h3>
        <p className="text-sm text-muted-foreground">{t.getaway.why}</p>
        <p className="mt-1 text-sm">
          {t.routed ? "" : "About "}
          {formatDrive(t.hours)} each way, {t.routed ? "" : "about "}
          {t.roadMiles.toLocaleString("en-US")} miles
        </p>
      </div>
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
        {show.label}: gas {money(show.gas)} at ${t.gasPrice.toFixed(2)}/gal, hotel {money(show.hotel)}, food and fun {money(show.days)}.
      </p>
      <Link href={startUrl(t, show.nights, travelers, cash, month, signedIn)} className="text-sm font-medium text-primary underline underline-offset-4">
        Start this trip
      </Link>
    </li>
  );
}
