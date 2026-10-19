"use client";

import { Plus, X } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { AirportField } from "@/features/places/airport-field";
import { DestinationField } from "./destination-field";

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
  /** "any", "drive" or "fly" */
  go?: string;
  /** Destination airport for "what will this trip cost?", or "" for anywhere */
  to?: string;
  /** "group": the budget is for everyone; "person": it's per traveler */
  per?: string;
  /** Trip vibes picked ("water", "outdoors"…) */
  vibes?: string[];
};

const field = "h-11 w-full rounded-lg border bg-background px-3 text-base tabular-nums focus-visible:outline-2 focus-visible:outline-ring";
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
  keep,
  action,
  vibeOptions = [],
}: {
  vibeOptions?: Option[];
  initial: PlannerInitial;
  pointKeys: PointKey[];
  months: Option[];
  regions: Option[];
  styles: (Option & { hint: string })[];
  /** Carried through the search: the trip and its airport */
  keep?: { to?: string; trip?: string };
  /** Where the form submits: Explore, or the trip's own points page */
  action?: string;
}) {
  const id = useId();
  const [home, setHome] = useState(initial.home);
  const [to, setTo] = useState(initial.to ?? "");
  const [vibes, setVibes] = useState<string[]>(initial.vibes ?? []);
  const [rows, setRows] = useState(initial.points.length ? initial.points : [{ key: "chase", amount: "" }]);
  const pts = rows
    .map((r) => ({ key: r.key, n: num(r.amount) }))
    .filter((r) => r.key && r.n > 0)
    .map((r) => `${r.key}:${r.n}`)
    .join(",");
  const groups = [...new Set(pointKeys.map((k) => k.group))];

  return (
    <form method="get" action={action ?? "/points"} className="grid gap-5">
      <input type="hidden" name="pts" value={pts} />
      <input type="hidden" name="vibe" value={vibes.join(",")} />
      {keep?.trip && <input type="hidden" name="trip" value={keep.trip} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid content-start gap-1.5 text-sm font-medium">
          <label htmlFor={`${id}-home`}>Starting from</label>
          <AirportField
            id={`${id}-home`}
            name="from"
            value={home}
            onValueChange={setHome}
            placeholder="Your city or airport"
            describedBy={`${id}-home-hint`}
          />
          <span id={`${id}-home-hint`} className="text-xs font-normal text-muted-foreground">
            Any town works. Flights and road trips start from its nearest airport.
          </span>
        </div>
        <div className="grid content-start gap-1.5 text-sm font-medium">
          <label htmlFor={`${id}-to`}>Going to</label>
          <DestinationField
            id={`${id}-to`}
            name="to"
            value={to}
            onValueChange={setTo}
            placeholder="Anywhere, or a town"
            describedBy={`${id}-to-hint`}
          />
          <span id={`${id}-to-hint`} className="text-xs font-normal text-muted-foreground">
            Leave blank to see where you can go. Name a town, lake or city to see what it costs to drive or fly.
          </span>
        </div>
        <fieldset className="grid content-start gap-1.5 text-sm font-medium">
          <legend className="mb-1.5">Budget (USD)</legend>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <input
              name="cash"
              inputMode="decimal"
              placeholder={to ? "Optional" : "$2,000"}
              aria-label="Budget in U.S. dollars"
              defaultValue={initial.cash}
              className={field}
              required={!to}
            />
            <select name="per" aria-label="Budget is" defaultValue={initial.per ?? "group"} className={`${field} w-auto`}>
              <option value="group">for everyone</option>
              <option value="person">per person</option>
            </select>
          </div>
        </fieldset>
        <label className="grid content-start gap-1.5 text-sm font-medium">
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
          <div
            key={i}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b pb-2 last:border-0 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:border-0 sm:pb-0"
          >
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRows([...rows, { key: nextKey(rows, pointKeys), amount: "" }])}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add points
          </Button>
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
          Getting there
          <select name="go" defaultValue={initial.go ?? "any"} className={field}>
            <option value="any">Fly or drive</option>
            <option value="drive">Road trip</option>
            <option value="fly">Fly</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Region
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
      {vibeOptions.length > 0 && (
        <fieldset className="grid gap-2">
          <legend className="mb-1.5 text-sm font-medium">
            Trip vibe <span className="font-normal text-muted-foreground">(pick any, or none for everything)</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {vibeOptions.map((v) => {
              const on = vibes.includes(v.value);
              return (
                <button
                  key={v.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setVibes(on ? vibes.filter((x) => x !== v.value) : [...vibes, v.value])}
                  className={`tap rounded-full border px-3.5 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
                    on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                  }`}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      <input type="hidden" name="sort" value={initial.sort} />
      <div>
        <Button type="submit" size="lg">
          {to ? "What will this trip cost?" : "Show me where I can go"}
        </Button>
      </div>
    </form>
  );
}

const nextKey = (rows: { key: string }[], keys: PointKey[]) =>
  keys.find((k) => !rows.some((r) => r.key === k.value))?.value ?? keys[0].value;
