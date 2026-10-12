"use client";

import { CalendarPlus, MapPin, MessageCircle, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PlaceSearch } from "@/features/attractions/place-search";
import type { PlaceSuggestion } from "@/features/attractions/types";
import { addSpotToItinerary } from "@/features/itinerary/place-actions";
import type { ActionState } from "@/features/trips/actions";
import type { SavedSpot } from "@/types/database";
import { deleteSpot, moveSpot, pinSpot, saveSpot, shareSpotToChat, type SpotState } from "./actions";
import { SpotPreview } from "./spot-card";

type TripOption = { id: string; title: string };
type DayOption = { id: string; label: string };

// ---------------------------------------------------------------------------
export function SaveSpotForm({
  trips,
  tripId,
  initialUrl = "",
  initialNote = "",
  redirectAfter = false,
}: {
  trips?: TripOption[];
  tripId?: string;
  initialUrl?: string;
  initialNote?: string;
  redirectAfter?: boolean;
}) {
  const [state, action, pending] = useActionState<SpotState, FormData>(saveSpot, {});
  const [chosenTrip, setChosenTrip] = useState(tripId ?? trips?.[0]?.id ?? "");
  const [formKey, setFormKey] = useState(0);
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state.ok) setFormKey((k) => k + 1);
  }

  return (
    <form key={formKey} action={action} className="grid gap-3 rounded-xl border bg-card p-4">
      <div className="grid gap-1.5">
        <Label htmlFor="spot-url">Link from TikTok, Instagram, YouTube, Google Maps or anywhere</Label>
        <Input id="spot-url" name="url" defaultValue={initialUrl} placeholder="https://www.tiktok.com/@…/video/…" inputMode="url" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="spot-note">Note (optional)</Label>
        <Textarea id="spot-note" name="note" defaultValue={initialNote} rows={2} placeholder="That sunset spot from the reel" maxLength={1000} />
      </div>
      {trips ? (
        <div className="grid gap-1.5 sm:max-w-sm">
          <Label htmlFor="spot-trip">Save to</Label>
          <NativeSelect id="spot-trip" name="trip_id" value={chosenTrip} onChange={(e) => setChosenTrip(e.target.value)}>
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
            <option value="">Just for me (no trip yet)</option>
          </NativeSelect>
        </div>
      ) : (
        <input type="hidden" name="trip_id" value={tripId ?? ""} />
      )}
      {chosenTrip && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="post_to_chat" defaultChecked /> Also share it in the group chat
        </label>
      )}
      {redirectAfter && <input type="hidden" name="redirect_to_trip" value="1" />}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save spot"}
        </Button>
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
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
export function SpotItem({
  spot,
  savedBy,
  tripId,
  days,
  trips,
  canEdit,
  onItinerary,
}: {
  spot: SavedSpot;
  savedBy?: string;
  tripId?: string;
  days?: DayOption[];
  trips?: TripOption[];
  canEdit: boolean;
  onItinerary?: string | null;
}) {
  const [pinning, setPinning] = useState(false);
  const [pinState, pinAction, pinPending] = useActionState<SpotState, FormData>(pinSpot.bind(null, spot.id), {});
  const [addState, addAction, adding] = useActionState<ActionState, FormData>(
    tripId ? addSpotToItinerary.bind(null, tripId, spot.id) : async () => ({}),
    {},
  );
  const [title, setTitle] = useState(spot.place_name ?? "");
  const [picked, setPicked] = useState<PlaceSuggestion | null>(null);
  const near = spot.latitude !== null && spot.longitude !== null ? { latitude: spot.latitude, longitude: spot.longitude } : null;

  const [handled, setHandled] = useState(pinState);
  if (pinState !== handled) {
    setHandled(pinState);
    if (pinState.ok) setPinning(false);
  }

  return (
    <li id={`spot-${spot.id}`} className="grid scroll-mt-24 gap-3 rounded-xl border bg-card p-3">
      <SpotPreview spot={spot} />
      {spot.note && spot.title && <p className="text-sm">{spot.note}</p>}
      <p className="text-xs text-muted-foreground">
        {savedBy ? `Saved by ${savedBy} · ` : ""}
        {new Date(spot.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        {onItinerary && (
          <>
            {" · "}
            <Link href={`/trips/${tripId}/itinerary`} className="font-medium text-primary underline underline-offset-2">
              On the itinerary: {onItinerary}
            </Link>
          </>
        )}
      </p>

      {pinning ? (
        <form action={pinAction} className="grid gap-2">
          <Label htmlFor={`pin-${spot.id}`} className="text-xs">
            Where is this?
          </Label>
          <PlaceSearch id={`pin-${spot.id}`} value={title} onValueChange={setTitle} picked={picked} onPick={setPicked} near={near} autoFocus />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pinPending}>
              {pinPending ? "Saving…" : "Pin it"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setPinning(false)}>
              Cancel
            </Button>
          </div>
          {pinState.error && (
            <p role="alert" className="text-xs text-destructive">
              {pinState.error}
            </p>
          )}
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && tripId && days && !spot.itinerary_item_id && (
            <form action={addAction} className="flex flex-wrap items-center gap-2">
              <Label htmlFor={`day-${spot.id}`} className="sr-only">
                Day
              </Label>
              <NativeSelect id={`day-${spot.id}`} name="day_id" defaultValue="" className="h-8 w-44 text-xs">
                <option value="">Best day for it</option>
                {days.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </NativeSelect>
              <Button type="submit" size="sm" disabled={adding}>
                <CalendarPlus aria-hidden="true" /> {adding ? "Adding…" : "Add to itinerary"}
              </Button>
            </form>
          )}
          <Button type="button" size="sm" variant="outline" onClick={() => setPinning(true)}>
            <MapPin aria-hidden="true" /> {spot.place_name ? "Change place" : "Pin to a place"}
          </Button>
          {tripId && (
            <form action={shareSpotToChat.bind(null, tripId, spot.id)}>
              <Button type="submit" size="sm" variant="ghost">
                <MessageCircle aria-hidden="true" /> Share in chat
              </Button>
            </form>
          )}
          {trips && (
            <form action={moveSpot.bind(null, spot.id)} className="flex items-center gap-1">
              <Label htmlFor={`move-${spot.id}`} className="sr-only">
                Move to trip
              </Label>
              <NativeSelect
                id={`move-${spot.id}`}
                name="trip_id"
                defaultValue=""
                className="h-8 w-40 text-xs"
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
              >
                <option value="" disabled>
                  Move to a trip…
                </option>
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </NativeSelect>
            </form>
          )}
          <form action={deleteSpot.bind(null, spot.id)} className="ml-auto">
            <Button type="submit" size="icon-sm" variant="ghost" aria-label="Remove this spot">
              <Trash2 aria-hidden="true" />
            </Button>
          </form>
        </div>
      )}
      {(addState.note || addState.error) && (
        <p role={addState.error ? "alert" : "status"} className={`text-xs ${addState.error ? "text-destructive" : "text-muted-foreground"}`}>
          {addState.error ?? addState.note}
        </p>
      )}
    </li>
  );
}
