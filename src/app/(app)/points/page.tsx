import { Check, ExternalLink, Plane } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/layout/page-skeleton";
import { Button } from "@/components/ui/button";
import { AIRPORT_CITY, CABINS, type Cabin, REGIONS, type RegionKey, SOURCE_PROGRAM } from "@/features/awards/regions";
import { type AwardResult, programFor, searchAwards } from "@/features/awards/search";
import { formatPoints } from "@/lib/format";
import { requireUserId } from "@/lib/supabase/server";

export const metadata = { title: "Points explorer" };

type Params = { from?: string; to?: string; month?: string; cabin?: string; direct?: string; via?: string };

export default function FlightsPage({ searchParams }: PageProps<"/points">) {
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

async function FlightsContent({ searchParams }: { searchParams: PageProps<"/points">["searchParams"] }) {
  const { supabase, userId } = await requireUserId();
  const sp = (await searchParams) as Params;

  const [{ data: profile }, { data: reach }, { data: programs }, { data: partners }] = await Promise.all([
    supabase.from("profiles").select("home_airport").eq("id", userId).maybeSingle(),
    supabase.from("wallet_reachable_points").select("target_program_id, via_program_id, route, points").eq("user_id", userId),
    supabase.from("loyalty_programs").select("id, slug, name, kind"),
    supabase.from("transfer_partners").select("from_program_id, to_program_id, ratio_from, ratio_to"),
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

  // "Explore by": everything, what your wallet can reach, one bank's transfer partners, or one program.
  const sourceBySlug = new Map(Object.entries(SOURCE_PROGRAM).filter(([, p]) => p.slug).map(([source, p]) => [p.slug!, source]));
  const banks = (programs ?? []).filter((p) => p.kind === "bank");
  const bankPartners = (bankId: string) =>
    (partners ?? [])
      .filter((t) => t.from_program_id === bankId)
      .map((t) => ({ slug: nameById.get(t.to_program_id)?.slug ?? "", ratio: `${t.ratio_from}:${t.ratio_to}` }))
      .filter((t) => sourceBySlug.has(t.slug));
  const via = sp.via ?? "";
  let sources: string[] = [];
  let viaNote: string | null = null;
  if (via === "mine") {
    sources = [...reachBySlug.keys()].map((slug) => sourceBySlug.get(slug)).filter((x): x is string => Boolean(x));
    viaNote = sources.length
      ? `Only programs your points can reach: ${sources.map((src) => programFor(src).name).join(", ")}.`
      : "Add balances on the My points tab to filter by what you can book.";
  } else if (via.startsWith("bank:")) {
    const bank = banks.find((b) => b.slug === via.slice(5));
    if (bank) {
      const list = bankPartners(bank.id);
      sources = list.map((t) => sourceBySlug.get(t.slug)!);
      viaNote = `Seats you can book by moving ${bank.name} to: ${list.map((t) => `${programFor(sourceBySlug.get(t.slug)!).name}${t.ratio === "1:1" ? "" : ` (${t.ratio})`}`).join(", ")}.`;
    }
  } else if (via.startsWith("program:") && SOURCE_PROGRAM[via.slice(8)]) {
    sources = [via.slice(8)];
  }
  const filterEmpty = (via === "mine" || via.startsWith("bank:")) && !sources.length;

  const ready = IATA.test(from) && destinations.length > 0 && !filterEmpty;
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const search = ready
    ? await searchAwards({ origin: from, destinations, start: start < today ? today : start, end, cabin, directOnly, sources })
    : null;

  // Group by destination: cheapest first.
  const byDest = new Map<string, AwardResult[]>();
  for (const r of search?.results ?? []) byDest.set(r.destination, [...(byDest.get(r.destination) ?? []), r]);
  const groups = [...byDest.entries()]
    .map(([dest, rs]) => ({ dest, results: rs.sort((a, b) => a.miles - b.miles || a.date.localeCompare(b.date)) }))
    .sort((a, b) => a.results[0].miles - b.results[0].miles);

  return (
    <div className="grid gap-8">
      <p className="text-muted-foreground">
        Where your miles and card points can take you from {home ? <strong>{home}</strong> : "your home airport"}: the cheapest award seats by destination and date.
      </p>

      {!home && (
        <p className="rounded-xl border border-dashed bg-card p-4 text-sm">
          Set your home airport in{" "}
          <Link href="/account" className="font-medium text-primary underline underline-offset-2">
            Account
          </Link>{" "}
          so this page starts from it every time.
        </p>
      )}

      <form className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[6rem_1fr_1fr_1fr_1.3fr_auto] lg:items-end" action="/points">
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
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Explore by</span>
          <select name="via" defaultValue={via} className="h-9 rounded-md border bg-background px-2">
            <option value="">All programs</option>
            <option value="mine">Programs my points can reach</option>
            <optgroup label="Credit card points">
              {banks.map((b) => (
                <option key={b.slug} value={`bank:${b.slug}`}>
                  {b.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Airline programs">
              {Object.entries(SOURCE_PROGRAM)
                .sort((a, b) => a[1].name.localeCompare(b[1].name))
                .map(([source, p]) => (
                  <option key={source} value={`program:${source}`}>
                    {p.name}
                  </option>
                ))}
            </optgroup>
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

      {viaNote && <p className="text-sm text-muted-foreground">{viaNote}</p>}

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
