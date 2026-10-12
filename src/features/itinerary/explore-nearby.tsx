"use client";

import { BadgeCheck, Compass, Plus } from "lucide-react";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatClock } from "@/features/itinerary/schedule";
import { SLOT_LABEL, type PlaceSuggestion } from "@/features/attractions/types";
import type { ActionState } from "@/features/trips/actions";
import { formatMoney } from "@/lib/format";
import { addNearby } from "./place-actions";

/** Sights around an excursion: WRLD's official list first, then notable places nearby. */
export function ExploreNearby({
  tripId,
  itemId,
  title,
  latitude,
  longitude,
  canEdit,
}: {
  tripId: string;
  itemId: string;
  title: string;
  latitude: number;
  longitude: number;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [places, setPlaces] = useState<PlaceSuggestion[] | null>(null);
  const [failed, setFailed] = useState(false);

  async function load() {
    setOpen((v) => !v);
    if (places) return;
    try {
      const params = new URLSearchParams({ lat: String(latitude), lng: String(longitude), exclude: title });
      const r = await fetch(`/api/places/nearby?${params}`);
      setPlaces(r.ok ? (await r.json()).results : []);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={load}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Compass className="size-3.5" aria-hidden="true" /> Explore nearby
      </button>
      {open && (
        <div className="mt-2 rounded-md border bg-card p-2">
          {failed ? (
            <p className="text-xs text-muted-foreground">Couldn&rsquo;t load nearby places. Check your connection.</p>
          ) : !places ? (
            <p className="text-xs text-muted-foreground" role="status">
              Looking around…
            </p>
          ) : !places.length ? (
            <p className="text-xs text-muted-foreground">Nothing notable found within 10 km.</p>
          ) : (
            <ul className="grid gap-1.5" aria-label={`Places near ${title}`}>
              {places.map((p) => (
                <NearbyRow key={`${p.source}-${p.ref}`} place={p} tripId={tripId} itemId={itemId} canEdit={canEdit} />
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">Nearby places from WRLD&rsquo;s official list and Wikipedia.</p>
        </div>
      )}
    </div>
  );
}

function NearbyRow({ place, tripId, itemId, canEdit }: { place: PlaceSuggestion; tripId: string; itemId: string; canEdit: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    (_: ActionState, fd: FormData) => addNearby(tripId, itemId, fd),
    {},
  );
  const km = place.km ?? 0;
  return (
    <li className="flex items-start justify-between gap-2 text-xs">
      <span className="min-w-0">
        <span className="flex items-center gap-1 font-medium">
          {place.source === "official" && <BadgeCheck className="size-3.5 shrink-0 text-primary" aria-label="Official listing" />}
          {place.name}
        </span>
        <span className="block text-muted-foreground">
          {[
            km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`,
            place.detail,
            place.bestSlot ? `${SLOT_LABEL[place.bestSlot]}${place.suggestedStart ? ` from ${formatClock(place.suggestedStart)}` : ""}` : null,
            place.price !== null ? formatMoney(place.price, place.currency ?? "EUR") : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        {state.note && <span className="block text-primary" role="status">{state.note}</span>}
        {state.error && <span className="block text-destructive" role="alert">{state.error}</span>}
      </span>
      {canEdit && !state.ok && (
        <form action={action}>
          <input type="hidden" name="source" value={place.source} />
          <input type="hidden" name="ref" value={place.ref} />
          <input type="hidden" name="title" value={place.name} />
          <Button type="submit" variant="outline" size="icon-xs" disabled={pending} aria-label={`Add ${place.name} to this day`}>
            <Plus aria-hidden="true" />
          </Button>
        </form>
      )}
    </li>
  );
}
