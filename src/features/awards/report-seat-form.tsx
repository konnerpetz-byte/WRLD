"use client";

import { ClipboardPaste } from "lucide-react";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { type PasteState, readPastedSeats, type ReportState, reportAwardSeat, reportManySeats } from "./actions";
import { SendFromAirline } from "./check-live";

type Programs = { source: string; name: string }[];

/**
 * Share award space found on an airline's site. One seat at a time, or paste
 * the airline's results calendar and share every date at once. Reports show
 * for three days and can be confirmed or taken down by other travelers.
 */
export function ReportSeatForm({ origin, cabin, programs, minDate }: { origin: string; cabin: string; programs: Programs; minDate: string }) {
  const [mode, setMode] = useState<"send" | "one" | "paste">("send");
  return (
    <section id="check-live" aria-labelledby="report-h" className="grid gap-4 rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="report-h" className="text-lg font-semibold">
          Found seats on an airline&rsquo;s site?
        </h2>
        <div role="tablist" aria-label="How to add them" className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
          {(
            [
              ["send", "Save from a site"],
              ["one", "Type it"],
              ["paste", "Paste"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => setMode(value)}
              className={`rounded-md px-3 py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-ring ${mode === value ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {mode === "send" ? (
        <SendFromAirline />
      ) : mode === "one" ? (
        <OneSeat origin={origin} cabin={cabin} programs={programs} minDate={minDate} />
      ) : (
        <PasteCalendar origin={origin} cabin={cabin} programs={programs} />
      )}
      <p className="text-xs text-muted-foreground">Shared seats show for three days, marked as seen by a traveler, and others can confirm or take them down.</p>
    </section>
  );
}

export function RouteFields({
  origin,
  cabin,
  programs,
  prefix,
  destination = "",
  program = "",
}: {
  origin: string;
  cabin: string;
  programs: Programs;
  prefix: string;
  destination?: string;
  program?: string;
}) {
  return (
    <>
      <div className="grid gap-1.5">
        <Label htmlFor={`${prefix}-from`} className="text-xs">From</Label>
        <Input id={`${prefix}-from`} name="origin" defaultValue={origin} maxLength={3} required className="uppercase" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${prefix}-to`} className="text-xs">To</Label>
        <Input id={`${prefix}-to`} name="destination" defaultValue={destination} maxLength={3} required placeholder="MUC" className="uppercase" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${prefix}-program`} className="text-xs">Booked with</Label>
        <NativeSelect id={`${prefix}-program`} name="program" required defaultValue={program}>
          <option value="" disabled>
            Choose a program
          </option>
          {programs.map((p) => (
            <option key={p.source} value={p.source}>
              {p.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${prefix}-cabin`} className="text-xs">Cabin</Label>
        <NativeSelect id={`${prefix}-cabin`} name="cabin" defaultValue={cabin}>
          <option value="economy">Economy</option>
          <option value="premium">Premium economy</option>
          <option value="business">Business</option>
          <option value="first">First</option>
        </NativeSelect>
      </div>
    </>
  );
}

export function Status({ state }: { state: ReportState }) {
  if (state.error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {state.error}
      </p>
    );
  if (state.ok)
    return (
      <p role="status" className="text-sm text-primary">
        {state.note}
      </p>
    );
  return null;
}

function OneSeat({ origin, cabin, programs, minDate }: { origin: string; cabin: string; programs: Programs; minDate: string }) {
  const [state, action, pending] = useActionState<ReportState, FormData>(reportAwardSeat, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[6rem_6rem_1.4fr_1fr_1fr_8rem_9rem]">
      <RouteFields origin={origin} cabin={cabin} programs={programs} prefix="rep" />
      <div className="grid gap-1.5">
        <Label htmlFor="rep-date" className="text-xs">Date</Label>
        <Input id="rep-date" name="date" type="date" min={minDate} required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="rep-miles" className="text-xs">Points, one way</Label>
        <Input id="rep-miles" name="miles" type="number" inputMode="numeric" min={1000} step={500} required placeholder="75000" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="rep-taxes" className="text-xs">Taxes and fees</Label>
        <div className="flex gap-1">
          <NativeSelect aria-label="Currency" name="tax_currency" defaultValue="USD" className="w-[4.5rem] px-1">
            {["USD", "CAD", "EUR", "GBP", "AUD"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </NativeSelect>
          <Input id="rep-taxes" name="taxes" type="number" inputMode="decimal" min={0} step="0.01" placeholder="5.60" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="direct" className="size-4 accent-primary" /> Nonstop
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-6 lg:justify-end">
        <Status state={state} />
        <Button type="submit" disabled={pending}>
          {pending ? "Sharing…" : "Share this seat"}
        </Button>
      </div>
    </form>
  );
}

function PasteCalendar({ origin, cabin, programs }: { origin: string; cabin: string; programs: Programs }) {
  const [read, readAction, reading] = useActionState<PasteState, FormData>(readPastedSeats, {});
  const [state, action, pending] = useActionState<ReportState, FormData>(reportManySeats, {});
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const rows = (read.rows ?? []).filter((r) => !skip.has(r.date));

  return (
    <div className="grid gap-4">
      <form action={readAction} className="grid gap-2">
        <Label htmlFor="paste-text" className="flex items-center gap-2 text-sm font-medium">
          <ClipboardPaste className="size-4" aria-hidden="true" /> Paste the airline&rsquo;s results
        </Label>
        <p id="paste-help" className="text-xs text-muted-foreground">
          On the airline&rsquo;s award calendar or results page, select the dates and prices, copy, and paste here. WRLD reads each date,
          its lowest points price and the taxes shown with it, for you to check.
        </p>
        <Textarea id="paste-text" name="pasted" rows={5} aria-describedby="paste-help" placeholder={"Sun, May 16\n75,000 miles + $5.60\nMon, May 17\n60.5k miles"} />
        <div className="flex items-center gap-3">
          <Button type="submit" variant="outline" disabled={reading}>
            {reading ? "Reading…" : "Read dates and prices"}
          </Button>
          {read.error && (
            <p role="alert" className="text-sm text-destructive">
              {read.error}
            </p>
          )}
        </div>
      </form>

      {read.rows && read.rows.length > 0 && (
        <form action={action} className="grid gap-3">
          <fieldset className="grid gap-1.5">
            <legend className="mb-1 text-sm font-medium">Found {read.rows.length}. Untick any that are wrong.</legend>
            <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {read.rows.map((r) => (
                <li key={r.date}>
                  <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={!skip.has(r.date)}
                      onChange={(e) => {
                        const next = new Set(skip);
                        if (e.target.checked) next.delete(r.date);
                        else next.add(r.date);
                        setSkip(next);
                      }}
                    />
                    <span className="tabular-nums">
                      {new Date(`${r.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
                    </span>
                    <span className="ml-auto text-right font-semibold tabular-nums">
                      {r.miles.toLocaleString()}
                      {r.taxes != null && (
                        <span className="block text-xs font-normal text-muted-foreground">
                          + {r.taxes.toLocaleString("en-US", { style: "currency", currency: r.taxCurrency ?? "USD" })}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[6rem_6rem_1.4fr_1fr_auto] lg:items-end">
            <RouteFields origin={origin} cabin={cabin} programs={programs} prefix="paste" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="direct" className="size-4 accent-primary" /> Nonstop
            </label>
          </div>
          <input type="hidden" name="rows" value={JSON.stringify(rows.slice(0, 20))} />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending || !rows.length}>
              {pending ? "Sharing…" : `Share ${Math.min(rows.length, 20)} ${rows.length === 1 ? "seat" : "seats"}`}
            </Button>
            {rows.length > 20 && <span className="text-xs text-muted-foreground">Up to 20 at a time.</span>}
            <Status state={state} />
          </div>
        </form>
      )}
    </div>
  );
}
