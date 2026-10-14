"use client";

import { Calendar, Check, ChevronDown, CreditCard, Loader2, MapPin, Plane, Armchair } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useId, useRef, useState, useTransition } from "react";

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
  /** The trip this search is for, kept so the page can link back to it. */
  trip?: string;
};

function toParams(s: FilterState) {
  const p = new URLSearchParams();
  if (s.trip) p.set("trip", s.trip);
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
  if (s.sort && s.sort !== "value") p.set("sort", s.sort);
  return p;
}

const codesOk = (v: string) => v.trim() === "" || /^([A-Za-z]{3})(\s*,\s*[A-Za-z]{3})*$/.test(v.trim());
const fromOk = (v: string) => /^[A-Za-z]{3}(,[A-Za-z]{3}){0,2}$/.test(v.replace(/\s+/g, ""));

/** "Europe, Asia +1" */
function summarize(labels: string[], empty: string, max = 2) {
  if (!labels.length) return empty;
  return labels.length <= max ? labels.join(", ") : `${labels.slice(0, max).join(", ")} +${labels.length - max}`;
}

const shortDate = (iso: string) =>
  iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "";

function Chips({ options, value, onChange, label }: { options: Opt[]; value: string[]; onChange: (v: string[]) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-[color,background-color,border-color,transform] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-safe:active:scale-[0.96] ${
              on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary/50"
            }`}
          >
            {on && <Check className="size-3.5" aria-hidden="true" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A search-bar field that opens a panel of options under it. */
function Field({
  id,
  open,
  setOpen,
  icon,
  label,
  value,
  children,
  wide,
  span,
  end,
}: {
  id: string;
  open: string | null;
  setOpen: (v: string | null) => void;
  icon: ReactNode;
  label: string;
  value: string;
  children: ReactNode;
  wide?: boolean;
  /** Full width on phones */
  span?: boolean;
  /** Panel lines up with the field's right edge (fields at the end of the bar) */
  end?: boolean;
}) {
  const panelId = useId();
  const isOpen = open === id;
  return (
    <div className={`min-w-0 sm:relative ${span ? "max-sm:col-span-2" : ""}`}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setOpen(isOpen ? null : id)}
        className={`flex h-full min-h-14 w-full min-w-0 items-center gap-2.5 rounded-xl px-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
          isOpen ? "bg-muted" : "hover:bg-muted/60"
        }`}
      >
        <span className="text-muted-foreground" aria-hidden="true">
          {icon}
        </span>
        <span className="grid min-w-0 flex-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="truncate text-sm font-medium">{value}</span>
        </span>
        <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {isOpen && (
        <div
          id={panelId}
          role="group"
          aria-label={label}
          className={`absolute inset-x-0 top-full z-30 mt-2 grid gap-4 rounded-2xl border bg-card p-4 shadow-[0_18px_50px_-18px_rgb(10_18_15/0.45)] sm:inset-x-auto ${end ? "sm:right-0" : "sm:left-0"} ${wide ? "sm:w-[34rem]" : "sm:w-[24rem]"}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * The explorer's search bar: From, To, When, Cabin and Points as compact
 * fields that open a panel of choices. Every choice updates the results at
 * once; typing airport codes waits for a pause.
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
  const [open, setOpen] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(true);
  const delay = useRef(0);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!fromOk(s.from) || !codesOk(s.codes)) return;
    if (s.dateMode === "dates" && (!s.start || !s.end)) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      start(() => router.replace(`${pathname}?${toParams(s).toString()}`, { scroll: false }));
    }, delay.current);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [s, router, pathname]);

  // Close the open panel on Escape or a click outside the bar.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    const onDown = (e: PointerEvent) => {
      if (bar.current && !bar.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const set = <K extends keyof FilterState>(k: K, v: FilterState[K]) => {
    delay.current = k === "from" || k === "codes" ? 450 : 0;
    setS((prev) => ({ ...prev, [k]: v }));
  };
  const today = new Date().toISOString().slice(0, 10);
  const labelOf = (opts: Opt[], v: string) => opts.find((o) => o.value === v)?.label ?? v;

  const toValue = s.to.includes("anywhere")
    ? "Anywhere"
    : summarize([...s.to.map((t) => labelOf(regions, t)), ...(s.codes.trim() ? [s.codes.toUpperCase().replace(/\s+/g, "")] : [])], "Pick a region");
  const whenValue =
    s.dateMode === "dates"
      ? s.start && s.end
        ? s.start === s.end
          ? shortDate(s.start)
          : `${shortDate(s.start)} to ${shortDate(s.end)}`
        : "Pick dates"
      : summarize(s.months.map((m) => labelOf(monthOptions, m)), "Pick a month");
  const pointsValue = s.mine
    ? "My points"
    : summarize([...s.banks.map((b) => labelOf(banks, b)), ...s.programs.map((p) => labelOf(programs, p))], "Any program");

  return (
    <div className="grid gap-3">
      <div ref={bar} className="relative grid grid-cols-2 gap-1 rounded-2xl border bg-card p-1.5 shadow-[0_1px_2px_rgb(10_18_15/0.06)] sm:grid-cols-[9rem_repeat(4,minmax(0,1fr))]">
        <label className="flex min-h-14 items-center gap-2.5 rounded-xl px-3 focus-within:bg-muted/60">
          <Plane className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="grid min-w-0 flex-1">
            <span className="text-xs text-muted-foreground">From</span>
            <input
              name="from"
              value={s.from}
              onChange={(e) => set("from", e.target.value)}
              onFocus={() => setOpen(null)}
              placeholder="DTW"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={s.from.trim() !== "" && !fromOk(s.from)}
              aria-describedby="from-help"
              className="w-full min-w-0 bg-transparent text-sm font-medium uppercase outline-none placeholder:text-muted-foreground/70"
            />
          </span>
          <span id="from-help" className="sr-only">
            Up to 3 airport codes, separated by commas
          </span>
        </label>

        <Field id="to" open={open} setOpen={setOpen} icon={<MapPin className="size-4" />} label="To" value={toValue} wide>
          <Chips
            label="Regions"
            options={[{ value: "anywhere", label: "Anywhere" }, ...regions]}
            value={s.to}
            onChange={(v) => {
              const added = v.find((x) => !s.to.includes(x));
              set("to", added === "anywhere" ? ["anywhere"] : v.filter((x) => x !== "anywhere"));
            }}
          />
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Or specific airports</span>
            <input
              value={s.codes}
              onChange={(e) => set("codes", e.target.value)}
              placeholder="LIS, NRT"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!codesOk(s.codes)}
              className="h-10 rounded-lg border bg-background px-3 uppercase"
            />
          </label>
        </Field>

        <Field id="when" open={open} setOpen={setOpen} icon={<Calendar className="size-4" />} label="When" value={whenValue} wide>
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
            <Chips label="Travel months" options={monthOptions} value={s.months} onChange={(v) => set("months", v.length ? v : s.months)} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Earliest</span>
                <input type="date" min={today} value={s.start} onChange={(e) => set("start", e.target.value)} className="h-10 rounded-lg border bg-background px-3" />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Latest</span>
                <input type="date" min={s.start || today} value={s.end} onChange={(e) => set("end", e.target.value)} className="h-10 rounded-lg border bg-background px-3" />
              </label>
            </div>
          )}
        </Field>

        <Field id="cabin" open={open} setOpen={setOpen} icon={<Armchair className="size-4" />} label="Cabin" value={summarize(s.cabins.map((c) => labelOf(cabins, c)), "Any")} end>
          <Chips label="Cabins" options={cabins} value={s.cabins} onChange={(v) => set("cabins", v.length ? v : s.cabins)} />
        </Field>

        <Field id="points" open={open} setOpen={setOpen} icon={<CreditCard className="size-4" />} label="Points" value={pointsValue} wide span end>
          {hasWallet && (
            <label className="flex items-center gap-2.5 text-sm font-medium">
              <input type="checkbox" checked={s.mine} onChange={(e) => set("mine", e.target.checked)} className="size-4 accent-primary" />
              Only programs my points can reach
            </label>
          )}
          <div className="grid gap-2">
            <p className="text-sm font-medium">Card points</p>
            <Chips label="Card points" options={banks} value={s.banks} onChange={(v) => set("banks", v)} />
          </div>
          <div className="grid gap-2">
            <p className="text-sm font-medium">Airline programs</p>
            <div className="max-h-48 overflow-y-auto overscroll-contain pr-1">
              <Chips label="Airline programs" options={programs} value={s.programs} onChange={(v) => set("programs", v)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Pick none to see every program. Cards show the airlines they transfer to.</p>
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={s.direct} onChange={(e) => set("direct", e.target.checked)} className="size-4 accent-primary" /> Nonstop only
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">Sort by</span>
          <select value={s.sort} onChange={(e) => set("sort", e.target.value)} className="h-8 rounded-md border bg-background px-2">
            <option value="value">Best deal</option>
            <option value="points">Fewest points</option>
            <option value="cash">Lowest taxes and fees</option>
            {hasWallet && <option value="mine">What my points cover</option>}
          </select>
        </label>
        <p role="status" aria-live="polite" className="ml-auto flex min-h-5 items-center gap-1.5 text-muted-foreground">
          {pending && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />}
          {pending ? "Updating" : ""}
        </p>
      </div>
    </div>
  );
}
