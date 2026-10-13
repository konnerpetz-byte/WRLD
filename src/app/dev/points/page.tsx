import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ReportSeatForm } from "@/features/awards/report-seat-form";
import { chartPrices } from "@/features/awards/charts";
import { directionsFor, monthOptions, type DestinationResult, type Option } from "@/features/awards/engine";
import { ExplorerFilters } from "@/features/awards/explorer-filters";
import { AboutPrices, DestinationRow } from "@/features/awards/explorer-results";
import { estimateFees, fxFrom } from "@/features/awards/fees";
import { CABINS, REGIONS, SOURCE_PROGRAM } from "@/features/awards/regions";
import { BANKS } from "@/features/awards/transfers";
import { airportByCode } from "@/features/places/airports";

/** Development-only: the Points explorer with sample results, for design and accessibility review. 404 in production. */
export default function PointsPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense>
      <Preview />
    </Suspense>
  );
}

async function Preview() {
  await connection();
  const fx = fxFrom(new Map([["EUR", 0.894], ["GBP", 0.755], ["CAD", 1.424]]));
  const wallet = { balances: new Map([["chase_ultimate_rewards", 80000]]) };
  const option = (dest: string, source: string, kind: "seats" | "chart", extra: Partial<Option> = {}): Option => {
    const o = airportByCode("DTW")!;
    const d = airportByCode(dest)!;
    const chart = chartPrices("DTW", dest, "business").find((c) => c.source === source);
    const points = extra.points ?? chart?.points ?? 70000;
    const estimate = estimateFees({ origin: o, destination: d, cabin: "business", source, airlines: ["Lufthansa"], fx });
    return {
      key: `DTW|${dest}|business|${source}`,
      origin: "DTW",
      destination: dest,
      cabin: "business",
      source,
      program: SOURCE_PROGRAM[source].name,
      points,
      kind,
      days: [],
      chart: kind === "chart" ? { ...chart!, basis: "route", via: null, airlines: ["Lufthansa"] } : undefined,
      cash: { low: estimate.low, high: estimate.high, reported: false, estimate },
      directions: directionsFor({ source, points, origin: "DTW", destination: dest, cabin: "business", date: "2027-05-16", airlines: ["Lufthansa"], wallet, banks: [] }),
      ...extra,
    };
  };
  const seen = "2026-10-13T12:00:00Z"; // fixed sample time
  const results: DestinationResult[] = [
    {
      destination: "MUC",
      city: "Munich",
      options: [
        option("MUC", "aeroplan", "seats", {
          points: 75000,
          days: [
            { date: "2027-05-16", miles: 75000, taxes: 56, taxCurrency: "USD", seenAt: seen, id: 1, reported: true },
            { date: "2027-05-19", miles: 90000, taxes: 56, taxCurrency: "USD", seenAt: seen, id: 2, reported: true },
          ],
        }),
        option("MUC", "american", "chart"),
      ],
    },
    { destination: "LHR", city: "London", options: [option("LHR", "virginatlantic", "seats", { points: 47500, days: [{ date: "2027-05-18", miles: 47500, taxes: 520, taxCurrency: "USD", seenAt: seen, id: 3, reported: true }] }), option("LHR", "aeroplan", "chart")] },
  ];
  results[1].options[0].cash = { ...results[1].options[0].cash, low: 520, high: 520, reported: true };
  const months = monthOptions();
  return (
    <main className="mx-auto grid max-w-5xl gap-6 p-6">
      <h1 className="text-4xl font-semibold">Points or cash</h1>
      <ExplorerFilters
        initial={{ from: "DTW", to: ["europe"], codes: "", dateMode: "months", months: [months[1].value], start: "", end: "", cabins: ["business"], banks: [], programs: [], mine: false, direct: false, sort: "points" }}
        regions={Object.entries(REGIONS).map(([value, r]) => ({ value, label: r.label }))}
        monthOptions={months}
        cabins={Object.entries(CABINS).map(([value, c]) => ({ value, label: c.label }))}
        banks={BANKS.map((b) => ({ value: b.key, label: b.short }))}
        programs={Object.entries(SOURCE_PROGRAM).map(([value, p]) => ({ value, label: p.name }))}
        hasWallet
      />
      <ul className="grid gap-2">
        {results.map((d, i) => (
          <DestinationRow key={d.destination} d={d} date="2027-05-16" defaultOpen={i === 0} />
        ))}
      </ul>
      <ReportSeatForm origin="DTW" cabin="business" programs={[{ source: "aeroplan", name: "Air Canada Aeroplan" }]} minDate="2026-10-13" />
      <AboutPrices />
    </main>
  );
}
