import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { PhotoSkeleton, PlacePhoto } from "@/features/places/place-photo";

import { SOURCE_PROGRAM } from "@/features/awards/regions";
import { airportByCode } from "@/features/places/airports";
import { BANKS } from "@/features/awards/transfers";

import { flyGem } from "./gems";
import { flyTitle } from "./photo-titles";
import { fridayIn } from "./stay-links";
import { placeLabel } from "./place-label";
import { EstMark } from "./est-mark";
import { StayRow } from "./stay-row";
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

/** A new trip, filled in from this result: the city, dates around the cheapest fare, travelers and budget. */
function startTripUrl({ t, month, nights, travelers, cash }: { t: TripOption; month: string; nights: number; travelers: number; cash: number | null }) {
  const a = airportByCode(t.code);
  const p = new URLSearchParams({ city: t.city, start: t.departDate ?? `${month}-15`, nights: String(nights), party: String(travelers) });
  if (a) {
    p.set("country", a.country);
    p.set("lat", String(a.latitude));
    p.set("lng", String(a.longitude));
  }
  if (cash != null && Number.isFinite(cash) && cash > 0) p.set("budget", String(Math.round(cash)));
  return `/trips/new?${p}`;
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
  tripId,
}: {
  t: TripOption;
  home: string;
  month: string;
  monthLabel: string;
  /** The traveler's budget, or null when they haven't set one */
  cash: number | null;
  travelers: number;
  nights: number;
  /** Set when this card is for an existing trip: the next step is adding the booked flight, not starting a trip */
  tripId?: string;
}) {
  const left = cash == null ? 0 : cash - t.cashNeeded;
  const gem = flyGem(t.code);
  const photo = flyTitle(t.code);
  const each = travelers > 1 ? `${money(t.cashNeeded / travelers)} each` : null;
  const badge = gem ? (
    <span className="absolute left-3 top-3 rounded-full bg-background/85 px-2.5 py-1 text-xs font-medium backdrop-blur-md">Hidden gem</span>
  ) : null;
  const basis =
    t.costBasis === "perdiem-city"
      ? `Hotel and daily costs from U.S. government per diem rates for ${t.costNear}, scaled to leisure travel.`
      : t.costBasis === "perdiem-country"
        ? `Hotel and daily costs from the ${t.costNear}, scaled to leisure travel.`
        : t.costBasis === "nearby"
          ? `Hotel and daily costs estimated from ${t.costNear}.`
          : t.costBasis === "default"
            ? "Hotel and daily costs are a general estimate."
            : "Hotel and daily costs are WRLD's estimate for the city.";
  const label = placeLabel(t.code, t.city, airportByCode(t.code)?.country);
  const external = "inline-flex items-center gap-1 font-medium text-primary hover:underline";
  return (
    <li className="relative flex flex-col overflow-hidden rounded-2xl border bg-card">
      <Suspense fallback={<PhotoSkeleton>{badge}</PhotoSkeleton>}>
        <PlacePhoto title={photo.title} search={photo.search} alt={label}>
          {badge}
        </PlacePhoto>
      </Suspense>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="text-[17px] font-semibold leading-tight tracking-[-0.01em]">{label}</h3>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
            {gem ? gem.why : `${nights} nights${travelers === 1 ? "" : ` for ${travelers}`}, flights included`}
          </p>
        </div>

        <div>
          <p className="text-2xl font-semibold leading-none tabular-nums tracking-[-0.02em]">
            {money(t.cashNeeded)}
            <EstMark />
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {[cash == null ? "cash needed" : "cash", each, t.pointsUsed > 0 ? `plus ${pts(t.pointsUsed)} points` : null].filter(Boolean).join(" · ")}
          </p>
          {cash != null && (
            <p className={`mt-1 text-sm font-medium ${t.fit === "fits" ? "text-primary" : "text-muted-foreground"}`}>
              {left >= 0 ? `${money(left)} to spare` : `${money(-left)} over your budget`}
            </p>
          )}
        </div>
        {gem && <p className="line-clamp-2 text-sm">Free: {gem.free[0]}</p>}
        <StayRow place={label} checkIn={t.departDate ?? fridayIn(month)} nights={nights} people={travelers} />

        <details className="group text-sm" open={Boolean(tripId) || undefined}>
          <summary className="tap w-fit cursor-pointer list-none text-primary [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">{t.pointsUsed > 0 ? "How to pay with points" : "What's included"}</span>
            <span className="hidden group-open:inline">Hide details</span>
          </summary>
          <dl className="mt-2 grid gap-2 text-muted-foreground">
            <div>
              <dt className="font-medium text-foreground">Flights, round trip</dt>
              <dd className="text-xs">
                Into {airportByCode(t.code)?.name ?? t.city} ({t.code})
              </dd>
              <dd>
                <FlightLine pay={t.pay} fare={t.fare} flightCash={t.flightCash} fareIs={t.fareIs} />
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Hotel, {nights} nights</dt>
              <dd>
                {money(t.hotel)}
                {t.hyatt && (
                  <>
                    , {t.hyatt.nights === nights ? "all" : t.hyatt.nights} night{t.hyatt.nights === 1 ? "" : "s"} for about {pts(t.hyatt.points)} World
                    of Hyatt points (
                    {t.hyatt.from
                      .map((f) => (f.key === "hyatt" ? `${pts(f.points)} of your own` : `move ${pts(f.points)} ${nameOf(f.key)}`))
                      .join(", ")}
                    ) at a mid-range Hyatt; prices vary by hotel and night.{" "}
                    <a href={`https://www.google.com/maps/search/${encodeURIComponent(`Hyatt hotels ${t.city}`)}`} target="_blank" rel="noopener noreferrer" className={external}>
                      See Hyatts there<span className="sr-only"> (opens in a new tab)</span>
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
            <div>
              <dt className="font-medium text-foreground">Food, transit, sights</dt>
              <dd>{money(t.days)}</dd>
            </div>
            {t.pointsUsed > 0 && t.cents != null && (
              <p>
                Your points are worth {t.cents.toFixed(2)}¢ each here
                {t.cents >= 1.3 ? ", a strong use." : t.cents >= 1 ? "." : ". That's low, but it's still the way that needs the least cash."}
              </p>
            )}
            <p>
              {basis}{" "}
              <Link href="/how-wrld-works#prices" className="text-primary hover:underline">
                How WRLD estimates
              </Link>
              . Without points: {money(t.fullPrice)}
              {t.fareIs === "estimate" ? " (flights estimated for the month)" : t.fareIs === "half" ? " (return flight estimated)" : ""}.
            </p>
            {gem && gem.free.length > 1 && <p>Also free: {gem.free.slice(1).join("; ")}.</p>}
            <p>
              {t.pay.kind === "award" ? (
                <a href={seatsAeroUrl(home, t.code, month, travelers)} target="_blank" rel="noopener noreferrer" className={external}>
                  Find the seat on Seats.aero before moving points
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              ) : (
                <a href={googleFlightsUrl(home, t.code, monthLabel)} target="_blank" rel="noopener noreferrer" className={external}>
                  See fares on Google Flights
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              )}
            </p>
          </dl>
        </details>

        <Link
          href={tripId ? `/trips/${tripId}/transit` : startTripUrl({ t, month, nights, travelers, cash })}
          className="tap mt-auto inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-transform active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {tripId ? "Booked it? Add the flight" : "Start this trip"}
        </Link>
      </div>
    </li>
  );
}

function FlightLine({ pay, fare, flightCash, fareIs }: { pay: FlightPay; fare: number; flightCash: number; fareIs: TripOption["fareIs"] }) {
  const note = fareIs === "estimate" ? " (estimate)" : fareIs === "half" ? " (return estimated)" : "";
  const fareText = `${money(fare)} cash fare${note}`;
  if (pay.kind === "cash")
    return (
      <>
        {money(fare)} cash{note}. Your points do more on the hotel.
      </>
    );
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
      {pts(pay.miles)} {SOURCE_PROGRAM[pay.source]?.name ?? pay.program} miles{pay.label ? ` ${pay.label}` : ""} + about {money(pay.taxes)}{" "}
      taxes
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
