import { ArrowRight, Check, ExternalLink, Info, Users } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/layout/page-skeleton";
import { CheckLive } from "@/features/awards/check-live";
import { liveSearchUrl } from "@/features/awards/deeplinks";
import { ago } from "@/features/awards/explore";
import { type DestinationResult, monthOptions, type Option, parseQuery, runExplorer, type Wallet } from "@/features/awards/engine";
import { ExplorerFilters, type FilterState } from "@/features/awards/explorer-filters";
import { feeRange, fxFrom } from "@/features/awards/fees";
import { CABINS, REGIONS, SOURCE_PROGRAM } from "@/features/awards/regions";
import { ReportedVote } from "@/features/awards/reported-vote";
import { ReportSeatForm } from "@/features/awards/report-seat-form";
import { BANKS } from "@/features/awards/transfers";
import { formatPoints } from "@/lib/format";
import { requireUserId } from "@/lib/supabase/server";

export const metadata = { title: "Points explorer" };

export default function PointsExplorerPage({ searchParams }: PageProps<"/points">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Explorer searchParams={searchParams} />
    </Suspense>
  );
}

const day = (iso: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });

async function Explorer({ searchParams }: { searchParams: PageProps<"/points">["searchParams"] }) {
  const { supabase, userId } = await requireUserId();
  const sp = (await searchParams) as Record<string, string | undefined>;

  const [{ data: profile }, { data: accounts }, { data: rates }] = await Promise.all([
    supabase.from("profiles").select("home_airport").eq("id", userId).maybeSingle(),
    supabase.from("loyalty_accounts").select("balance, program:loyalty_programs(slug)").eq("user_id", userId),
    supabase.from("exchange_rates").select("quote, rate, as_of").order("as_of", { ascending: false }).limit(400),
  ]);

  const home = profile?.home_airport?.toUpperCase() ?? null;
  const q = parseQuery(sp, home);

  const balances = new Map<string, number>();
  for (const a of accounts ?? []) {
    const slug = (a.program as unknown as { slug: string } | null)?.slug;
    if (slug) balances.set(slug, (balances.get(slug) ?? 0) + Number(a.balance ?? 0));
  }
  const wallet: Wallet = { balances };
  const rateMap = new Map<string, number>();
  for (const r of rates ?? []) if (!rateMap.has(r.quote)) rateMap.set(r.quote, Number(r.rate));
  const fx = fxFrom(rateMap);

  const result = q.origins.length ? await runExplorer(supabase, userId, q, wallet, fx) : null;

  const months = monthOptions();
  const initial: FilterState = {
    from: q.origins.join(", "),
    to: q.regions,
    codes: q.codes.join(", "),
    dateMode: q.months.length ? "months" : "dates",
    months: q.months.length ? q.months : [months[1].value],
    start: q.start,
    end: q.end,
    cabins: q.cabins,
    banks: q.banks,
    programs: q.programs,
    mine: q.mine,
    direct: q.directOnly,
    sort: q.sort,
  };

  const when = q.months.length
    ? q.months.map((m) => months.find((o) => o.value === m)?.label ?? m).join(", ")
    : q.start === q.end
      ? day(q.start, { month: "short", day: "numeric", year: "numeric" })
      : `${day(q.start)} – ${day(q.end, { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <div className="grid gap-6">
      <p className="text-muted-foreground">
        Where your miles and card points can take you: what each trip costs in points, the taxes and fees on top, and exactly which points to
        move where.
      </p>

      <HowItWorks />

      {!home && !sp.from && (
        <p className="rounded-xl border border-dashed bg-card p-4 text-sm">
          Set your home airport in{" "}
          <Link href="/account" className="font-medium text-primary underline underline-offset-2">
            Account
          </Link>{" "}
          so the explorer starts from it every time.
        </p>
      )}

      <ExplorerFilters
        initial={initial}
        regions={Object.entries(REGIONS).map(([value, r]) => ({ value, label: r.label }))}
        monthOptions={months}
        cabins={Object.entries(CABINS).map(([value, c]) => ({ value, label: c.label }))}
        banks={BANKS.map((b) => ({ value: b.key, label: b.name.replace(/ (Ultimate Rewards|Membership Rewards|ThankYou Points|Rewards|Miles)$/, "") }))}
        programs={Object.entries(SOURCE_PROGRAM)
          .map(([value, p]) => ({ value, label: p.name }))
          .sort((a, b) => a.label.localeCompare(b.label))}
        hasWallet={balances.size > 0}
      />

      {!q.origins.length ? (
        <p className="rounded-xl border border-dashed bg-card p-6 text-sm">Enter the airport you&rsquo;re flying from to start.</p>
      ) : result && result.destinations.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card p-6 text-sm">
          Nothing matches these filters. Try more destinations, another cabin, or fewer program filters.
        </p>
      ) : result ? (
        <section aria-labelledby="results-h" className="grid gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="results-h" className="text-xl font-semibold">
              {result.destinations.length} destination{result.destinations.length === 1 ? "" : "s"} from {q.origins.join(", ")} · {when}
            </h2>
            <p className="text-xs text-muted-foreground">
              {result.seatsSeen ? `${result.seatsSeen} open seat${result.seatsSeen === 1 ? "" : "s"} reported` : "No open seats reported yet for these dates"}
            </p>
          </div>
          <ul className="grid gap-4 lg:grid-cols-2">
            {result.destinations.slice(0, 40).map((d) => (
              <DestinationCard key={d.destination} d={d} date={q.start} />
            ))}
          </ul>
          {result.destinations.length > 40 && (
            <p className="text-sm text-muted-foreground">Showing the 40 best of {result.destinations.length}. Narrow the filters to see others.</p>
          )}
          <Sources />
        </section>
      ) : null}

      <CheckLive />

      <ReportSeatForm
        origin={q.origins[0] ?? ""}
        cabin={q.cabins[0]}
        programs={Object.entries(SOURCE_PROGRAM)
          .map(([source, p]) => ({ source, name: p.name }))
          .sort((a, b) => a.name.localeCompare(b.name))}
        minDate={new Date().toISOString().slice(0, 10)}
      />
    </div>
  );
}

function HowItWorks() {
  return (
    <details className="group rounded-2xl border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <Info className="size-4 text-primary" aria-hidden="true" />
        How the points explorer works
        <span className="ml-auto text-xs font-normal text-muted-foreground group-open:hidden">Show</span>
      </summary>
      <div className="grid gap-3 px-4 pb-4 text-sm">
        <ol className="grid gap-2 sm:grid-cols-3">
          <li className="rounded-xl bg-muted/50 p-3">
            <p className="font-semibold">1. Pick where and when</p>
            <p className="text-muted-foreground">
              Choose one or more home airports, regions or &ldquo;Anywhere,&rdquo; months or exact dates, cabins, and the cards or airlines
              you collect.
            </p>
          </li>
          <li className="rounded-xl bg-muted/50 p-3">
            <p className="font-semibold">2. Compare the real cost</p>
            <p className="text-muted-foreground">
              Each option shows the points and the cash on top: government taxes, airport charges, booking fees, and whether the program
              adds fuel surcharges.
            </p>
          </li>
          <li className="rounded-xl bg-muted/50 p-3">
            <p className="font-semibold">3. Follow the steps</p>
            <p className="text-muted-foreground">
              WRLD tells you which card points to transfer, how many, and where to book, for example &ldquo;Transfer 60,000 Chase points to
              Aeroplan, then search aircanada.com.&rdquo;
            </p>
          </li>
        </ol>
        <p className="text-muted-foreground">
          <strong className="text-foreground">Where prices come from.</strong> <em>Open seats</em> were seen on the airline&rsquo;s site by
          WRLD travelers in the last three days, with the dates and taxes they saw. <em>Published prices</em> are what the program charges
          when a seat is open, from its award chart, on routes where its partner airlines really fly. Always confirm the seat on the
          airline&rsquo;s site before you transfer: transfers can&rsquo;t be undone.
        </p>
      </div>
    </details>
  );
}

function DestinationCard({ d, date }: { d: DestinationResult; date: string }) {
  const [best, ...rest] = d.options;
  return (
    <li className="grid content-start gap-3 rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-semibold">
            {d.city} <span className="text-sm font-normal text-muted-foreground">{d.destination}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {d.options.length} way{d.options.length === 1 ? "" : "s"} to book
          </p>
        </div>
        <Price o={best} big />
      </div>
      <OptionBody o={best} date={date} />
      {rest.length > 0 && (
        <details className="group rounded-xl border">
          <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-primary focus-visible:outline-2 focus-visible:outline-ring">
            <span className="group-open:hidden">
              {rest.length} more option{rest.length === 1 ? "" : "s"}
            </span>
            <span className="hidden group-open:inline">Fewer options</span>
          </summary>
          <ul className="grid gap-3 border-t p-3">
            {rest.map((o) => (
              <li key={o.key} className="grid gap-2 border-b pb-3 last:border-b-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold">{o.program}</p>
                  <Price o={o} />
                </div>
                <OptionBody o={o} date={date} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

function Price({ o, big }: { o: Option; big?: boolean }) {
  return (
    <div className="shrink-0 text-right">
      <p className={`${big ? "font-display text-2xl" : "text-base"} font-semibold tabular-nums`}>{formatPoints(o.points)}</p>
      <p className="text-xs text-muted-foreground">
        points, one way · {CABINS[o.cabin].label}
      </p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">+ {feeRange(o.cash.low, o.cash.high)}</p>
      <p className="text-xs text-muted-foreground">{o.cash.reported ? "taxes & fees seen" : "taxes & fees, est."}</p>
      {o.cash.estimate.plusSurcharges && !o.cash.reported && (
        <p className={`text-xs ${o.cash.estimate.surcharge.level === "high" ? "text-destructive" : "text-muted-foreground"}`}>+ fuel surcharges likely</p>
      )}
    </div>
  );
}

function OptionBody({ o, date }: { o: Option; date: string }) {
  const c = o.chart;
  const lowest = o.days[0] ? o.days.reduce((a, b) => (b.miles < a.miles ? b : a)) : null;
  const live = liveSearchUrl(o.source, { origin: o.origin, destination: o.destination, date: lowest?.date ?? date, cabin: o.cabin });
  return (
    <div className="grid gap-2.5 text-sm">
      {o.kind === "seats" && lowest ? (
        <>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-open-soft px-2 py-0.5 text-xs font-medium text-primary">
              <Users className="size-3" aria-hidden="true" /> Open seats
            </span>
            <span>
              With <strong>{o.program}</strong>, {o.origin} to {o.destination}. {lowest.reported ? "Seen by a traveler" : "Checked"} {ago(lowest.seenAt)}.
            </span>
          </p>
          <ul className="flex flex-wrap gap-1.5" aria-label="Days with open seats">
            {o.days.slice(0, 14).map((s) => (
              <li key={s.date} className="rounded-md border px-2 py-1 text-xs tabular-nums">
                {day(s.date)} <span className="font-medium">{Math.round(s.miles / 1000)}k</span>
              </li>
            ))}
            {o.days.length > 14 && <li className="px-1 py-1 text-xs text-muted-foreground">+{o.days.length - 14} more</li>}
          </ul>
          {lowest.reported && <ReportedVote id={lowest.id} />}
        </>
      ) : c ? (
        <p>
          <span className="mr-1.5 inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium">Published price</span>
          {o.program} charges this when a seat is open
          {c.note ? ` (${c.note})` : ""}:{" "}
          {c.basis === "route"
            ? `${c.via ? `via ${c.via}` : "nonstop"} on ${(c.airlines ?? []).slice(0, 2).join(" or ")}${c.seasonal ? " (seasonal)" : ""}, ${c.miles.toLocaleString()} miles flown.`
            : `${c.miles.toLocaleString()} miles nonstop distance; WRLD hasn't confirmed which partners fly it yet.`}
        </p>
      ) : null}

      {o.typical && (
        <p className="text-xs text-muted-foreground">
          Seats on this route with {o.program} have cost{" "}
          <strong className="text-foreground">
            {o.typical.low === o.typical.high ? formatPoints(o.typical.low) : `${formatPoints(o.typical.low)}–${formatPoints(o.typical.high)}`}
          </strong>{" "}
          lately ({o.typical.count} sightings in 90 days).
        </p>
      )}

      <Fees o={o} />

      <div className={`rounded-xl p-3 ${o.directions.covered ? "bg-open-soft" : "bg-muted/50"}`}>
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
          {o.directions.covered ? (
            <>
              <Check className="size-3.5 text-primary" aria-hidden="true" /> Your points cover this
            </>
          ) : (
            "How to book it"
          )}
        </p>
        <ol className="grid gap-1">
          {o.directions.steps.map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="w-4 shrink-0 text-muted-foreground tabular-nums">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        {o.directions.shortBy ? (
          <p className="mt-1.5 text-xs text-muted-foreground">You&rsquo;re {formatPoints(o.directions.shortBy)} points short with the cards you&rsquo;ve added.</p>
        ) : null}
        {live && (
          <a
            href={live.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2.5 inline-flex min-h-9 w-fit items-center gap-1.5 rounded-full bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-[transform,background-color] hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-safe:active:scale-[0.97]"
          >
            {live.prefilled ? `Check live on ${o.program}` : `Search ${o.program}`}
            <ExternalLink className="size-3.5" aria-hidden="true" />
            <span className="sr-only">(opens the airline&rsquo;s site)</span>
          </a>
        )}
      </div>
    </div>
  );
}

function Fees({ o }: { o: Option }) {
  const e = o.cash.estimate;
  const tone = e.surcharge.level === "high" ? "text-destructive" : e.surcharge.level === "none" ? "text-primary" : "text-foreground";
  return (
    <details className="group rounded-xl border px-3 py-2">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-2 text-sm focus-visible:outline-2 focus-visible:outline-ring">
        <span className="font-medium">
          Cash on top: {feeRange(o.cash.low, o.cash.high)}
          {o.cash.reported ? " (what the traveler saw)" : " (estimate)"}
        </span>
        <span className={`text-xs ${tone}`}>
          {e.surcharge.level === "none" ? "No fuel surcharges" : e.surcharge.level === "unknown" ? "Surcharges: check" : "Fuel surcharges may apply"}
        </span>
        <ArrowRight className="ml-auto size-3.5 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden="true" />
      </summary>
      <div className="mt-2 grid gap-1.5 text-xs">
        {o.cash.reported && (
          <p className="text-muted-foreground">
            A traveler saw {feeRange(o.cash.low, o.cash.high)} on the airline&rsquo;s site. WRLD&rsquo;s own estimate for this trip is{" "}
            {feeRange(e.low, e.high)}:
          </p>
        )}
        <table className="w-full">
          <caption className="sr-only">Taxes and fees</caption>
          <tbody>
            {e.lines.map((l) => (
              <tr key={l.label} className="align-top">
                <td className="py-0.5 pr-3">
                  {l.label}
                  {l.note && <span className="block text-muted-foreground">{l.note}</span>}
                </td>
                <td className="py-0.5 text-right tabular-nums">{feeRange(l.low, l.high)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={tone}>{e.surcharge.text}</p>
        <p className="text-muted-foreground">One way, per adult, in U.S. dollars at today&rsquo;s exchange rates.</p>
      </div>
    </details>
  );
}

function Sources() {
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      Published prices: Aeroplan partner chart (from June 2026) and AAdvantage partner chart, each checked against two sources on Oct 13,
      2026. Card transfer partners and ratios: NerdWallet and Thrifty Traveler, checked Oct 13, 2026. Taxes: U.S. (Delta&rsquo;s taxes
      page), UK Air Passenger Duty, French, German and Dutch air taxes from their governments; airport charges are WRLD estimates. Routes
      from{" "}
      <a href="https://en.wikipedia.org" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
        Wikipedia
      </a>{" "}
      (CC BY-SA), refreshed weekly. Exchange rates: European Central Bank via Frankfurter. Programs change prices without notice; confirm on
      the airline&rsquo;s site before transferring points.
    </p>
  );
}
