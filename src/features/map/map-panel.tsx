"use client";

import { LocateFixed, MapPin } from "lucide-react";
import { useActionState, useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setItemLocation } from "@/features/itinerary/place-actions";
import type { ActionState } from "@/features/trips/actions";
import { distanceKm, formatDistance } from "@/lib/geo";
import { currentLocation } from "@/lib/native";
import type { MapDay } from "./build-stops";
import { TripMap } from "./trip-map";

export function MapPanel({
  tripId,
  days,
  center,
  unit,
  canEdit,
}: {
  tripId: string;
  days: MapDay[];
  center: [number, number] | null;
  unit: "km" | "mi";
  canEdit: boolean;
}) {
  const firstWithStops = Math.max(0, days.findIndex((d) => d.stops.some((s) => s.kind === "activity")));
  const [selected, setSelected] = useState(firstWithStops);
  const [activeStopId, setActiveStopId] = useState<string | null>(null);
  const onSelectStop = useCallback((id: string) => setActiveStopId(id), []);
  const [me, setMe] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locNote, setLocNote] = useState<string | null>(null);

  async function locate() {
    setLocating(true);
    setLocNote(null);
    const r = await currentLocation();
    setLocating(false);
    if (!r.ok) {
      setLocNote(
        r.reason === "denied"
          ? "Location is off for WRLD. Turn it on in your phone's settings to see where you are."
          : "Couldn't find your location. Try again outside or near a window.",
      );
      return;
    }
    setMe({ latitude: r.latitude, longitude: r.longitude });
    const nearest = days[selected]?.stops.reduce<{ title: string; km: number } | null>((best, s) => {
      const km = distanceKm(r, s);
      return !best || km < best.km ? { title: s.title, km } : best;
    }, null);
    if (nearest) setLocNote(`${formatDistance(nearest.km, unit)} from ${nearest.title}`);
  }
  const day = days[selected];

  return (
    <div className="grid gap-4">
      <div role="tablist" aria-label="Days" className="flex gap-2 overflow-x-auto pb-1">
        {days.map((d, i) => (
          <button
            key={d.dayId}
            role="tab"
            type="button"
            aria-selected={i === selected}
            onClick={() => {
              setSelected(i);
              setActiveStopId(null);
            }}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
              i === selected ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary"
            }`}
          >
            {d.label}
            {d.city && <span className="ml-1 opacity-75">· {d.city}</span>}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <aside className="order-2 grid content-start gap-4 lg:order-1" aria-label={`${day?.label ?? ""} stops`}>
          {day && (
            <>
              <div className="flex items-baseline justify-between">
                <h2 className="text-xl font-semibold">{day.label}</h2>
                {day.km > 0 && (
                  <span className="text-sm text-muted-foreground">{formatDistance(day.km, unit)} between stops</span>
                )}
              </div>
              {day.stops.length === 0 ? (
                <p className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
                  Nothing on the map for this day yet. Add activities on the Itinerary tab and they&rsquo;ll appear here.
                </p>
              ) : (
                <ol className="grid gap-2">
                  {day.stops.map((stop) => (
                    <li key={stop.id}>
                      <button
                        type="button"
                        onClick={() => setActiveStopId(stop.id)}
                        aria-current={stop.id === activeStopId ? "true" : undefined}
                        className={`flex w-full items-start gap-3 rounded-lg border bg-card p-3 text-left hover:border-primary focus-visible:outline-2 focus-visible:outline-ring ${
                          stop.id === activeStopId ? "border-primary" : ""
                        }`}
                      >
                        <span
                          className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                            stop.kind === "activity"
                              ? "bg-brand text-brand-cream"
                              : stop.kind === "stay"
                                ? "bg-sidebar text-sidebar-foreground"
                                : "bg-travel text-travel-foreground"
                          }`}
                          aria-hidden="true"
                        >
                          {stop.number ?? (stop.kind === "stay" ? "◆" : stop.kind === "arrive" ? "↓" : "↑")}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-medium">{stop.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">{stop.detail}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}

              {day.unplaced.length > 0 && (
                <section aria-labelledby="unplaced" className="rounded-xl border border-travel bg-travel-soft p-3">
                  <h3 id="unplaced" className="mb-2 text-sm font-semibold">
                    Not on the map yet
                  </h3>
                  <ul className="grid gap-3">
                    {day.unplaced.map((u) => (
                      <li key={u.id} className="grid gap-1.5">
                        <span className="text-sm">
                          {u.title} <span className="text-muted-foreground">({u.detail})</span>
                        </span>
                        {canEdit && <LocateForm tripId={tripId} itemId={u.id} title={u.title} />}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <div className="grid gap-1.5">
                <Button type="button" variant="outline" onClick={locate} disabled={locating}>
                  <LocateFixed aria-hidden="true" /> {locating ? "Finding you…" : "Show where I am"}
                </Button>
                {locNote && (
                  <p role="status" className="text-sm text-muted-foreground">
                    {locNote}
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Distances are straight lines between stops, not walking or driving routes.
              </p>
            </>
          )}
        </aside>

        <div className="order-1 h-[60vh] min-h-[420px] lg:order-2 lg:h-[calc(100dvh-20rem)]">
          <TripMap
            days={days}
            selected={selected}
            activeStopId={activeStopId}
            onSelectStop={onSelectStop}
            center={center}
            label={`Map of ${day?.label ?? "the trip"}`}
            dayCenter={day?.center ?? null}
            me={me}
          />
        </div>
      </div>
    </div>
  );
}

function LocateForm({ tripId, itemId, title }: { tripId: string; itemId: string; title: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(setItemLocation.bind(null, tripId, itemId), {});
  return (
    <form action={action} className="grid gap-1">
      <div className="flex gap-2">
        <label htmlFor={`q-${itemId}`} className="sr-only">
          Place name or address for {title}
        </label>
        <Input id={`q-${itemId}`} name="query" placeholder="Address or name (optional)" className="h-8 bg-card" />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          <MapPin aria-hidden="true" /> {pending ? "Finding…" : "Find"}
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
