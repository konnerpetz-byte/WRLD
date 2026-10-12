"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "./actions";
import { deleteTrip } from "./trip-actions";

export function DeleteTripForm({ tripId, title }: { tripId: string; title: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(deleteTrip.bind(null, tripId), {});
  return (
    <section aria-labelledby="delete-heading" className="rounded-xl border border-destructive/40 p-6">
      <h2 id="delete-heading" className="text-lg font-semibold">
        Delete this trip
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Deletes {title} with its days, plans, stays, travel and expenses for everyone on it. This can&rsquo;t be undone.
      </p>
      <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="confirm">Type DELETE to confirm</Label>
          <Input id="confirm" name="confirm" autoComplete="off" className="w-44" />
        </div>
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? "Deleting…" : "Delete trip"}
        </Button>
      </form>
      {state.error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
    </section>
  );
}
