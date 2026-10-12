"use client";

import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { addTransit, type ActionState } from "./actions";

export function TransitForm({
  tripId,
  tripTimezone,
  tripCurrency,
  timezones,
}: {
  tripId: string;
  tripTimezone: string;
  tripCurrency: string;
  timezones: string[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addTransit.bind(null, tripId), {});
  const [direction, setDirection] = useState<"outbound" | "within" | "return">("outbound");
  // The traveler's own time zone, read from the browser (server render falls back to New York).
  const homeTz = useSyncExternalStore(
    () => () => {},
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "America/New_York",
  );
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  const originTz = direction === "outbound" ? homeTz : tripTimezone;
  const destTz = direction === "return" ? homeTz : tripTimezone;

  return (
    <form ref={formRef} action={action} className="grid gap-5 rounded-xl border bg-card p-5">
      <h2 className="text-xl font-semibold">Add a flight or train</h2>

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
              className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-secondary"
            >
              <input type="radio" name="direction" value={value} checked={direction === value} onChange={() => setDirection(value)} className="accent-primary" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid items-end gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="mode">Type</Label>
          <NativeSelect id="mode" name="mode" defaultValue="flight">
            <option value="flight">Flight</option>
            <option value="train">Train</option>
            <option value="bus">Bus</option>
            <option value="ferry">Ferry</option>
            <option value="car">Car</option>
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="carrier">Airline</Label>
          <Input id="carrier" name="carrier" placeholder="TAP" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="service_number">Number</Label>
          <Input id="service_number" name="service_number" placeholder="TP 212" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset className="grid gap-2 rounded-lg border p-3">
          <legend className="px-1 text-sm font-medium">Departs</legend>
          <Label htmlFor="origin_code" className="text-xs">From (airport code)</Label>
          <Input id="origin_code" name="origin_code" placeholder="DTW" maxLength={8} />
          <Label htmlFor="depart_local" className="text-xs">Local time</Label>
          <Input id="depart_local" name="depart_local" type="datetime-local" required />
          <Label htmlFor="origin_timezone" className="text-xs">Time zone</Label>
          <NativeSelect id="origin_timezone" name="origin_timezone" key={`o-${originTz}`} defaultValue={originTz}>
            {timezones.map((tz) => (
              <option key={tz} value={tz}>{tz.replaceAll("_", " ")}</option>
            ))}
          </NativeSelect>
        </fieldset>
        <fieldset className="grid gap-2 rounded-lg border p-3">
          <legend className="px-1 text-sm font-medium">Arrives</legend>
          <Label htmlFor="destination_code" className="text-xs">To (airport code)</Label>
          <Input id="destination_code" name="destination_code" placeholder="LIS" maxLength={8} />
          <Label htmlFor="arrive_local" className="text-xs">Local time</Label>
          <Input id="arrive_local" name="arrive_local" type="datetime-local" required />
          <Label htmlFor="destination_timezone" className="text-xs">Time zone</Label>
          <NativeSelect id="destination_timezone" name="destination_timezone" key={`d-${destTz}`} defaultValue={destTz}>
            {timezones.map((tz) => (
              <option key={tz} value={tz}>{tz.replaceAll("_", " ")}</option>
            ))}
          </NativeSelect>
        </fieldset>
      </div>

      <div className="grid items-end gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="t-cost">Cash ({tripCurrency})</Label>
          <Input id="t-cost" name="cost" type="number" min={0} step="0.01" placeholder="0.00" />
          <input type="hidden" name="currency" value={tripCurrency} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="t-points">Points</Label>
          <Input id="t-points" name="points_used" type="number" min={0} step="1" placeholder="Optional" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="t-status">Status</Label>
          <NativeSelect id="t-status" name="booking_status" defaultValue="booked">
            <option value="booked">Booked</option>
            <option value="held">On hold</option>
            <option value="idea">Just an idea</option>
          </NativeSelect>
        </div>
      </div>

      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-lagoon">Saved. Your day grid has been updated.</p>}
      <div>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save leg"}</Button>
      </div>
    </form>
  );
}
