import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import type { CashFare } from "@/features/awards/cash-fares";
import { type Network, routeAwareChartPrices } from "@/features/awards/charts";
import { directionsFor, monthOptions, priceAgainstFares, type DestinationResult, type Option } from "@/features/awards/engine";
import { ExplorerFilters } from "@/features/awards/explorer-filters";
import { PointsOrCash } from "@/features/awards/points-or-cash";
import { AboutPrices, DestinationRow } from "@/features/awards/explorer-results";
import { estimateFees, fxFrom } from "@/features/awards/fees";
import { CABINS, REGIONS, SOURCE_PROGRAM } from "@/features/awards/regions";
import { BANKS } from "@/features/awards/transfers";
import { airportByCode } from "@/features/places/airports";

/**
 * Development-only: Points or cash with sample fares, run through the real
 * chart and valuation code, for design and accessibility review. 404 in production.
 */
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
  const date = "2026-11-10";
  // Sample fares (dev only) and a sample Delta route network out of DTW.
  const sample: [string, number][] = [["ORD", 129], ["LGA", 189], ["ATL", 159], ["LAX", 289], ["MSP", 99], ["LHR", 612]];
  const fares: CashFare[] = sample.map(([d, price]) => ({ origin: "DTW", destination: d, date, price, airline: "DL", flight: "DL1", stops: 0, durationMin: null }));
  const network: Network = { known: new Set(["DTW"]), edges: [...sample.map(([d]) => ({ origin: "DTW", destination: d, airline: "Delta Air Lines", seasonal: false })), { origin: "DTW", destination: "LHR", airline: "Virgin Atlantic", seasonal: false }] };

  const options: Option[] = [];
  for (const [dest, price] of sample) {
    const o = airportByCode("DTW")!;
    const d = airportByCode(dest)!;
    for (const c of routeAwareChartPrices(network, "DTW", dest, "economy", date)) {
      const estimate = estimateFees({ origin: o, destination: d, cabin: "economy", source: c.source, airlines: c.airlines ?? [], fx });
      options.push({
        key: `DTW|${dest}|economy|${c.id}`,
        origin: "DTW",
        destination: dest,
        cabin: "economy",
        source: c.source,
        program: c.label ? `${c.program} ${c.label}` : c.program,
        points: c.points,
        pointsHigh: c.pointsHigh,
        kind: "chart",
        days: [],
        chart: c,
        cash: { low: estimate.low, high: estimate.high, reported: false, estimate },
        directions: directionsFor({ source: c.source, points: c.pointsHigh ?? c.points, origin: "DTW", destination: dest, cabin: "economy", date, airlines: c.airlines, wallet, banks: [] }),
      });
    }
    const noFees = { low: 0, high: 0, lines: [], surcharge: { level: "none" as const, text: "Taxes are included in the points price." }, plusSurcharges: false };
    options.push({
      key: `DTW|${dest}|economy|portal`,
      origin: "DTW",
      destination: dest,
      cabin: "economy",
      source: "portal",
      program: "Card points, any seat",
      points: price * 100,
      kind: "portal",
      days: [],
      fares: fares.filter((f) => f.destination === dest),
      cash: { low: 0, high: 0, reported: false, estimate: noFees },
      directions: { steps: [`Search Chase Travel for DTW to ${dest} and pay with ${(price * 100).toLocaleString("en-US")} points.`], covered: true, shortBy: null },
    });
  }
  const fareRoute = priceAgainstFares(options, fares, date);
  const results: DestinationResult[] = sample
    .map(([dest]) => ({
      destination: dest,
      city: airportByCode(dest)!.city,
      options: options.filter((x) => x.destination === dest).sort((a, b) => a.trueCost! - b.trueCost!),
      fare: fareRoute.get(`DTW|${dest}`) ?? null,
    }))
    .sort((a, b) => a.options[0].trueCost! - b.options[0].trueCost!);
  const months = monthOptions();
  return (
    <main className="mx-auto grid max-w-5xl gap-6 p-6">
      <h1 className="text-4xl font-semibold">Points or cash</h1>
      <PointsOrCash
        programs={Object.entries(SOURCE_PROGRAM).map(([value, p]) => ({ value, label: p.name }))}
        held={{ chase: 80000 }}
        initial={{ cash: "129", points: "7500", taxes: "6", program: "virginatlantic" }}
      />
      <ExplorerFilters
        initial={{ from: "DTW", to: ["north_america"], codes: "", dateMode: "dates", months: [months[1].value], start: date, end: date, cabins: ["economy"], banks: [], programs: [], mine: false, direct: false, sort: "value" }}
        regions={Object.entries(REGIONS).map(([value, r]) => ({ value, label: r.label }))}
        monthOptions={months}
        cabins={Object.entries(CABINS).map(([value, c]) => ({ value, label: c.label }))}
        banks={BANKS.map((b) => ({ value: b.key, label: b.short }))}
        programs={Object.entries(SOURCE_PROGRAM).map(([value, p]) => ({ value, label: p.name }))}
        hasWallet
      />
      <ul className="grid gap-2">
        {results.map((d, i) => (
          <DestinationRow key={d.destination} d={d} date={date} defaultOpen={i === 0} />
        ))}
      </ul>
      <AboutPrices />
    </main>
  );
}
