"use client";

import { Plus } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addActivity, type ActionState } from "@/features/trips/actions";

export function AddActivityForm({ tripId, timeBlockId }: { tripId: string; timeBlockId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(addActivity.bind(null, tripId), {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  if (!open) {
    return (
      <div className="mt-auto">
        {state.note && <p className="mb-1 text-xs text-muted-foreground" role="status">{state.note}</p>}
        <Button type="button" variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => setOpen(true)}>
          <Plus aria-hidden="true" /> Add
        </Button>
      </div>
    );
  }

  const id = (name: string) => `${name}-${timeBlockId}`;
  return (
    <form
      ref={formRef}
      action={(fd) => {
        action(fd);
        setOpen(false);
      }}
      className="mt-auto grid gap-2 rounded-md bg-muted/60 p-2"
    >
      <input type="hidden" name="time_block_id" value={timeBlockId} />
      <Label htmlFor={id("title")} className="sr-only">
        Activity
      </Label>
      <Input id={id("title")} name="title" placeholder="Art Institute of Chicago" required autoFocus />
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Label htmlFor={id("price")} className="sr-only">
          Ticket price per person
        </Label>
        <Input id={id("price")} name="unit_price" type="number" min={0} step="0.01" placeholder="Price each (optional)" />
        <Button type="submit" size="sm" className="h-9" disabled={pending}>
          {pending ? "Finding price…" : "Add"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Leave the price blank and we&rsquo;ll look it up.</p>
      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
