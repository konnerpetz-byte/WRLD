"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteItem, setItemStatus, updateActivityPrice, type ActionState } from "@/features/trips/actions";
import { formatMoney } from "@/lib/format";
import type { ItineraryItem } from "@/types/database";

const SOURCE_LABEL: Record<string, string> = {
  manual: "Your price",
  estimate: "Looked up",
  provider: "Listed price",
};

export function ItemRow({
  item,
  tripId,
  partySize,
  tripCurrency,
  canEdit,
}: {
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

  return (
    <li className={`rounded-md border-l-2 bg-open-soft py-1.5 pr-1.5 pl-2.5 ${cancelled ? "border-muted-foreground opacity-60" : "border-open"}`}>
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm font-medium ${cancelled ? "line-through" : ""}`}>{item.title}</p>
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
