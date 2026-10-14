import { Check, ChevronDown, ExternalLink } from "lucide-react";
import { Fragment } from "react";

import { formatPoints } from "@/lib/format";

import { liveSearchUrl } from "./deeplinks";
import type { DestinationResult, Option } from "./engine";
import { ago } from "./explore";
import { feeRange } from "./fees";
import { CABINS } from "./regions";
import { ReportedVote } from "./reported-vote";

/**
 * Explorer results as a scannable list: one row per destination with the best
 * way to book, opening into every option with its booking steps and costs.
 * Shared by the Points explorer page and its design preview.
 */

const PORTAL_LINKS = [
  { name: "Chase Travel", url: "https://travelsecure.chase.com" },
  { name: "Amex Travel", url: "https://www.amextravel.com" },
  { name: "Capital One Travel", url: "https://travel.capitalone.com" },
  { name: "Citi Travel", url: "https://www.thankyou.com" },
];

const day = (iso: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    ...opts,
    timeZone: "UTC",
  });

/** Every price says how WRLD knows it, from surest to least sure. */
function Tag({ o }: { o: Option }) {
  const chip = "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium";
  if (o.days.some((d) => d.live)) return <span className={`${chip} bg-primary text-primary-foreground`}>Live seats</span>;
  if (o.kind === "seats") return <span className={`${chip} bg-open-soft text-primary`}>Seen on the airline&rsquo;s site</span>;
  if (o.kind === "portal") return <span className={`${chip} bg-travel/20`}>Any seat, today&rsquo;s fare</span>;
  if (o.kind === "revenue") return <span className={`${chip} bg-travel/20`}>Set by today&rsquo;s fare</span>;
  if (o.kind === "predicted")
    return <span className={`${chip} border border-dashed border-travel-ink/40 text-travel-ink`}>Predicted from today&rsquo;s fare</span>;
  return <span className={`${chip} bg-muted font-normal text-muted-foreground`}>If a seat opens</span>;
}

function Cost({ o, size = "md" }: { o: Option; size?: "md" | "lg" }) {
  const surcharge = o.cash.estimate.plusSurcharges && !o.cash.reported;
  return (
    <div className="shrink-0 text-right tabular-nums">
      <p className={`font-semibold ${size === "lg" ? "font-display text-xl sm:text-2xl" : "text-base"}`}>
        {o.pointsHigh && o.pointsHigh !== o.points ? `${formatPoints(o.points)}–${formatPoints(o.pointsHigh)}` : formatPoints(o.points)}
      </p>
      <p className="text-xs text-muted-foreground">
        + {feeRange(o.cash.low, o.cash.high)}
        {surcharge ? <span className={o.cash.estimate.surcharge.level === "high" ? "text-destructive" : ""}> + surcharges</span> : null}
      </p>
    </div>
  );
}

/** The answer to "points or cash?" for one destination: the best points option against the cash fare. */
export function verdict(d: DestinationResult): {
  points: Option | null;
  fare: number | null;
  win: "points" | "cash" | null;
  saves: number;
} {
  // Cash fares are economy, so only economy awards are compared with them.
  const awards = d.options
    .filter((o) => o.kind !== "portal" && o.cabin === "economy" && o.trueCost != null)
    .sort((a, b) => a.trueCost! - b.trueCost!);
  const points = awards[0] ?? null;
  const fare = d.fare;
  if (!points || fare == null) return { points, fare, win: null, saves: 0 };
  const saves = Math.round(fare - points.trueCost!);
  return { points, fare, win: saves > 0 ? "points" : "cash", saves };
}

function Verdict({ d }: { d: DestinationResult }) {
  const v = verdict(d);
  if (!v.win || !v.points) return null;
  return (
    <p className="mt-1">
      {v.win === "points" ? (
        <span className="inline-flex shrink-0 items-center rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
          {v.points.kind === "chart" ? "Could save" : "Points save"} about ${v.saves.toLocaleString("en-US")} vs cash
        </span>
      ) : (
        <span className="inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium">
          Cash is cheaper: ${Math.round(v.fare!).toLocaleString("en-US")} fare
        </span>
      )}
    </p>
  );
}

function Worth({ o }: { o: Option }) {
  if (o.kind === "portal") {
    return <p className="text-xs text-muted-foreground">Same as paying the fare in cash: 1 cent a point, any seat.</p>;
  }
  if (!o.value) {
    return o.trueCost != null ? (
      <p className="text-xs text-muted-foreground">
        Worth about ${o.trueCost.toLocaleString("en-US")} all in, counting each point at 1 cent (what a card travel site pays).
      </p>
    ) : null;
  }
  const good = o.value.cents > 1;
  return (
    <p className={`text-xs ${good ? "font-medium text-primary" : "text-muted-foreground"}`}>
      Cash fare {o.value.sameDay ? "that day" : "this month"}: ${Math.round(o.value.fare).toLocaleString("en-US")}. Your points are worth{" "}
      {o.value.cents.toFixed(1)} cents each here,{" "}
      {good
        ? "more than the 1 cent a card travel site gives. Use points."
        : "no better than a card travel site. Pay cash or use the travel site."}
    </p>
  );
}

function route(o: Option) {
  const c = o.chart;
  if (o.fares?.length) {
    const f = o.fares[0];
    return `$${f.price.toFixed(0)} fare on ${f.airline}${f.stops ? `, ${f.stops} stop${f.stops === 1 ? "" : "s"}` : ", nonstop"}. ${
      o.fares.length
    } day${o.fares.length === 1 ? "" : "s"} with fares`;
  }
  if (o.kind === "seats") return `${o.days.length} day${o.days.length === 1 ? "" : "s"} with seats`;
  if (!c) return "";
  if (c.basis !== "route") return "Route not confirmed yet";
  return `${c.via ? `Via ${c.via}` : "Nonstop"} on ${(c.airlines ?? []).slice(0, 2).join(" or ")}${c.seasonal ? " (seasonal)" : ""}`;
}

/** "about $121" in words people use. */
const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/**
 * One destination: the answer first (the cheapest way to pay and how it
 * compares with cash), then every way to pay, cheapest first, with the cash
 * fare in its place in the list. The best option opens with its steps.
 */
export function DestinationRow({ d, date, defaultOpen }: { d: DestinationResult; date: string; defaultOpen?: boolean }) {
  const best = d.options[0];
  const v = verdict(d);
  // Where cash sits among the ways to pay (by what each really costs).
  const cashAt = d.fare == null ? -1 : d.options.findIndex((o) => (o.trueCost ?? Infinity) > d.fare!);
  return (
    <li>
      <details
        open={defaultOpen}
        className="group rounded-2xl border bg-card transition-shadow open:shadow-[0_12px_40px_-20px_rgb(10_18_15/0.35)]"
      >
        <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-2xl px-4 py-3.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:gap-5 sm:px-5">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">
              {d.city} <span className="font-normal text-muted-foreground">{d.destination}</span>
            </p>
            <p className="truncate text-sm text-muted-foreground">
              Best: {best.program}
              {best.kind === "chart" ? ", if a seat opens" : ""}
            </p>
            <Verdict d={d} />
          </div>
          <Cost o={best} size="lg" />
          <ChevronDown
            className="size-5 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="border-t">
          <p className="px-4 pt-4 text-sm font-semibold sm:px-5">
            {d.options.length + (d.fare != null ? 1 : 0)} ways to pay, cheapest first
            {v.win === "points" && v.points ? (
              <span className="font-normal text-muted-foreground"> · counting points at 1 cent each</span>
            ) : null}
          </p>
          <ul className="grid divide-y">
            {d.options.map((o, i) => (
              <Fragment key={o.key}>
                {i === cashAt && <CashRow fare={d.fare!} />}
                <OptionDetail o={o} date={date} open={i === 0} />
              </Fragment>
            ))}
            {d.fare != null && cashAt === -1 && <CashRow fare={d.fare} />}
          </ul>
        </div>
      </details>
    </li>
  );
}

/** Paying cash, as one of the ways to pay, so the comparison is right there. */
function CashRow({ fare }: { fare: number }) {
  return (
    <li className="flex items-center justify-between gap-3 bg-muted/40 px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <p className="font-medium">Pay cash</p>
        <p className="text-sm text-muted-foreground">Lowest economy fare travelers found in the last 48 hours. Keeps your points.</p>
      </div>
      <p className="shrink-0 text-right font-semibold tabular-nums">{usd(fare)}</p>
    </li>
  );
}

function OptionDetail({ o, date, open }: { o: Option; date: string; open?: boolean }) {
  const lowest = o.days[0] ? o.days.reduce((a, b) => (b.miles < a.miles ? b : a)) : null;
  const live = liveSearchUrl(o.source, {
    origin: o.origin,
    destination: o.destination,
    date: lowest?.date ?? date,
    cabin: o.cabin,
  });
  const e = o.cash.estimate;
  return (
    <li>
      <details open={open} className="group/opt">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3.5 hover:bg-muted/30 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:px-5">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {o.program} <Tag o={o} />
            </p>
            <p className="text-sm text-muted-foreground">
              {o.origin} to {o.destination} · {CABINS[o.cabin].label}. {route(o)}
              {o.chart?.note ? ` (${o.chart.note})` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-start gap-2">
            <div className="text-right">
              <Cost o={o} />
              {o.trueCost != null && o.kind !== "portal" && (
                <p className="text-[11px] text-muted-foreground tabular-nums">≈ {usd(o.trueCost)} all in</p>
              )}
            </div>
            <ChevronDown className="mt-1 size-4 text-muted-foreground transition-transform group-open/opt:rotate-180" aria-hidden="true" />
          </div>
        </summary>
        <div className="grid gap-4 px-4 pb-4 sm:px-5">
          {o.kind === "seats" && lowest && (
            <div className="grid gap-2">
              <ul className="flex flex-wrap gap-1.5" aria-label="Days with open seats">
                {o.days.slice(0, 14).map((s) => (
                  <li key={s.date} className="rounded-lg border px-2.5 py-1 text-xs tabular-nums">
                    {day(s.date)} <span className="font-semibold">{Math.round(s.miles / 1000)}k</span>
                  </li>
                ))}
                {o.days.length > 14 && <li className="px-1 py-1 text-xs text-muted-foreground">+{o.days.length - 14} more</li>}
              </ul>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>
                  {lowest.live ? "Live from Seats.aero, updated" : lowest.reported ? "Seen by a traveler" : "Checked"} {ago(lowest.seenAt)}
                </span>
                {lowest.reported && <ReportedVote id={lowest.id} />}
              </div>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <div className={`grid content-start gap-3 rounded-xl p-3.5 ${o.directions.covered ? "bg-open-soft" : "bg-muted/50"}`}>
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                {o.directions.covered && <Check className="size-4 text-primary" aria-hidden="true" />}
                {o.directions.covered ? "Your points cover this" : "How to book it"}
              </p>
              <ol className="grid gap-1.5 text-sm">
                {o.directions.steps.map((step, i) => (
                  <li key={i} className="grid grid-cols-[1.25rem_minmax(0,1fr)]">
                    <span className="text-muted-foreground tabular-nums">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              {o.directions.shortBy ? (
                <p className="text-xs text-muted-foreground">
                  {formatPoints(o.directions.shortBy)} points short with the cards you&rsquo;ve added.
                </p>
              ) : null}
              {o.kind === "portal" && (
                <div className="flex flex-wrap gap-2">
                  {PORTAL_LINKS.map((p) => (
                    <a
                      key={p.name}
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-9 items-center gap-1 rounded-full border bg-background px-3 text-sm font-medium hover:border-primary/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {p.name} <ExternalLink className="size-3.5" aria-hidden="true" />
                    </a>
                  ))}
                </div>
              )}
              {live && o.kind !== "portal" && (
                <a
                  href={live.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 w-fit items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-[transform,background-color] hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-safe:active:scale-[0.97]"
                >
                  {live.prefilled ? "Check live seats" : `Search ${o.chart?.program ?? o.program}`}
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                  <span className="sr-only">on {o.program} (opens the airline&rsquo;s site)</span>
                </a>
              )}
            </div>

            <div className="grid content-start gap-2 text-sm">
              <p className="flex items-baseline justify-between gap-3 font-semibold">
                <span>Cash on top</span>
                <span className="tabular-nums">{feeRange(o.cash.low, o.cash.high)}</span>
              </p>
              {o.cash.reported && (
                <p className="text-xs text-muted-foreground">
                  What a traveler saw on the airline&rsquo;s site. WRLD&rsquo;s estimate: {feeRange(e.low, e.high)}.
                </p>
              )}
              <p
                className={`text-xs ${
                  e.surcharge.level === "high"
                    ? "text-destructive"
                    : e.surcharge.level === "none"
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                {e.surcharge.text}
              </p>
              <Worth o={o} />
              <details className="group/fees text-xs">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                  What&rsquo;s included
                  <ChevronDown className="size-3.5 transition-transform group-open/fees:rotate-180" aria-hidden="true" />
                </summary>
                <dl className="mt-1.5 grid gap-1">
                  {e.lines.map((l) => (
                    <div key={l.label} className="flex items-baseline justify-between gap-3">
                      <dt className="text-muted-foreground">{l.label}</dt>
                      <dd className="shrink-0 tabular-nums">{feeRange(l.low, l.high)}</dd>
                    </div>
                  ))}
                </dl>
              </details>
              {o.typical && (
                <p className="text-xs text-muted-foreground">
                  Lately{" "}
                  {o.typical.low === o.typical.high
                    ? formatPoints(o.typical.low)
                    : `${formatPoints(o.typical.low)} to ${formatPoints(o.typical.high)}`}{" "}
                  points on this route ({o.typical.count} sightings).
                </p>
              )}
            </div>
          </div>
        </div>
      </details>
    </li>
  );
}

/** How prices work, the steps, and every source, in one quiet disclosure at the bottom. */
export function AboutPrices() {
  return (
    <details className="group text-sm">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md font-medium text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        How prices work
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="mt-3 grid max-w-[70ch] gap-3 text-muted-foreground">
        <p>
          <strong className="text-foreground">Seen on the airline&rsquo;s site</strong>: WRLD travelers saw these seats in the last three
          days, with the dates and taxes shown. <strong className="text-foreground">Any seat, today&rsquo;s fare</strong>: card travel sites
          (Chase, Amex, Capital One, Citi) pay for any seat at 1 cent a point. <strong className="text-foreground">If a seat opens</strong>:
          the program&rsquo;s published chart price, on routes its partner airlines really fly; check the seat before moving points.
        </p>
        <p>
          <strong className="text-foreground">Predicted from today&rsquo;s fare</strong>: Delta prices awards on its own flights at about
          1.1 cents a mile of the cash fare, so WRLD shows the miles range today&rsquo;s lowest Delta fare works out to. United, American
          and Alaska appear here only once WRLD travelers have saved enough real prices to measure them. Each price travelers save with WRLD
          is matched to that day&rsquo;s fare, so the range gets tighter the more WRLD is used.
        </p>
        <p>
          <strong className="text-foreground">Best deal</strong> counts every point at 1 cent, because that&rsquo;s what Chase, Amex,
          Capital One and Citi travel sites pay for any seat. An award is only worth booking when it beats that: WRLD adds the points at 1
          cent to the cash on top and compares it with the cash fare for the same day. &ldquo;Points save&rdquo; means the award costs you less than paying cash. When a program prices within a range, WRLD counts the
          top of the range, so a deal never depends on the luckiest day.
        </p>
        <p>
          Cash on top includes government taxes, airport charges and booking fees, plus whether the program adds fuel surcharges. Airport
          charges are WRLD&rsquo;s estimate, shown as a range. Always confirm the seat on the airline&rsquo;s site before you transfer:
          transfers can&rsquo;t be undone.
        </p>
        <p className="text-xs leading-relaxed">
          Sources: Aeroplan partner chart (June 2026) and AAdvantage partner chart, each checked against two sources on Oct 13, 2026. Card
          transfer partners and ratios from NerdWallet and Thrifty Traveler, checked Oct 13, 2026. Taxes from Delta&rsquo;s U.S. taxes page,
          UK Air Passenger Duty, and the French, German and Dutch governments. Routes from{" "}
          <a href="https://en.wikipedia.org" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            Wikipedia
          </a>{" "}
          (CC BY-SA), refreshed weekly. Exchange rates from the European Central Bank via Frankfurter.
        </p>
      </div>
    </details>
  );
}
