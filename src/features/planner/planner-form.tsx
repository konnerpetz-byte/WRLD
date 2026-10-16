"use client";

import { Plus, X } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { AirportField } from "@/features/places/airport-field";

type Option = { value: string; label: string };
type PointKey = Option & { group: string };

export type PlannerInitial = {
  home: string;
  cash: string;
  points: { key: string; amount: string }[];
  nights: string;
  travelers: string;
  style: string;
  month: string;
  region: string;
  sort: string;
};

const field =
  "h-11 w-full rounded-lg border bg-background px-3 text-base tabular-nums focus-visible:outline-2 focus-visible:outline-ring";
const num = (s: string) => Math.round(Number(s.replace(/[^0-9.]/g, "")));

/**
 * The trip planner's question: from here, with this much cash and these
 * points, where can I go? Submits to the page's URL so results are shareable.
 */
export function PlannerForm({
  initial,
  pointKeys,
  months,
  regions,
  styles,
}: {
  initial: PlannerInitial;
  pointKeys: PointKey[];
  months: Option[];
  regions: Option[];
  styles: (Option & { hint: string })[];
}) {
  const id = useId();
  const [home, setHome] = useState(initial.home);
  const [rows, setRows] = useState(initial.points.length ? initial.points : [{ key: "chase", amount: "" }]);
  const pts = rows
    .map((r) => ({ key: r.key, n: num(r.amount) }))
    .filter((r) => r.key && r.n > 0)
    .map((r) => `${r.key}:${r.n}`)
    .join(",");
  const groups = [...new Set(pointKeys.map((k) => k.group))];

  return (
    <form method="get" action="/points" className="grid gap-5">
      <input type="hidden" name="pts" value={pts} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5 text-sm font-medium">
          <label htmlFor={`${id}-home`}>Flying from</label>
          <AirportField id={`${id}-home`} name="from" value={home} onValueChange={setHome} placeholder="DTW or Detroit" />
        </div>
        <label className="grid gap-1.5 text-sm font-medium">
          Cash to spend (USD)
          <input name="cash" inputMode="decimal" placeholder="$2,000" defaultValue={initial.cash} className={field} required />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          When
          <select name="month" defaultValue={initial.month} className={field}>
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-1.5 text-sm font-medium">Your points</legend>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b pb-2 last:border-0 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:border-0 sm:pb-0">
            <select
              aria-label={`Program ${i + 1}`}
              value={r.key}
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))}
              className={`${field} col-span-2 sm:col-span-1`}
            >
              {groups.map((g) => (
                <optgroup key={g} label={g}>
                  {pointKeys
                    .filter((k) => k.group === g)
                    .map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.label}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            <input
              aria-label={`Points in program ${i + 1}`}
              inputMode="numeric"
              placeholder="60,000"
              value={r.amount}
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
              className={field}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove program ${i + 1}`}
              onClick={() => setRows(rows.length > 1 ? rows.filter((_, j) => j !== i) : [{ key: "chase", amount: "" }])}
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>
        ))}
        <div>
          <Button type="button" variant="outline" size="sm" onClick={() => setRows([...rows, { key: nextKey(rows, pointKeys), amount: "" }])}>
            <Plus className="size-4" aria-hidden="true" />
            Add points
          </Button>
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1.5 text-sm font-medium">
          Nights
          <input name="nights" type="number" min={1} max={30} defaultValue={initial.nights} className={field} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Travelers
          <input name="travelers" type="number" min={1} max={8} defaultValue={initial.travelers} className={field} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Travel style
          <select name="style" defaultValue={initial.style} className={field}>
            {styles.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}: {s.hint}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Where
          <select name="region" defaultValue={initial.region} className={field}>
            <option value="anywhere">Anywhere</option>
            {regions.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <input type="hidden" name="sort" value={initial.sort} />
      <div>
        <Button type="submit" size="lg">
          Show me where I can go
        </Button>
      </div>
    </form>
  );
}

const nextKey = (rows: { key: string }[], keys: PointKey[]) => keys.find((k) => !rows.some((r) => r.key === k.value))?.value ?? keys[0].value;
