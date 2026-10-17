"use client";

import { Sun } from "lucide-react";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/features/trips/actions";
import { addFreeTime } from "./place-actions";

/** Block out free time in a morning, afternoon or evening: nothing planned, on purpose. */
export function FreeTimeButton({ tripId, timeBlockId }: { tripId: string; timeBlockId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(addFreeTime.bind(null, tripId), {});
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state.ok) setOpen(false);
  }
  const id = (k: string) => `free-${k}-${timeBlockId}`;

  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setOpen(true)}>
        <Sun aria-hidden="true" /> Free time
      </Button>
    );
  }
  return (
    <form action={action} className="grid gap-2 rounded-md bg-muted/60 p-2">
      <input type="hidden" name="time_block_id" value={timeBlockId} />
      <div className="grid gap-1">
        <Label htmlFor={id("title")} className="text-xs">
          Free time for
        </Label>
        <Input id={id("title")} name="title" placeholder="Free time (nap, pool, wander)" className="h-8" autoFocus maxLength={120} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1">
          <Label htmlFor={id("start")} className="text-xs">
            From (optional)
          </Label>
          <Input id={id("start")} name="start_time" type="time" className="h-8" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={id("end")} className="text-xs">
            Until (optional)
          </Label>
          <Input id={id("end")} name="end_time" type="time" className="h-8" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add free time"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
