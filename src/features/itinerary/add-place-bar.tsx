"use client";

import { Sparkles } from "lucide-react";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { PlaceSearch } from "@/features/attractions/place-search";
import type { PlaceSuggestion } from "@/features/attractions/types";
import type { ActionState } from "@/features/trips/actions";
import { addPlace } from "./place-actions";
import { PlaceRecommendations } from "./place-recommendations";

export type DayOption = {
  id: string;
  label: string;
  city: string | null;
  point: { latitude: number; longitude: number } | null;
};

/** "Add a place": type Sintra, and WRLD picks the day, time and official tickets. */
export function AddPlaceBar({
  tripId,
  days,
  initialQuery = "",
}: {
  tripId: string;
  days: DayOption[];
  initialQuery?: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addPlace.bind(null, tripId),
    {}
  );
  const [title, setTitle] = useState(initialQuery);
  const [picked, setPicked] = useState<PlaceSuggestion | null>(null);
  const [dayId, setDayId] = useState("");

  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state.ok) {
      setTitle("");
      setPicked(null);
    }
  }

  const near =
    days.find((d) => d.id === dayId)?.point ??
    days.find((d) => d.point)?.point ??
    null;

  return (
    <div className="mb-6 grid gap-3 rounded-xl border bg-card p-4">
      <form action={action} className="grid gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-brand" aria-hidden="true" />
          <h2 className="text-base font-semibold">Add a place</h2>
          <span className="text-sm text-muted-foreground">
            Search a sight, or a kind of place like &ldquo;cafe&rdquo; or
            &ldquo;Munich beer garden&rdquo;.
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_15rem_auto] md:items-start">
          <div className="grid gap-1.5">
            <Label htmlFor="add-place" className="sr-only">
              Place
            </Label>
            <PlaceSearch
              id="add-place"
              value={title}
              onValueChange={setTitle}
              picked={picked}
              onPick={setPicked}
              near={near}
              autoFocus={Boolean(initialQuery)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="add-place-day" className="sr-only">
              Day
            </Label>
            <NativeSelect
              id="add-place-day"
              name="day_id"
              value={dayId}
              onChange={(e) => setDayId(e.target.value)}
            >
              <option value="">Best day for it</option>
              {days.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                  {d.city ? ` · ${d.city}` : ""}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Adding…" : "Add to trip"}
          </Button>
        </div>
        {state.note && (
          <p role="status" className="text-sm text-muted-foreground">
            {state.note}
          </p>
        )}
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
      </form>
      {/* Outside the form: each card has its own Add form. */}
      {!title && (
        <PlaceRecommendations
          tripId={tripId}
          dayId={dayId}
          dayLabel={days.find((d) => d.id === dayId)?.label ?? null}
        />
      )}
    </div>
  );
}
