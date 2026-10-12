"use client";

import { useActionState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { addLodging, type ActionState } from "./actions";

export function LodgingForm({ tripId, tripCurrency, startDate, endDate }: { tripId: string; tripCurrency: string; startDate: string; endDate: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addLodging.bind(null, tripId), {});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-4 rounded-xl border bg-card p-5">
      <h2 className="text-xl font-semibold">Add a stay</h2>
      <div className="grid gap-2">
        <Label htmlFor="l-name">Hotel, rental or friend&rsquo;s place</Label>
        <Input id="l-name" name="name" placeholder="Memmo Alfama" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="l-address">Address</Label>
        <Input id="l-address" name="address" placeholder="Optional" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="l-in">Check-in (local time)</Label>
          <Input id="l-in" name="check_in_local" type="datetime-local" defaultValue={`${startDate}T15:00`} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="l-out">Check-out (local time)</Label>
          <Input id="l-out" name="check_out_local" type="datetime-local" defaultValue={`${endDate}T11:00`} required />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="l-cost">Total cash ({tripCurrency})</Label>
          <Input id="l-cost" name="cost" type="number" min={0} step="0.01" placeholder="All nights" />
          <input type="hidden" name="currency" value={tripCurrency} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="l-points">Points used</Label>
          <Input id="l-points" name="points_used" type="number" min={0} placeholder="Optional" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="l-status">Status</Label>
          <NativeSelect id="l-status" name="booking_status" defaultValue="booked">
            <option value="booked">Booked</option>
            <option value="held">On hold</option>
            <option value="idea">Just an idea</option>
          </NativeSelect>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="l-conf">Confirmation number</Label>
        <Input id="l-conf" name="confirmation_code" placeholder="Optional" />
      </div>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-lagoon">Saved and added to the budget.</p>}
      <div>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save stay"}</Button>
      </div>
    </form>
  );
}
