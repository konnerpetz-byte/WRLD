"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import type { ActionState } from "@/features/trips/actions";
import type { TimeBlockSlot } from "@/types/database";
import { addNamedPlaceToTrip, addPlace } from "./place-actions";

function Done({ state, tripId }: { state: ActionState; tripId: string }) {
  return (
    <span role="status" className="text-xs">
      {state.note ?? "Added."}{" "}
      <Link href={`/trips/${tripId}/itinerary`} className="font-medium text-primary underline underline-offset-2">
        See it
      </Link>
    </span>
  );
}

/** Adds an official sight to the trip in one tap (best day and time picked for you). */
export function AddSightButton({ tripId, attractionId, title, label = "Add to itinerary" }: { tripId: string; attractionId: string; title: string; label?: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addPlace.bind(null, tripId), {});
  if (state.ok) return <Done state={state} tripId={tripId} />;
  return (
    <form action={action} className="grid gap-1">
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="source" value="official" />
      <input type="hidden" name="ref" value={attractionId} />
      <input type="hidden" name="day_id" value="" />
      <Button type="submit" size="sm" disabled={pending}>
        <Plus aria-hidden="true" /> {pending ? "Adding…" : label}
      </Button>
      {state.error && <span role="alert" className="text-xs text-destructive">{state.error}</span>}
    </form>
  );
}

export type QuickPlace = { name: string; latitude: number; longitude: number; address: string | null; km?: number };

/** One named place (a café, bookstore…) with a one-tap Add. */
export function AddNamedPlaceRow({ tripId, place, slot }: { tripId: string; place: QuickPlace; slot?: TimeBlockSlot | null }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addNamedPlaceToTrip.bind(null, tripId), {});
  return (
    <li className="flex items-center gap-2 text-sm">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{place.name}</span>
        {(place.address || place.km != null) && (
          <span className="block truncate text-xs text-muted-foreground">
            {[place.address, place.km != null ? (place.km < 1 ? `${Math.round(place.km * 1000)} m` : `${place.km} km`) : null].filter(Boolean).join(" · ")}
          </span>
        )}
        {state.error && <span role="alert" className="block text-xs text-destructive">{state.error}</span>}
        {state.ok && <Done state={state} tripId={tripId} />}
      </span>
      {!state.ok && (
        <form action={action}>
          <input type="hidden" name="name" value={place.name} />
          <input type="hidden" name="latitude" value={place.latitude} />
          <input type="hidden" name="longitude" value={place.longitude} />
          <input type="hidden" name="address" value={place.address ?? ""} />
          {slot && <input type="hidden" name="slot" value={slot} />}
          <Button type="submit" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={pending}>
            <Plus aria-hidden="true" /> {pending ? "…" : "Add"}
          </Button>
        </form>
      )}
    </li>
  );
}
