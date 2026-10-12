"use client";

import { BadgeCheck, ExternalLink, MapPin, ThumbsUp, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hostOf } from "@/features/attractions/types";
import { deleteItem, setItemStatus, toggleVote, updateActivityPrice, type ActionState } from "@/features/trips/actions";
import { formatMoney } from "@/lib/format";
import type { ItineraryItem } from "@/types/database";
import { ExploreNearby } from "./explore-nearby";
import { setItemLocation } from "./place-actions";
import { formatClock } from "./schedule";
import { providerOf, track } from "@/lib/track";

const SOURCE_LABEL: Record<string, string> = {
  manual: "Your price",
  estimate: "Looked up",
  provider: "Listed price",
  official: "Official price",
};

export function ItemRow({
  item,
  tripId,
  partySize,
  tripCurrency,
  canEdit,
  votes,
}: {
  votes?: { count: number; mine: boolean };
  item: ItineraryItem;
  tripId: string;
  partySize: number;
  tripCurrency: string;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, priceAction, pending] = useActionState<ActionState, FormData>(
    updateActivityPrice.bind(null, tripId, item.id),
    {},
  );
  const currency = item.currency ?? tripCurrency;
  const qty = item.quantity ?? partySize;
  const sourceLabel = item.provider === "sample" ? "Sample price" : item.price_source ? SOURCE_LABEL[item.price_source] : null;
  const cancelled = item.booking_status === "cancelled";
  const [locState, locAction, locating] = useActionState<ActionState, FormData>(setItemLocation.bind(null, tripId, item.id), {});
  const [fixingPlace, setFixingPlace] = useState(false);
  const time = item.start_time ? `${formatClock(item.start_time.slice(0, 5))}${item.end_time ? `–${formatClock(item.end_time.slice(0, 5))}` : ""}` : null;
  const ticketHost = hostOf(item.booking_url);
  const officialHost = hostOf(item.official_url);

  return (
    <li className={`rounded-md border-l-2 bg-open-soft py-1.5 pr-1.5 pl-2.5 ${cancelled ? "border-muted-foreground opacity-60" : "border-open"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {time && <p className="text-xs font-semibold text-primary">{time}</p>}
          <p className={`flex items-center gap-1 text-sm font-medium ${cancelled ? "line-through" : ""}`}>
            {item.attraction_id && <BadgeCheck className="size-3.5 shrink-0 text-primary" aria-label="Official listing" />}
            {item.title}
          </p>
        </div>
        {canEdit && (
          <form action={deleteItem.bind(null, tripId, item.id)}>
            <Button type="submit" variant="ghost" size="icon-xs" aria-label={`Remove ${item.title}`}>
              <Trash2 aria-hidden="true" />
            </Button>
          </form>
        )}
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {item.unit_price !== null ? (
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => setEditing((v) => !v)}
            className="rounded text-left underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring disabled:no-underline"
            aria-expanded={editing}
          >
            <span className="font-semibold">{formatMoney(item.cost, currency)}</span>{" "}
            <span className="text-muted-foreground">
              {qty} × {formatMoney(item.unit_price, currency)}
              {sourceLabel ? `, ${sourceLabel.toLowerCase()}` : ""}
            </span>
          </button>
        ) : (
          canEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="font-medium text-primary underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
            >
              Add a price
            </button>
          )
        )}

        <form action={toggleVote.bind(null, tripId, item.id, !votes?.mine)}>
          <button
            type="submit"
            aria-pressed={Boolean(votes?.mine)}
            aria-label={`${votes?.mine ? "Remove your vote for" : "Vote for"} ${item.title}${votes?.count ? `, ${votes.count} vote${votes.count > 1 ? "s" : ""}` : ""}`}
            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 focus-visible:outline-2 focus-visible:outline-ring ${
              votes?.mine ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <ThumbsUp className="size-3" aria-hidden="true" />
            {votes?.count ? <span>{votes.count}</span> : null}
          </button>
        </form>

        {canEdit && (
          <form action={setItemStatus.bind(null, tripId, item.id)} className="ml-auto">
            <Label htmlFor={`status-${item.id}`} className="sr-only">
              Status
            </Label>
            <select
              id={`status-${item.id}`}
              name="booking_status"
              defaultValue={item.booking_status}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className="rounded border-0 bg-transparent py-0 text-xs text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <option value="idea">Idea</option>
              <option value="held">On hold</option>
              <option value="booked">Booked</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </form>
        )}
      </div>

      {(item.booking_url || item.official_url) && (
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
          {item.booking_url && (
            <a href={item.booking_url} target="_blank" rel="noopener noreferrer" onClick={() => track({ kind: "booking_click", tripId, provider: item.attraction_id ? "official" : providerOf(item.booking_url) })} className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2">
              {item.attraction_id ? "Official tickets" : "Book"}
              {ticketHost ? <span className="sr-only">on {ticketHost}</span> : null}
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          )}
          {item.official_url && item.official_url !== item.booking_url && (
            <a href={item.official_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted-foreground underline underline-offset-2">
              {officialHost ?? "Official site"}
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          )}
        </p>
      )}
      {item.description && (
        <details className="mt-1 text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">Visit details</summary>
          <p className="mt-1 whitespace-pre-line">{item.description}</p>
        </details>
      )}

      {item.latitude !== null && item.longitude !== null ? (
        item.kind !== "note" && (
          <ExploreNearby
            tripId={tripId}
            itemId={item.id}
            title={item.title}
            latitude={item.latitude}
            longitude={item.longitude}
            canEdit={canEdit}
          />
        )
      ) : (
        canEdit &&
        item.kind !== "note" &&
        item.kind !== "free_time" && (
          <div className="mt-1">
            {fixingPlace ? (
              <form action={locAction} className="flex gap-1.5">
                <Label htmlFor={`where-${item.id}`} className="sr-only">
                  Address for {item.title}
                </Label>
                <Input id={`where-${item.id}`} name="query" placeholder="Address or place name" className="h-7 text-xs" autoFocus />
                <Button type="submit" size="sm" variant="outline" className="h-7 text-xs" disabled={locating}>
                  {locating ? "Finding…" : "Find"}
                </Button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setFixingPlace(true)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <MapPin className="size-3.5" aria-hidden="true" /> Not on the map — add an address
              </button>
            )}
            {locState.error && (
              <p role="alert" className="mt-1 text-xs text-destructive">
                {locState.error}
              </p>
            )}
          </div>
        )
      )}

      {editing && canEdit && (
        <form
          action={(fd) => {
            priceAction(fd);
            setEditing(false);
          }}
          className="mt-2 grid grid-cols-[1fr_4.5rem_auto] items-end gap-2"
        >
          <div className="grid gap-1">
            <Label htmlFor={`price-${item.id}`} className="text-xs">
              Price each ({currency})
            </Label>
            <Input id={`price-${item.id}`} name="unit_price" type="number" min={0} step="0.01" defaultValue={item.unit_price ?? ""} className="h-8" />
          </div>
          <div className="grid gap-1">
            <Label htmlFor={`qty-${item.id}`} className="text-xs">
              Tickets
            </Label>
            <Input id={`qty-${item.id}`} name="quantity" type="number" min={1} max={50} defaultValue={item.quantity ?? partySize} className="h-8" />
          </div>
          <input type="hidden" name="currency" value={currency} />
          <Button type="submit" size="sm" disabled={pending}>
            Save
          </Button>
        </form>
      )}
      {state.error && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {state.error}
        </p>
      )}
    </li>
  );
}
