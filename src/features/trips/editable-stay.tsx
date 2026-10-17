"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { Lodging } from "@/types/database";
import { LodgingForm } from "./lodging-form";

/** A stay card with its own Edit button; editing swaps the card for a prefilled form. */
export function EditableStay({
  stay,
  tripId,
  tripCurrency,
  startDate,
  endDate,
  timezone,
  canEdit,
  children,
  actions,
}: {
  stay: Lodging;
  tripId: string;
  tripCurrency: string;
  startDate: string;
  endDate: string;
  timezone: string;
  canEdit: boolean;
  children: React.ReactNode;
  /** Remove button and the like, shown next to Edit */
  actions?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <li>
        <LodgingForm
          tripId={tripId}
          tripCurrency={tripCurrency}
          startDate={startDate}
          endDate={endDate}
          stay={stay}
          timezone={timezone}
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }
  return (
    <li className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_auto]">
      {children}
      {canEdit && (
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)} aria-label={`Edit ${stay.name}`}>
            <Pencil aria-hidden="true" /> Edit stay
          </Button>
          {actions}
        </div>
      )}
    </li>
  );
}
