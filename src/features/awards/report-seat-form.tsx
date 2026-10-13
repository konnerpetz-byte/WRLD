"use client";

import { Megaphone } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";

import { type ReportState, reportAwardSeat } from "./actions";

/** Share award space you found on an airline's site; it shows for everyone for three days. */
export function ReportSeatForm({
  origin,
  cabin,
  programs,
  minDate,
}: {
  origin: string;
  cabin: string;
  programs: { source: string; name: string }[];
  minDate: string;
}) {
  const [state, action, pending] = useActionState<ReportState, FormData>(reportAwardSeat, {});
  return (
    <section aria-labelledby="report-h" className="grid gap-4 rounded-2xl border bg-card p-5">
      <div>
        <h2 id="report-h" className="flex items-center gap-2 text-lg font-semibold">
          <Megaphone className="size-5 text-brand" aria-hidden="true" /> Found a seat? Share it
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Saw award space on an airline&rsquo;s site? Add it here and other WRLD travelers see it for three days, marked as
          reported by a traveler. This is how WRLD builds its own seat data.
        </p>
      </div>
      <form action={action} className="grid gap-3 sm:grid-cols-3 lg:grid-cols-[6rem_6rem_1fr_1.4fr_1fr_8rem]">
        <div className="grid gap-1.5">
          <Label htmlFor="rep-from" className="text-xs">From</Label>
          <Input id="rep-from" name="origin" defaultValue={origin} maxLength={3} required className="uppercase" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rep-to" className="text-xs">To</Label>
          <Input id="rep-to" name="destination" maxLength={3} required placeholder="MUC" className="uppercase" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rep-date" className="text-xs">Date</Label>
          <Input id="rep-date" name="date" type="date" min={minDate} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rep-program" className="text-xs">Booked with</Label>
          <NativeSelect id="rep-program" name="program" required defaultValue="">
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
          <Label htmlFor="rep-cabin" className="text-xs">Cabin</Label>
          <NativeSelect id="rep-cabin" name="cabin" defaultValue={cabin}>
            <option value="economy">Economy</option>
            <option value="premium">Premium economy</option>
            <option value="business">Business</option>
            <option value="first">First</option>
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rep-miles" className="text-xs">Points, one way</Label>
          <Input id="rep-miles" name="miles" type="number" inputMode="numeric" min={1000} step={500} required placeholder="75000" />
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="direct" className="size-4 accent-primary" /> Nonstop
        </label>
        <div className="flex items-center gap-3 sm:col-span-3 lg:col-span-4 lg:justify-end">
          {state.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          {state.ok && (
            <p role="status" className="text-sm text-primary">
              {state.note}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Sharing…" : "Share this seat"}
          </Button>
        </div>
      </form>
    </section>
  );
}
