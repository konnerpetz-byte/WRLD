"use client";

import { useActionState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import type { Lodging } from "@/types/database";
import { addLodging, type ActionState, updateLodging } from "./actions";

/** "2026-05-10T15:00" in a time zone, for a datetime-local input. */
function toLocalInput(iso: string, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Add a stay, or edit one (pass `stay` and the time zone it's in). */
export function LodgingForm({
  tripId,
  tripCurrency,
  startDate,
  endDate,
  stay,
  timezone,
  onDone,
}: {
  tripId: string;
  tripCurrency: string;
  startDate: string;
  endDate: string;
  stay?: Lodging;
  timezone?: string;
  onDone?: () => void;
}) {
  const save = stay ? updateLodging.bind(null, tripId, stay.id) : addLodging.bind(null, tripId);
  const [state, action, pending] = useActionState<ActionState, FormData>(save, {});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state.ok) return;
    if (stay) onDone?.();
    else formRef.current?.reset();
  }, [state, stay, onDone]);
  const tz = timezone ?? "UTC";
  const id = (k: string) => `l-${k}${stay ? `-${stay.id}` : ""}`;

  return (
    <form ref={formRef} action={action} className="grid gap-4 rounded-xl border bg-card p-5">
      <h2 className="text-xl font-semibold">{stay ? `Edit ${stay.name}` : "Add a stay"}</h2>
      <div className="grid gap-2">
        <Label htmlFor={id("name")}>Hotel, rental or friend&rsquo;s place</Label>
        <Input id={id("name")} name="name" placeholder="Memmo Alfama" required defaultValue={stay?.name} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={id("address")}>Address</Label>
        <Input id={id("address")} name="address" placeholder="Optional" defaultValue={stay?.address ?? ""} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={id("in")}>Check-in (local time)</Label>
          <Input id={id("in")} name="check_in_local" type="datetime-local" defaultValue={stay ? toLocalInput(stay.check_in_at, tz) : `${startDate}T15:00`} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id("out")}>Check-out (local time)</Label>
          <Input id={id("out")} name="check_out_local" type="datetime-local" defaultValue={stay ? toLocalInput(stay.check_out_at, tz) : `${endDate}T11:00`} required />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor={id("cost")}>Total cash ({stay?.currency ?? tripCurrency})</Label>
          <Input id={id("cost")} name="cost" type="number" min={0} step="0.01" placeholder="All nights" defaultValue={stay?.cost ?? ""} />
          <input type="hidden" name="currency" value={stay?.currency ?? tripCurrency} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id("points")}>Points used</Label>
          <Input id={id("points")} name="points_used" type="number" min={0} placeholder="Optional" defaultValue={stay?.points_used ?? ""} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id("status")}>Status</Label>
          <NativeSelect id={id("status")} name="booking_status" defaultValue={stay?.booking_status ?? "booked"}>
            <option value="booked">Booked</option>
            <option value="held">On hold</option>
            <option value="idea">Just an idea</option>
          </NativeSelect>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={id("conf")}>Confirmation number</Label>
        <Input id={id("conf")} name="confirmation_code" placeholder="Optional" defaultValue={stay?.confirmation_code ?? ""} />
      </div>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state.ok && !stay && <p role="status" className="text-sm text-open">Saved and added to the budget.</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : stay ? "Save changes" : "Save stay"}</Button>
        {stay && (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
