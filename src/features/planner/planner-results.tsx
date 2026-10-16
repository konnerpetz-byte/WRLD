import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { SOURCE_PROGRAM } from "@/features/awards/regions";
import { BANKS } from "@/features/awards/transfers";

import type { FlightPay, TripOption } from "./plan";

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const pts = (n: number) => n.toLocaleString("en-US");
const bank = (key: string) => BANKS.find((b) => b.key === key);
const nameOf = (key: string) => bank(key)?.short ?? SOURCE_PROGRAM[key]?.name ?? key;
const SITE: Record<string, string> = { chase: "Chase Travel", amex: "Amex Travel", capitalone: "Capital One Travel", citi: "Citi Travel" };

/** Seats.aero's search for this route and month: where the traveler finds the actual seat. */
export function seatsAeroUrl(origin: string, destination: string, month: string, travelers: number) {
  const u = new URL("https://seats.aero/search");
  u.search = new URLSearchParams({
    origins: origin,
    destinations: destination,
    date: `${month}-01`,
    additional_days: "true",
    additional_days_num: "30",
    applicable_cabin: "economy",
    min_seats: String(travelers),
  }).toString();
  return u.toString();
}

const googleFlightsUrl = (origin: string, destination: string, monthLabel: string) =>
  `https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights from ${origin} to ${destination} in ${monthLabel}`)}`;

export function TripCard({
  t,
  home,
  month,
  monthLabel,
  cash,
  travelers,
  nights,
}: {
  t: TripOption;
  home: string;
  month: string;
  monthLabel: string;
  /** The traveler's budget, or null when they haven't set one */
  cash: number | null;
  travelers: number;
  nights: number;
}) {
  const left = cash == null ? 0 : cash - t.cashNeeded;
  const who = travelers === 1 ? "" : ` for ${travelers}`;
  return (
    <li className="grid gap-4 rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div>
          <h3 className="text-lg font-semibold">
            {t.city} <span className="font-mono text-sm font-normal text-muted-foreground">{t.code}</span>
          </h3>
          <p className="text-sm text-muted-foreground">
            {nights} nights{who}. Without points: {money(t.fullPrice)}
            {t.fareIs === "estimate" ? " (flights estimated)" : ""}.
            {t.costBasis === "nearby" ? ` Hotel and daily costs estimated from ${t.costNear}.` : t.costBasis === "default" ? " Hotel and daily costs are a general estimate." : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tabular-nums">{money(t.cashNeeded)}</p>
          <p className={`text-sm font-medium ${t.fit === "fits" ? "text-primary" : "text-muted-foreground"}`}>
            {cash == null ? "cash needed" : left >= 0 ? `cash, ${money(left)} to spare` : `cash, ${money(-left)} over your budget`}
          </p>
        </div>
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-xl bg-muted/50 px-3 py-2.5">
          <dt className="font-medium">Flights, round trip</dt>
          <dd className="mt-0.5 text-muted-foreground">
            <FlightLine pay={t.pay} fare={t.fare} flightCash={t.flightCash} fareIs={t.fareIs} />
          </dd>
        </div>
        <div className="rounded-xl bg-muted/50 px-3 py-2.5">
          <dt className="font-medium">Hotel, {nights} nights</dt>
          <dd className="mt-0.5 text-muted-foreground">
            {money(t.hotel)}
            {t.hyatt && (
              <>
                , {t.hyatt.nights === nights ? "all" : t.hyatt.nights} night{t.hyatt.nights === 1 ? "" : "s"} for about {pts(t.hyatt.points)} World of
                Hyatt points (
                {t.hyatt.from
                  .map((f) => (f.key === "hyatt" ? `${pts(f.points)} of your own` : `move ${pts(f.points)} ${nameOf(f.key)}`))
                  .join(", ")}
                ) at a mid-range Hyatt (Hyatt Place or similar; prices vary by hotel and night).{" "}
                <a
                  href={`https://www.google.com/maps/search/${encodeURIComponent(`Hyatt hotels ${t.city}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary underline underline-offset-2"
                >
                  see Hyatts there<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </>
            )}
            {t.hotelCredit > 0 && (
              <>
                , {money(t.hotelCredit)} of it with{" "}
                {t.hotelPoints.map((h, i) => (
                  <span key={h.key}>
                    {i ? " and " : ""}
                    {pts(h.points)} {nameOf(h.key)} points at {SITE[h.key]}
                  </span>
                ))}
              </>
            )}
          </dd>
        </div>
        <div className="rounded-xl bg-muted/50 px-3 py-2.5">
          <dt className="font-medium">Food, transit, sights</dt>
          <dd className="mt-0.5 text-muted-foreground">{money(t.days)}</dd>
        </div>
      </dl>

      {t.pointsUsed > 0 && (
        <p className="text-sm">
          Uses {pts(t.pointsUsed)} points
          {t.cents != null && (
            <>
              , worth <strong className="tabular-nums">{t.cents.toFixed(2)}¢</strong> each here
              {t.cents >= 1.3 ? ": a strong use." : t.cents >= 1 ? "." : ". That's low, but it's still the way that needs the least cash."}
            </>
          )}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3 text-sm">
        {t.pay.kind === "award" ? (
          <>
            <a
              href={seatsAeroUrl(home, t.code, month, travelers)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2"
            >
              Find the seat on Seats.aero
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
            <span className="text-muted-foreground">Check the seat is open before you move points. Live seats in WRLD: coming soon.</span>
          </>
        ) : (
          <a
            href={googleFlightsUrl(home, t.code, monthLabel)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2"
          >
            See fares on Google Flights
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}
        <Link href="/trips/new" className="font-medium text-primary underline underline-offset-2">
          Start this trip
        </Link>
      </div>
    </li>
  );
}

function FlightLine({ pay, fare, flightCash, fareIs }: { pay: FlightPay; fare: number; flightCash: number; fareIs: "live" | "estimate" }) {
  const fareText = `${money(fare)} cash fare${fareIs === "estimate" ? " (estimate)" : ""}`;
  if (pay.kind === "cash") return <>{money(fare)} cash{fareIs === "estimate" ? " (estimate)" : ""}. Your points do more on the hotel.</>;
  if (pay.kind === "portal") {
    return (
      <>
        {pay.from.map((f, i) => (
          <span key={f.key}>
            {i ? " + " : ""}
            {pts(f.points)} {nameOf(f.key)} points at {SITE[f.key]}
          </span>
        ))}
        {flightCash > 0 ? ` + ${money(flightCash)} cash` : ""} for the {fareText}.
      </>
    );
  }
  return (
    <>
      {pts(pay.miles)} {SOURCE_PROGRAM[pay.source]?.name ?? pay.program} miles{pay.label ? ` ${pay.label}` : ""} + about {money(pay.taxes)} taxes
      {pay.surcharges ? " (some airlines add fees)" : ""}, instead of a {fareText}.{" "}
      <span className="block mt-1">
        {pay.from.map((f, i) => (
          <span key={f.key}>
            {i ? "; " : ""}
            {f.key === pay.source ? `${pts(f.points)} of your own miles` : `move ${pts(f.points)} ${nameOf(f.key)} points`}
          </span>
        ))}
        .
      </span>
    </>
  );
}
