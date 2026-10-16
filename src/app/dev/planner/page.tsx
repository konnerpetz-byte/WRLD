import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import type { CashFare } from "@/features/awards/cash-fares";
import { monthOptions } from "@/features/awards/engine";
import { fxFrom } from "@/features/awards/fees";
import { REGIONS } from "@/features/awards/regions";
import { STYLES } from "@/features/planner/costs";
import { POINT_KEYS, priceTrips, sortOptions } from "@/features/planner/plan";
import { PlannerForm } from "@/features/planner/planner-form";
import { TripCard } from "@/features/planner/planner-results";

/**
 * Development-only: the trip planner with sample fares (DTW, $2,000, 60k Chase
 * and 20k Bilt), run through the real pricing code. 404 in production.
 */
export default function PlannerPreview() {
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
  const months = monthOptions();
  const month = months[1].value;
  const sample: [string, number][] = [["LHR", 412], ["CDG", 389], ["LIS", 345], ["CUN", 189], ["SJU", 159], ["HND", 690], ["MIA", 99], ["LAS", 119], ["BCN", 402], ["MEX", 210]];
  const fares: CashFare[] = sample.map(([d, price]) => ({ origin: "DTW", destination: d, date: `${month}-12`, price, airline: "DL", flight: "DL1", stops: 0, durationMin: null }));
  const input = { home: "DTW", cash: 2000, points: { chase: 60000, bilt: 20000 }, nights: 5, travelers: 1, style: "mid" as const, month, region: "anywhere" as const };
  const all = sortOptions(priceTrips(input, { known: new Set(), edges: [] }, fares, fx), "most");
  const shown = all.filter((t) => t.fit !== "over").slice(0, 8);
  const label = months[1].label;
  return (
    <main className="mx-auto grid max-w-5xl gap-6 p-6">
      <h1 className="text-4xl font-semibold">Plan with points</h1>
      <section className="grid gap-5 rounded-2xl border bg-card p-5 sm:p-6">
        <PlannerForm
          initial={{ home: "DTW", cash: "2000", points: [{ key: "chase", amount: "60,000" }, { key: "bilt", amount: "20,000" }], nights: "5", travelers: "1", style: "mid", month, region: "anywhere", sort: "most" }}
          pointKeys={POINT_KEYS}
          months={months}
          regions={Object.entries(REGIONS).map(([value, r]) => ({ value, label: r.label }))}
          styles={Object.entries(STYLES).map(([value, s]) => ({ value, label: s.label, hint: s.hint }))}
        />
      </section>
      <p className="text-sm text-muted-foreground">
        {all.filter((t) => t.fit === "fits").length} fit, {all.filter((t) => t.fit === "stretch").length} stretch, of {all.length}
      </p>
      <ul className="grid gap-3">
        {shown.map((t) => (
          <TripCard key={t.code} t={t} home="DTW" month={month} monthLabel={label} cash={2000} travelers={1} nights={5} />
        ))}
      </ul>
    </main>
  );
}
