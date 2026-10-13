"use client";

import { Loader2, SlidersHorizontal } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

type Opt = { value: string; label: string };

export type FilterState = {
  from: string;
  to: string[];
  codes: string;
  dateMode: "months" | "dates";
  months: string[];
  start: string;
  end: string;
  cabins: string[];
  banks: string[];
  programs: string[];
  mine: boolean;
  direct: boolean;
  sort: string;
};

function toParams(s: FilterState) {
  const p = new URLSearchParams();
  if (s.from.trim()) p.set("from", s.from.toUpperCase().replace(/\s+/g, ""));
  if (s.to.length) p.set("to", s.to.join(","));
  if (s.codes.trim()) p.set("codes", s.codes.toUpperCase().replace(/[^A-Z,]/g, ""));
  if (s.dateMode === "dates") {
    if (s.start) p.set("start", s.start);
    if (s.end) p.set("end", s.end);
  } else if (s.months.length) p.set("months", s.months.join(","));
  if (s.cabins.length) p.set("cabins", s.cabins.join(","));
  if (s.banks.length) p.set("banks", s.banks.join(","));
  if (s.programs.length) p.set("programs", s.programs.join(","));
  if (s.mine) p.set("mine", "1");
  if (s.direct) p.set("direct", "1");
  if (s.sort && s.sort !== "points") p.set("sort", s.sort);
  return p;
}

const codesOk = (v: string) => v.trim() === "" || /^([A-Za-z]{3})(\s*,\s*[A-Za-z]{3})*$/.test(v.trim());

function Chips({
  label,
  options,
  value,
  onChange,
  single,
  scroll,
}: {
  label: string;
  options: Opt[];
  value: string[];
  onChange: (v: string[]) => void;
  single?: boolean;
  /** One swipeable row on phones instead of several wrapped rows */
  scroll?: boolean;
}) {
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className={`flex gap-1.5 ${scroll ? "edge-fade-x -mx-4 overflow-x-auto px-4 pb-1 max-sm:snap-x sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&>*]:shrink-0 [&>*]:snap-start" : "flex-wrap"}`}>
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(single ? [o.value] : on ? value.filter((v) => v !== o.value) : [...value, o.value])}
              className={`min-h-9 rounded-full border px-3.5 text-sm transition-[color,background-color,border-color,transform] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-safe:active:scale-[0.96] ${
                on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary/60"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Explorer filters. Every change updates the results right away (no Search
 * button needed); typing waits until the airport codes are complete.
 */
export function ExplorerFilters({
  initial,
  regions,
  monthOptions,
  cabins,
  banks,
  programs,
  hasWallet,
}: {
  initial: FilterState;
  regions: Opt[];
  monthOptions: Opt[];
  cabins: Opt[];
  banks: Opt[];
  programs: Opt[];
  hasWallet: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [s, setS] = useState<FilterState>(initial);
  const [pending, start] = useTransition();
  const [morePrograms, setMorePrograms] = useState(initial.programs.length > 0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(true);
  // Taps apply at once; typing waits for a pause.
  const delay = useRef(0);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const fromOk = /^[A-Za-z]{3}(,[A-Za-z]{3}){0,2}$/.test(s.from.replace(/\s+/g, ""));
    if (!fromOk || !codesOk(s.codes)) return;
    if (s.dateMode === "dates" && (!s.start || !s.end)) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      start(() => router.replace(`${pathname}?${toParams(s).toString()}`, { scroll: false }));
    }, delay.current);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [s, router, pathname]);

  const set = <K extends keyof FilterState>(k: K, v: FilterState[K]) => {
    delay.current = k === "from" || k === "codes" ? 450 : 0;
    setS((prev) => ({ ...prev, [k]: v }));
  };
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form
      action="/points"
      onSubmit={(e) => {
        e.preventDefault();
        start(() => router.replace(`${pathname}?${toParams(s).toString()}`, { scroll: false }));
      }}
      className="grid gap-5 rounded-2xl border bg-card p-4 sm:p-5"
      aria-describedby="filters-status"
    >
      <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-start">
        <label className="grid content-start gap-1.5 text-sm">
          <span className="font-medium">From</span>
          <input
            name="from"
            value={s.from}
            onChange={(e) => set("from", e.target.value)}
            placeholder="DTW, ORD"
            autoComplete="off"
            className="h-10 rounded-md border bg-background px-3 uppercase"
            aria-describedby="from-help"
          />
          <span id="from-help" className="text-xs text-muted-foreground">
            Up to 3 airports, comma separated
          </span>
        </label>
        <div className="grid gap-2">
          <Chips
            label="To"
            options={[{ value: "anywhere", label: "Anywhere" }, ...regions]}
            value={s.to}
            onChange={(v) => {
              // "Anywhere" replaces the regions, and picking a region replaces "Anywhere".
              const added = v.find((x) => !s.to.includes(x));
              set("to", added === "anywhere" ? ["anywhere"] : v.filter((x) => x !== "anywhere"));
            }}
          />
          <label className="grid gap-1 text-sm sm:max-w-xs">
            <span className="text-xs text-muted-foreground">Or these airports</span>
            <input
              name="codes"
              value={s.codes}
              onChange={(e) => set("codes", e.target.value)}
              placeholder="LIS, NRT"
              autoComplete="off"
              className="h-9 rounded-md border bg-background px-3 uppercase"
            />
          </label>
        </div>
      </div>

      <div className="grid gap-2">
        <div role="tablist" aria-label="When" className="flex w-fit gap-1 rounded-lg bg-muted p-1 text-sm">
          {(
            [
              ["months", "Months"],
              ["dates", "Exact dates"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={s.dateMode === v}
              onClick={() => set("dateMode", v)}
              className={`rounded-md px-3 py-1.5 focus-visible:outline-2 focus-visible:outline-ring ${s.dateMode === v ? "bg-card font-medium shadow-sm" : "text-muted-foreground"}`}
            >
              {l}
            </button>
          ))}
        </div>
        {s.dateMode === "months" ? (
          <Chips scroll label="Travel months" options={monthOptions} value={s.months} onChange={(v) => set("months", v.length ? v : s.months)} />
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Earliest</span>
              <input type="date" min={today} value={s.start} onChange={(e) => set("start", e.target.value)} className="h-10 rounded-md border bg-background px-3" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Latest</span>
              <input type="date" min={s.start || today} value={s.end} onChange={(e) => set("end", e.target.value)} className="h-10 rounded-md border bg-background px-3" />
            </label>
          </div>
        )}
      </div>

      <Chips label="Cabin" options={cabins} value={s.cabins} onChange={(v) => set("cabins", v.length ? v : s.cabins)} />

      <div className="grid gap-3">
        <Chips label="Card points" options={banks} value={s.banks} onChange={(v) => set("banks", v)} />
        {hasWallet && (
          <label className="flex w-fit items-center gap-2 text-sm">
            <input type="checkbox" checked={s.mine} onChange={(e) => set("mine", e.target.checked)} className="size-4 accent-primary" />
            Only programs my points can reach
          </label>
        )}
        <div>
          <button
            type="button"
            aria-expanded={morePrograms}
            onClick={() => setMorePrograms((x) => !x)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            {morePrograms ? "Hide airline programs" : `Airline programs${s.programs.length ? ` (${s.programs.length})` : ""}`}
          </button>
          {morePrograms && (
            <div className="mt-3">
              <Chips label="Airline programs" options={programs} value={s.programs} onChange={(v) => set("programs", v)} />
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Pick none to see every program. Picking cards shows the airlines they transfer to.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.direct} onChange={(e) => set("direct", e.target.checked)} className="size-4 accent-primary" /> Nonstop only
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium">Sort</span>
          <select value={s.sort} onChange={(e) => set("sort", e.target.value)} className="h-9 rounded-md border bg-background px-2">
            <option value="points">Fewest points</option>
            <option value="cash">Lowest taxes and fees</option>
            {hasWallet && <option value="mine">What my points cover</option>}
          </select>
        </label>
        <p id="filters-status" role="status" aria-live="polite" className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground">
          {pending && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />}
          {pending ? "Updating…" : ""}
        </p>
      </div>
    </form>
  );
}
