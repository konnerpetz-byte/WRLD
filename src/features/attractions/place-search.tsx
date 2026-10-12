"use client";

import { BadgeCheck, Clock, ExternalLink, Globe } from "lucide-react";

import { Autocomplete } from "@/components/autocomplete";
import { formatClock } from "@/features/itinerary/schedule";
import { formatMoney } from "@/lib/format";
import { hostOf, SLOT_LABEL, type PlaceSuggestion } from "./types";

type Point = { latitude: number; longitude: number } | null;

/** Search box that matches what you type to the official listing. */
export function PlaceSearch({
  id,
  value,
  onValueChange,
  picked,
  onPick,
  near,
  placeholder = "Sintra, Neuschwanstein, a museum…",
  autoFocus,
}: {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  picked: PlaceSuggestion | null;
  onPick: (place: PlaceSuggestion | null) => void;
  near: Point;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <Autocomplete<PlaceSuggestion>
        id={id}
        name="title"
        value={value}
        required
        autoFocus={autoFocus}
        placeholder={placeholder}
        onValueChange={(v) => {
          onValueChange(v);
          if (picked && v !== picked.name) onPick(null);
        }}
        fetchOptions={async (q, signal) => {
          const params = new URLSearchParams({ q });
          if (near) {
            params.set("lat", String(near.latitude));
            params.set("lng", String(near.longitude));
          }
          const r = await fetch(`/api/places/search?${params}`, { signal });
          return r.ok ? ((await r.json()).results as PlaceSuggestion[]) : [];
        }}
        optionKey={(o) => `${o.source}-${o.ref}`}
        renderOption={(o) => <SuggestionLine place={o} />}
        onPick={(o) => {
          onValueChange(o.name);
          onPick(o);
        }}
        listClassName="min-w-72"
      />
      <input type="hidden" name="source" value={picked?.source ?? ""} />
      <input type="hidden" name="ref" value={picked?.ref ?? ""} />
      {picked && <PickedCard place={picked} />}
    </div>
  );
}

function SuggestionLine({ place }: { place: PlaceSuggestion }) {
  return (
    <span className="grid gap-0.5">
      <span className="flex items-center gap-1.5 font-medium">
        {place.source === "official" ? (
          <BadgeCheck className="size-3.5 shrink-0 text-primary" aria-label="Official listing" />
        ) : (
          <Globe className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        {place.name}
      </span>
      <span className="text-xs text-muted-foreground">
        {[
          place.detail,
          place.source === "official" && place.bestSlot
            ? `${SLOT_LABEL[place.bestSlot]}${place.suggestedStart ? ` from ${formatClock(place.suggestedStart)}` : ""}`
            : null,
          place.price !== null ? formatMoney(place.price, place.currency ?? "EUR") : null,
          place.source !== "official" && place.officialUrl ? hostOf(place.officialUrl) : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>
    </span>
  );
}

function PickedCard({ place }: { place: PlaceSuggestion }) {
  const official = place.source === "official";
  return (
    <div className="grid gap-1 rounded-md border border-primary/30 bg-open-soft p-2.5 text-xs">
      <p className="flex items-center gap-1.5 font-medium text-foreground">
        {official ? <BadgeCheck className="size-3.5 text-primary" aria-hidden="true" /> : <Globe className="size-3.5" aria-hidden="true" />}
        {official ? "Official listing" : "Official website from Wikidata"}
      </p>
      {official && (place.bestSlot || place.timedEntry) && (
        <p className="flex items-center gap-1.5">
          <Clock className="size-3.5" aria-hidden="true" />
          {[
            place.bestSlot && `Best in the ${SLOT_LABEL[place.bestSlot].toLowerCase()}${place.suggestedStart ? `, from ${formatClock(place.suggestedStart)}` : ""}`,
            place.durationMinutes && `about ${Math.round(place.durationMinutes / 30) / 2} hr`,
            place.timedEntry && "timed entry",
          ]
            .filter(Boolean)
            .join(", ")}
        </p>
      )}
      {place.price !== null && (
        <p>
          {formatMoney(place.price, place.currency ?? "EUR")} per adult{place.priceNote ? ` — ${place.priceNote}` : ""}
        </p>
      )}
      {place.hoursNote && <p className="text-muted-foreground">{place.hoursNote}</p>}
      {(place.ticketsUrl || place.officialUrl) && (
        <a
          href={place.ticketsUrl ?? place.officialUrl!}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-1 font-medium text-primary underline underline-offset-2"
        >
          {place.ticketsUrl ? "Official tickets" : "Official site"}: {hostOf(place.ticketsUrl ?? place.officialUrl)}
          <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      )}
      {!official && <p className="text-muted-foreground">No hours or price on file — the time is a suggestion.</p>}
    </div>
  );
}
