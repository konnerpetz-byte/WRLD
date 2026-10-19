"use client";

import { ChevronDown, Plus, X } from "lucide-react";
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

  const pointsSet = rows.some((r) => num(r.amount) > 0);
  const pointsLabel = pointsSet
    ? rows
        .filter((r) => num(r.amount) > 0)
        .map((r) => `${num(r.amount).toLocaleString("en-US")} ${pointKeys.find((k) => k.value === r.key)?.label ?? r.key}`)
        .join(", ")
    : "None added";
  const label = "text-sm font-medium";
  const hint = "text-xs font-normal text-muted-foreground";

  return (
    <form method="get" action={action ?? "/points"} className="grid min-w-0 gap-6">
      <input type="hidden" name="pts" value={pts} />
      <input type="hidden" name="vibe" value={vibes.join(",")} />
      {keep?.trip && <input type="hidden" name="trip" value={keep.trip} />}

      {/* Where */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid content-start gap-1.5">
          <label htmlFor={`${id}-home`} className={label}>
            Starting from
          </label>
          <AirportField id={`${id}-home`} name="from" value={home} onValueChange={setHome} placeholder="Your town or airport" describedBy={`${id}-home-hint`} />
          <span id={`${id}-home-hint`} className={hint}>
            Any town works; trips start from its nearest airport.
          </span>
        </div>
        <div className="grid content-start gap-1.5">
          <label htmlFor={`${id}-to`} className={label}>
            Going to
          </label>
          <DestinationField id={`${id}-to`} name="to" value={to} onValueChange={setTo} placeholder="Anywhere" describedBy={`${id}-to-hint`} />
          <span id={`${id}-to-hint`} className={hint}>
            Leave blank to see what fits, or name a town to price it.
          </span>
        </div>
      </div>

      {/* How much, when, who */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid content-start gap-1.5 sm:col-span-2">
          <label htmlFor={`${id}-cash`} className={label}>
            Budget
          </label>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <input
              id={`${id}-cash`}
              name="cash"
              inputMode="decimal"
              placeholder={to ? "Optional" : "$2,000"}
              defaultValue={initial.cash}
              className={field}
              required={!to}
            />
            <Segmented name="per" label="Budget is" value={initial.per ?? "group"} options={[{ value: "group", label: "Total" }, { value: "person", label: "Per person" }]} />
          </div>
        </div>
        <label className="grid content-start gap-1.5">
          <span className={label}>When</span>
          <select name="month" defaultValue={initial.month} className={field}>
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid content-start gap-1.5">
            <span className={label}>Nights</span>
            <input name="nights" type="number" inputMode="numeric" min={1} max={30} defaultValue={initial.nights} className={field} />
          </label>
          <label className="grid content-start gap-1.5">
            <span className={label}>People</span>
            <input name="travelers" type="number" inputMode="numeric" min={1} max={8} defaultValue={initial.travelers} className={field} />
          </label>
        </div>
      </div>

      <div className="grid gap-1.5">
        <span id={`${id}-go`} className={label}>
          Getting there
        </span>
        <Segmented
          name="go"
          labelledBy={`${id}-go`}
          value={initial.go ?? "any"}
          options={[
            { value: "any", label: "Fly or drive" },
            { value: "drive", label: "Drive" },
            { value: "fly", label: "Fly" },
          ]}
          wide
        />
      </div>

      {vibeOptions.length > 0 && (
        <fieldset className="grid min-w-0 gap-2">
          <legend className={`mb-1.5 ${label}`}>
            Trip vibe <span className="font-normal text-muted-foreground">(optional)</span>
          </legend>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
            {vibeOptions.map((v) => {
              const on = vibes.includes(v.value);
              return (
                <button
                  key={v.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setVibes(on ? vibes.filter((x) => x !== v.value) : [...vibes, v.value])}
                  className={`tap shrink-0 rounded-full border px-3.5 py-2 text-sm transition-[background-color,transform] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-ring ${
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

      {/* Less common: points, travel style, region */}
      <details className="group min-w-0 rounded-xl border" open={pointsSet || undefined}>
        <summary className="tap flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            <span className={`block ${label}`}>Points, travel style and region</span>
            <span className={`block truncate ${hint}`}>
              {pointsLabel} · {styles.find((x) => x.value === initial.style)?.label ?? "Mid-range"} ·{" "}
              {initial.region === "anywhere" ? "Anywhere" : (regions.find((r) => r.value === initial.region)?.label ?? "Anywhere")}
            </span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
        </summary>
        <div className="grid gap-5 border-t px-4 py-4">
          <fieldset className="grid min-w-0 gap-2">
            <legend className={`mb-1.5 ${label}`}>Credit card points and miles</legend>
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
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
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className={label}>Travel style</span>
              <select name="style" defaultValue={initial.style} className={field}>
                {styles.map((x) => (
                  <option key={x.value} value={x.value}>
                    {x.label}: {x.hint}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className={label}>Region (when going anywhere)</span>
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
        </div>
      </details>

      <input type="hidden" name="sort" value={initial.sort} />
      <Button type="submit" size="lg" className="h-12 w-full rounded-xl text-base transition-transform active:scale-[0.98] sm:w-auto sm:justify-self-start sm:px-8">
        {to ? "Price this trip" : "Show me where I can go"}
      </Button>
    </form>
  );
}

/** iOS-style segmented control: radio buttons, one row, one choice. */
function Segmented({
  name,
  value,
  options,
  label,
  labelledBy,
  wide = false,
}: {
  name: string;
  value: string;
  options: { value: string; label: string }[];
  label?: string;
  labelledBy?: string;
  wide?: boolean;
}) {
  const [current, setCurrent] = useState(value);
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-labelledby={labelledBy}
      className={`grid h-11 gap-1 rounded-lg bg-muted p-1 ${wide ? "w-full" : "w-auto"}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <label
          key={o.value}
          className={`relative flex cursor-pointer items-center justify-center rounded-md px-3 text-sm font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring ${
            current === o.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <input type="radio" name={name} value={o.value} checked={current === o.value} onChange={() => setCurrent(o.value)} className="sr-only" />
          <span className="whitespace-nowrap">{o.label}</span>
        </label>
      ))}
    </div>
  );
}

const nextKey = (rows: { key: string }[], keys: PointKey[]) =>
  keys.find((k) => !rows.some((r) => r.key === k.value))?.value ?? keys[0].value;
