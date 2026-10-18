"use client";

import { Plus } from "lucide-react";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlaceSearch } from "@/features/attractions/place-search";
import type { PlaceSuggestion } from "@/features/attractions/types";
import type { ActionState } from "@/features/trips/actions";
import { FreeTimeButton } from "./free-time-form";
import { addActivity } from "./place-actions";

type Point = { latitude: number; longitude: number } | null;

export function AddActivityForm({
  tripId,
  timeBlockId,
  near,
  city,
}: {
  tripId: string;
  timeBlockId: string;
  near: Point;
  city?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addActivity.bind(null, tripId),
    {}
  );
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState<PlaceSuggestion | null>(null);
  const [showAddress, setShowAddress] = useState(false);

  // Reset after a successful add (adjusting state when the result changes).
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state.ok) {
      setTitle("");
      setPicked(null);
      setShowAddress(false);
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <div className="mt-auto">
        {state.note && (
          <p className="mb-1 text-xs text-muted-foreground" role="status">
            {state.note}
          </p>
        )}
        <div className="-ml-2 flex flex-wrap items-start gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setOpen(true)}
          >
            <Plus aria-hidden="true" /> Add
          </Button>
          <FreeTimeButton tripId={tripId} timeBlockId={timeBlockId} />
        </div>
      </div>
    );
  }

  const id = (name: string) => `${name}-${timeBlockId}`;
  return (
    <div className="mt-auto grid gap-2">
      <form action={action} className="grid gap-2 rounded-md bg-muted/60 p-2">
        <input type="hidden" name="time_block_id" value={timeBlockId} />
        <Label htmlFor={id("title")} className="sr-only">
          Place or activity
        </Label>
        <PlaceSearch
          id={id("title")}
          value={title}
          onValueChange={setTitle}
          picked={picked}
          onPick={setPicked}
          near={near}
          city={city}
          placeholder="A place, restaurant or activity"
          autoFocus
        />

        {!picked &&
          (showAddress ? (
            <div className="grid gap-1">
              <Label htmlFor={id("address")} className="text-xs">
                Address (puts it on the map)
              </Label>
              <Input
                id={id("address")}
                name="address"
                placeholder="Street, number, city"
                className="h-8"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddress(true)}
              className="w-fit text-xs text-primary underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
            >
              Add an address
            </button>
          ))}

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Label htmlFor={id("price")} className="sr-only">
            Ticket price per person
          </Label>
          <Input
            id={id("price")}
            name="unit_price"
            type="number"
            min={0}
            step="0.01"
            placeholder={
              picked?.price != null
                ? picked.source === "viator"
                  ? "Using the Viator price"
                  : "Using the official price"
                : "Price each (optional)"
            }
            className="h-9"
          />
          <Button type="submit" size="sm" className="h-9" disabled={pending}>
            {pending ? "Adding…" : "Add"}
          </Button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Pick a suggestion to fill in the time, place and price.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
        </div>
        {state.error && (
          <p role="alert" className="text-xs text-destructive">
            {state.error}
          </p>
        )}
      </form>
    </div>
  );
}
