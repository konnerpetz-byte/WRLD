"use client";

import { MapPin } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { locateItem } from "@/features/trips/actions";
import { formatDistance } from "@/lib/geo";
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
                        {canEdit && (
                          <form action={locateItem.bind(null, tripId, u.id)} className="flex gap-2">
                            <label htmlFor={`q-${u.id}`} className="sr-only">
                              Place name or address for {u.title}
                            </label>
                            <Input id={`q-${u.id}`} name="query" placeholder="Name or address (optional)" className="h-8 bg-card" />
                            <Button type="submit" size="sm" variant="outline">
                              <MapPin aria-hidden="true" /> Find
                            </Button>
                          </form>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
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
          />
        </div>
      </div>
    </div>
  );
}
