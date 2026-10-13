"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { type HomeAirportState, setHomeAirport } from "./actions";

export function HomeAirportForm({ current }: { current: string | null }) {
  const [state, action, pending] = useActionState<HomeAirportState, FormData>(setHomeAirport, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="wallet-home-airport">Home airport</Label>
        <Input
          id="wallet-home-airport"
          name="home_airport"
          defaultValue={current ?? ""}
          placeholder="DTW"
          maxLength={3}
          autoComplete="off"
          aria-describedby="wallet-home-airport-note"
          aria-invalid={state.error ? true : undefined}
          className="w-24 uppercase"
        />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      <p id="wallet-home-airport-note" role="status" className={`basis-full text-sm ${state.error ? "text-destructive" : "text-muted-foreground"}`}>
        {state.error ?? (state.saved ? `Saved. Searches start from ${state.saved}.` : "Where your flights usually start.")}
      </p>
    </form>
  );
}
