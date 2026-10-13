import Link from "next/link";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/layout/page-skeleton";
import { monthOptions, parseQuery, runExplorer, type Wallet } from "@/features/awards/engine";
import { AboutPrices, DestinationRow } from "@/features/awards/explorer-results";
import { ExplorerFilters, type FilterState } from "@/features/awards/explorer-filters";
import { fxFrom } from "@/features/awards/fees";
import { CABINS, REGIONS, SOURCE_PROGRAM } from "@/features/awards/regions";
import { ReportSeatForm } from "@/features/awards/report-seat-form";
import { BANKS } from "@/features/awards/transfers";
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
      : `${day(q.start)} to ${day(q.end, { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <div className="grid gap-6">
      <p className="max-w-[60ch] text-muted-foreground">
        What each trip costs in points, the cash on top, and exactly which points to move where.
        {!home && !sp.from && (
          <>
            {" "}
            <Link href="/account" className="font-medium text-primary underline underline-offset-2">
              Set your home airport
            </Link>{" "}
            to start from it every time.
          </>
        )}
      </p>

      <ExplorerFilters
        initial={initial}
        regions={Object.entries(REGIONS).map(([value, r]) => ({ value, label: r.label }))}
        monthOptions={months}
        cabins={Object.entries(CABINS).map(([value, c]) => ({ value, label: c.label }))}
        banks={BANKS.map((b) => ({ value: b.key, label: b.short }))}
        programs={Object.entries(SOURCE_PROGRAM)
          .map(([value, p]) => ({ value, label: p.name }))
          .sort((a, b) => a.label.localeCompare(b.label))}
        hasWallet={balances.size > 0}
      />

      {!q.origins.length ? (
        <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Enter the airport you&rsquo;re flying from to see where your points go.</p>
      ) : result && result.destinations.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nothing matches these filters. Try more destinations, another cabin, or fewer programs.
        </p>
      ) : result ? (
        <section aria-labelledby="results-h" className="grid gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-1">
            <h2 id="results-h" className="text-lg font-semibold">
              {result.destinations.length} destination{result.destinations.length === 1 ? "" : "s"} from {q.origins.join(", ")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {when}. {result.seatsSeen ? `${result.seatsSeen} open seat${result.seatsSeen === 1 ? "" : "s"} reported` : "No open seats reported yet"}
            </p>
          </div>
          <ul className="grid gap-2">
            {result.destinations.slice(0, 40).map((d, i) => (
              <DestinationRow key={d.destination} d={d} date={q.start} defaultOpen={i === 0} />
            ))}
          </ul>
          {result.destinations.length > 40 && (
            <p className="px-1 text-sm text-muted-foreground">Showing the 40 best of {result.destinations.length}. Narrow the filters to see others.</p>
          )}
        </section>
      ) : null}

      <ReportSeatForm
        origin={q.origins[0] ?? ""}
        cabin={q.cabins[0]}
        programs={Object.entries(SOURCE_PROGRAM)
          .map(([source, p]) => ({ source, name: p.name }))
          .sort((a, b) => a.name.localeCompare(b.name))}
        minDate={new Date().toISOString().slice(0, 10)}
      />

      <AboutPrices />
    </div>
  );
}

