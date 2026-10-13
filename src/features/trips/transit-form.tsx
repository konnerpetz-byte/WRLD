"use client";

import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { AirportField } from "@/features/places/airport-field";
import { findTicketsLinks, MODE } from "@/features/transit/modes";
import type { TransitMode, TransitSegment } from "@/types/database";
import { addTransit, type ActionState, updateTransit } from "./actions";

/** "2026-05-10T08:30" in a time zone, for a datetime-local input. */
function toLocalInput(iso: string, timeZone: string | null) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone ?? "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Add a new leg, or edit one (pass `leg`). */
export function TransitForm({
  tripId,
  tripTimezone,
  tripCurrency,
  timezones,
  leg,
  onDone,
}: {
  tripId: string;
  tripTimezone: string;
  tripCurrency: string;
  timezones: string[];
  leg?: TransitSegment;
  onDone?: () => void;
}) {
  const editing = Boolean(leg);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    leg ? updateTransit.bind(null, tripId, leg.id) : addTransit.bind(null, tripId),
    {},
  );
  const [direction, setDirection] = useState<"outbound" | "within" | "return">(leg?.direction ?? "outbound");
  // The traveler's own time zone, read from the browser (server render falls back to New York).
  const homeTz = useSyncExternalStore(
    () => () => {},
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "America/New_York",
  );
  const [mode, setMode] = useState<TransitMode>(leg?.mode ?? "flight");
  const [from, setFrom] = useState(leg?.origin_code ?? leg?.origin_name ?? "");
  const [to, setTo] = useState(leg?.destination_code ?? leg?.destination_name ?? "");
  const m = MODE[mode];
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state.ok) return;
    if (editing) {
      onDone?.();
      return;
    }
    formRef.current?.reset();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing the controlled fields after a save
    setFrom("");
    setTo("");
  }, [state, editing, onDone]);

  const originTz = leg?.origin_timezone ?? (direction === "outbound" ? homeTz : tripTimezone);
  const destTz = leg?.destination_timezone ?? (direction === "return" ? homeTz : tripTimezone);
  const p = leg ? `edit-${leg.id}-` : "";

  return (
    <form ref={formRef} action={action} className="grid gap-5 rounded-xl border bg-card p-5">
      <h2 className="text-xl font-semibold">{editing ? "Edit this leg" : "Add a flight, train, bus, ferry or drive"}</h2>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">This leg is</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["outbound", "Getting there"],
              ["within", "Between stops"],
              ["return", "Going home"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-secondary has-focus-visible:outline-2 has-focus-visible:outline-ring"
            >
              <input type="radio" name="direction" value={value} checked={direction === value} onChange={() => setDirection(value)} className="accent-primary" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid items-end gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor={`${p}mode`}>Type</Label>
          <NativeSelect id={`${p}mode`} name="mode" value={mode} onChange={(e) => setMode(e.target.value as TransitMode)}>
            {(Object.keys(MODE) as TransitMode[]).map((k) => (
              <option key={k} value={k}>
                {MODE[k].label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${p}carrier`}>{m.carrier}</Label>
          <Input id={`${p}carrier`} name="carrier" placeholder={m.carrierPlaceholder} defaultValue={leg?.carrier ?? ""} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${p}service_number`}>{m.number}</Label>
          <Input id={`${p}service_number`} name="service_number" placeholder={m.numberPlaceholder} defaultValue={leg?.service_number ?? ""} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset className="grid gap-2 rounded-lg border p-3">
          <legend className="px-1 text-sm font-medium">Departs</legend>
          <Label htmlFor={`${p}origin_place`} className="text-xs">
            {m.usesCodes ? "From (city or airport code)" : m.from}
          </Label>
          {m.usesCodes ? (
            <AirportField id={`${p}origin_place`} name="origin_code" value={from} onValueChange={setFrom} placeholder="Detroit or DTW" />
          ) : (
            <Input id={`${p}origin_place`} name="origin_name" placeholder={m.fromPlaceholder} maxLength={120} value={from} onChange={(e) => setFrom(e.target.value)} />
          )}
          <Label htmlFor={`${p}depart_local`} className="text-xs">
            Local time
          </Label>
          <Input id={`${p}depart_local`} name="depart_local" type="datetime-local" required defaultValue={leg ? toLocalInput(leg.depart_at, leg.origin_timezone) : undefined} />
          <Label htmlFor={`${p}origin_timezone`} className="text-xs">
            Time zone
          </Label>
          <NativeSelect id={`${p}origin_timezone`} name="origin_timezone" key={`o-${originTz}`} defaultValue={originTz}>
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replaceAll("_", " ")}
              </option>
            ))}
          </NativeSelect>
        </fieldset>
        <fieldset className="grid gap-2 rounded-lg border p-3">
          <legend className="px-1 text-sm font-medium">Arrives</legend>
          <Label htmlFor={`${p}destination_place`} className="text-xs">
            {m.usesCodes ? "To (city or airport code)" : m.to}
          </Label>
          {m.usesCodes ? (
            <AirportField id={`${p}destination_place`} name="destination_code" value={to} onValueChange={setTo} placeholder="Lisbon or LIS" />
          ) : (
            <Input id={`${p}destination_place`} name="destination_name" placeholder={m.toPlaceholder} maxLength={120} value={to} onChange={(e) => setTo(e.target.value)} />
          )}
          <Label htmlFor={`${p}arrive_local`} className="text-xs">
            Local time
          </Label>
          <Input id={`${p}arrive_local`} name="arrive_local" type="datetime-local" required defaultValue={leg ? toLocalInput(leg.arrive_at, leg.destination_timezone) : undefined} />
          <Label htmlFor={`${p}destination_timezone`} className="text-xs">
            Time zone
          </Label>
          <NativeSelect id={`${p}destination_timezone`} name="destination_timezone" key={`d-${destTz}`} defaultValue={destTz}>
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replaceAll("_", " ")}
              </option>
            ))}
          </NativeSelect>
        </fieldset>
      </div>

      {!m.usesCodes && mode !== "car" && (
        <p className="text-xs text-muted-foreground">
          Need times or tickets?{" "}
          {findTicketsLinks(mode, from || null, to || null).map((l, i) => (
            <span key={l.label}>
              {i > 0 && " · "}
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
                {l.label}
              </a>
            </span>
          ))}
        </p>
      )}

      <div className="grid items-end gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor={`${p}t-cost`}>Cash ({leg?.currency ?? tripCurrency})</Label>
          <Input id={`${p}t-cost`} name="cost" type="number" min={0} step="0.01" placeholder="0.00" defaultValue={leg?.cost ?? ""} />
          <input type="hidden" name="currency" value={leg?.currency ?? tripCurrency} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${p}t-points`}>Points</Label>
          <Input id={`${p}t-points`} name="points_used" type="number" min={0} step="1" placeholder="Optional" defaultValue={leg?.points_used ?? ""} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${p}t-status`}>Status</Label>
          <NativeSelect id={`${p}t-status`} name="booking_status" defaultValue={leg?.booking_status ?? "booked"}>
            <option value="booked">Booked</option>
            <option value="held">On hold</option>
            <option value="idea">Just an idea</option>
            {editing && <option value="cancelled">Cancelled</option>}
          </NativeSelect>
        </div>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.ok && !editing && (
        <p role="status" className="text-sm text-open">
          Saved. Your day plan has been updated.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : editing ? "Save changes" : "Save leg"}
        </Button>
        {editing && (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
