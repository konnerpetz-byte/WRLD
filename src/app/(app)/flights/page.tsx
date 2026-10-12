import { Check, ExternalLink, Plane } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/layout/page-skeleton";
import { Button } from "@/components/ui/button";
import { AIRPORT_CITY, CABINS, type Cabin, REGIONS, type RegionKey } from "@/features/awards/regions";
import { type AwardResult, programFor, searchAwards } from "@/features/awards/search";
import { formatPoints } from "@/lib/format";
import { requireUserId } from "@/lib/supabase/server";

export const metadata = { title: "Points flights" };

type Params = { from?: string; to?: string; month?: string; cabin?: string; direct?: string };

export default function FlightsPage({ searchParams }: PageProps<"/flights">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <FlightsContent searchParams={searchParams} />
    </Suspense>
  );
}

const IATA = /^[A-Z]{3}$/;

function monthOptions() {
  const now = new Date();
  return Array.from({ length: 11 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    return {
      value: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
    };
  });
}

async function FlightsContent({ searchParams }: { searchParams: PageProps<"/flights">["searchParams"] }) {
  const { supabase, userId } = await requireUserId();
  const sp = (await searchParams) as Params;

  const [{ data: profile }, { data: reach }, { data: programs }] = await Promise.all([
    supabase.from("profiles").select("home_airport").eq("id", userId).maybeSingle(),
    supabase.from("wallet_reachable_points").select("target_program_id, via_program_id, route, points").eq("user_id", userId),
    supabase.from("loyalty_programs").select("id, slug, name"),
  ]);

  const home = profile?.home_airport?.toUpperCase() ?? null;
  const from = (sp.from ?? home ?? "").toUpperCase();
  const to = sp.to ?? "europe";
  const months = monthOptions();
  const month = months.some((m) => m.value === sp.month) ? sp.month! : months[1].value;
  const cabin: Cabin = sp.cabin && sp.cabin in CABINS ? (sp.cabin as Cabin) : "business";
  const directOnly = sp.direct === "1";

  const destinations =
    to in REGIONS
      ? [...REGIONS[to as RegionKey].airports]
      : to
          .toUpperCase()
          .split(/[\s,]+/)
          .filter((c) => IATA.test(c))
          .slice(0, 20);

  // What the traveler's wallet can reach in each program (own balance + card transfers).
  const nameById = new Map((programs ?? []).map((p) => [p.id, p]));
  const reachBySlug = new Map<string, { total: number; ways: string[] }>();
  for (const r of reach ?? []) {
    const target = nameById.get(r.target_program_id);
    if (!target || !r.points) continue;
    const entry = reachBySlug.get(target.slug) ?? { total: 0, ways: [] };
    entry.total += Number(r.points);
    entry.ways.push(r.route === "direct" ? `${formatPoints(r.points)} in ${target.name}` : `${formatPoints(r.points)} from ${nameById.get(r.via_program_id)?.name ?? "a card"}`);
    reachBySlug.set(target.slug, entry);
  }

  const ready = IATA.test(from) && destinations.length > 0;
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const search = ready
    ? await searchAwards({ origin: from, destinations, start: start < today ? today : start, end, cabin, directOnly })
    : null;

  // Group by destination: cheapest first.
  const byDest = new Map<string, AwardResult[]>();
  for (const r of search?.results ?? []) byDest.set(r.destination, [...(byDest.get(r.destination) ?? []), r]);
  const groups = [...byDest.entries()]
    .map(([dest, rs]) => ({ dest, results: rs.sort((a, b) => a.miles - b.miles || a.date.localeCompare(b.date)) }))
    .sort((a, b) => a.results[0].miles - b.results[0].miles);

  return (
    <div className="mx-auto grid max-w-5xl gap-8">
      <header>
        <h1 className="text-4xl font-semibold">Points flights</h1>
        <p className="mt-1 text-muted-foreground">
          Where your miles and card points can take you from {home ? <strong>{home}</strong> : "your home airport"}: the cheapest award seats by destination and date.
        </p>
      </header>

      {!home && (
        <p className="rounded-xl border border-dashed bg-card p-4 text-sm">
          Set your home airport in{" "}
          <Link href="/account" className="font-medium text-primary underline underline-offset-2">
            Account
          </Link>{" "}
          so this page starts from it every time.
        </p>
      )}

      <form className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[7rem_1fr_1fr_1fr_auto] lg:items-end" action="/flights">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">From</span>
          <input name="from" defaultValue={from} placeholder="DTW" maxLength={3} required pattern="[A-Za-z]{3}" className="h-9 rounded-md border bg-background px-3 uppercase" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">To</span>
          <select name="to" defaultValue={to in REGIONS ? to : "europe"} className="h-9 rounded-md border bg-background px-2">
            {Object.entries(REGIONS).map(([key, r]) => (
              <option key={key} value={key}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Month</span>
          <select name="month" defaultValue={month} className="h-9 rounded-md border bg-background px-2">
            {months.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Cabin</span>
          <select name="cabin" defaultValue={cabin} className="h-9 rounded-md border bg-background px-2">
            {Object.entries(CABINS).map(([key, c]) => (
              <option key={key} value={key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-1">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="direct" value="1" defaultChecked={directOnly} className="size-4" /> Nonstop
          </label>
          <Button type="submit">
            <Plane aria-hidden="true" /> Search
          </Button>
        </div>
      </form>

      {search?.mode === "off" && (
        <p className="rounded-xl border border-dashed bg-card p-6 text-sm">
          Award search isn&apos;t connected yet. It turns on once WRLD has a Seats.aero partner key.
        </p>
      )}
      {search?.mode === "sample" && (
        <p className="rounded-lg bg-travel/15 px-4 py-2 text-sm" role="note">
          <strong>Sample results.</strong> These seats and prices are made up so you can try the explorer. Real availability appears once
          Seats.aero access is approved.
        </p>
      )}
      {search?.error && (
        <p role="alert" className="text-sm text-destructive">
          {search.error}
        </p>
      )}

      {search && search.mode !== "off" && (
        <section aria-labelledby="results-h" className="grid gap-4">
          <h2 id="results-h" className="text-xl font-semibold">
            {groups.length
              ? `${groups.length} destinations with ${CABINS[cabin].label.toLowerCase()} seats from ${from}`
              : `No ${CABINS[cabin].label.toLowerCase()} award seats found from ${from} that month`}
          </h2>
          <ul className="grid gap-4 md:grid-cols-2">
            {groups.map(({ dest, results }) => {
              const best = results[0];
              const program = programFor(best.source);
              const wallet = program.slug ? reachBySlug.get(program.slug) : undefined;
              const canBook = wallet && wallet.total >= best.miles;
              const dates = [...new Map(results.map((r) => [r.date, r])).values()].sort((a, b) => a.date.localeCompare(b.date));
              return (
                <li key={dest} className="grid gap-3 rounded-2xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">
                        {AIRPORT_CITY[dest] ?? dest} <span className="text-sm font-normal text-muted-foreground">{dest}</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {results.length} seat{results.length === 1 ? "" : "s"} on {dates.length} day{dates.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">from</p>
                      <p className="font-display text-2xl font-semibold tabular-nums">{formatPoints(best.miles)}</p>
                      <p className="text-xs text-muted-foreground">miles, one way</p>
                    </div>
                  </div>

                  <p className="text-sm">
                    Cheapest with <strong>{program.name}</strong> on{" "}
                    {new Date(`${best.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}
                    {best.airlines ? `, flying ${best.airlines}` : ""}
                    {best.direct ? ", nonstop" : ""}.
                  </p>

                  {canBook ? (
                    <p className="flex items-start gap-2 rounded-lg bg-open-soft px-3 py-2 text-sm text-primary">
                      <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <span>
                        <strong>Your points can book this.</strong> {wallet!.ways.join(" · ")}
                      </span>
                    </p>
                  ) : wallet ? (
                    <p className="text-sm text-muted-foreground">
                      You can reach {formatPoints(wallet.total)} {program.name} miles; {formatPoints(best.miles - wallet.total)} short.
                    </p>
                  ) : null}

                  <ul className="flex flex-wrap gap-1.5" aria-label="Days with seats">
                    {dates.slice(0, 12).map((r) => (
                      <li key={r.date} className="rounded-md border px-2 py-1 text-xs tabular-nums">
                        {new Date(`${r.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                        <span className="ml-1 font-medium">{Math.round(r.miles / 1000)}k</span>
                      </li>
                    ))}
                    {dates.length > 12 && <li className="px-1 py-1 text-xs text-muted-foreground">+{dates.length - 12} more</li>}
                  </ul>

                  {program.url && (
                    <a
                      href={program.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary underline underline-offset-2"
                    >
                      Book with {program.name} <ExternalLink className="size-3.5" aria-hidden="true" />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">
            Award seats change by the minute and taxes are extra. Confirm on the airline&apos;s site before moving points: transfers usually can&apos;t be undone.
            Card transfer ratios last checked September 2026.
          </p>
        </section>
      )}
    </div>
  );
}
