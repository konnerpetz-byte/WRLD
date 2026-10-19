"use client";

import { BadgeCheck, Clock, ExternalLink, Globe, MapPin, Ticket } from "lucide-react";
import { useRef, useState } from "react";

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
  city,
  placeholder = "Sintra, Neuschwanstein, a museum…",
  autoFocus,
}: {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  picked: PlaceSuggestion | null;
  onPick: (place: PlaceSuggestion | null) => void;
  near: Point;
  /** The day's city: turns on bookable tours (Viator) and GetYourGuide/Viator search links. */
  city?: string | null;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  // What was typed when the current suggestions came back: the server finds a picked tour again with it.
  const lastQuery = useRef("");
  const [pickedQuery, setPickedQuery] = useState("");
  const [links, setLinks] = useState<{ q: string; items: { label: string; url: string }[] }>({ q: "", items: [] });
  const typed = value.trim();
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
          if (city) params.set("city", city);
          const r = await fetch(`/api/places/search?${params}`, { signal });
          if (!r.ok) return [];
          const data = (await r.json()) as { results: PlaceSuggestion[]; links?: { label: string; url: string }[] };
          lastQuery.current = q;
          setLinks({ q, items: data.links ?? [] });
          return data.results;
        }}
        optionKey={(o) => `${o.source}-${o.ref}`}
        renderOption={(o) => <SuggestionLine place={o} />}
        onPick={(o) => {
          setPickedQuery(lastQuery.current);
          onValueChange(o.name);
          onPick(o);
        }}
        listClassName="min-w-72"
      />
      <input type="hidden" name="source" value={picked?.source ?? ""} />
      <input type="hidden" name="ref" value={picked?.ref ?? ""} />
      <input type="hidden" name="search_q" value={picked?.source === "viator" ? pickedQuery : ""} />
      {picked && <PickedCard place={picked} />}
      {!picked && typed.length >= 3 && links.items.length > 0 && links.q.trim() === typed && (
        <p className="text-xs text-muted-foreground">
          Not seeing it? Tours for &ldquo;{typed}&rdquo; near {city}:{" "}
          {links.items.map((l, i) => (
            <span key={l.label}>
              {i > 0 && " or "}
              <a href={l.url} target="_blank" rel="noopener noreferrer sponsored" className="font-medium text-primary underline underline-offset-2">
                {l.label}
              </a>
            </span>
          ))}
          . Or press Add to save it as your own plan. WRLD may earn a commission on tour links.
        </p>
      )}
    </div>
  );
}

function SuggestionLine({ place }: { place: PlaceSuggestion }) {
  return (
    <span className="grid gap-0.5">
      <span className="flex items-center gap-1.5 font-medium">
        {place.source === "official" ? (
          <BadgeCheck className="size-3.5 shrink-0 text-primary" aria-label="Official listing" />
        ) : place.source === "viator" ? (
          <Ticket className="size-3.5 shrink-0 text-muted-foreground" aria-label="Bookable tour" />
        ) : place.source === "osm" ? (
          <MapPin className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
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
          place.price !== null ? `${place.source === "viator" ? "from " : ""}${formatMoney(place.price, place.currency ?? "USD")}` : null,
          place.source === "osm" && place.km != null ? (place.km < 1 ? `${Math.round(place.km * 1000)} m away` : `${place.km} km away`) : null,
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
  if (place.source === "viator") {
    return (
      <div className="grid gap-1 rounded-md border border-primary/30 bg-open-soft p-2.5 text-xs">
        <p className="flex items-center gap-1.5 font-medium text-foreground">
          <Ticket className="size-3.5" aria-hidden="true" />
          Tour sold on Viator{place.price !== null ? `, from ${formatMoney(place.price, place.currency ?? "USD")} each` : ""}
        </p>
        <p className="text-muted-foreground">
          A reseller, not the tour company&rsquo;s own site. Prices are often the same; check the operator&rsquo;s site before you book.
          WRLD may earn a commission.
        </p>
        {place.ticketsUrl && (
          <a
            href={place.ticketsUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-flex w-fit items-center gap-1 font-medium text-primary underline underline-offset-2"
          >
            See it on Viator
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        )}
      </div>
    );
  }
  if (place.source === "osm") {
    return (
      <div className="grid gap-1 rounded-md border border-primary/30 bg-open-soft p-2.5 text-xs">
        <p className="flex items-center gap-1.5 font-medium text-foreground">
          <MapPin className="size-3.5" aria-hidden="true" />
          {place.address ?? place.detail ?? "Place from OpenStreetMap"}
        </p>
        <p className="text-muted-foreground">Free to visit, or price not listed. Add a price if you&rsquo;ll spend money there.</p>
      </div>
    );
  }
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
          {formatMoney(place.price, place.currency ?? "USD")} per adult{place.priceNote ? ` — ${place.priceNote}` : ""}
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
