"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { TransitSegment } from "@/types/database";
import { TransitForm } from "./transit-form";

/** A leg card with its own Edit button; editing swaps the card for a prefilled form. */
export function EditableLeg({
  leg,
  tripId,
  tripTimezone,
  tripCurrency,
  timezones,
  canEdit,
  label,
  children,
}: {
  leg: TransitSegment;
  tripId: string;
  tripTimezone: string;
  tripCurrency: string;
  timezones: string[];
  canEdit: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <li>
        <TransitForm tripId={tripId} tripTimezone={tripTimezone} tripCurrency={tripCurrency} timezones={timezones} leg={leg} onDone={() => setEditing(false)} />
      </li>
    );
  }
  return (
    <li className="perforated grid gap-3 rounded-xl border bg-card p-4 pl-6 sm:grid-cols-[1fr_auto]">
      {children}
      {canEdit && (
        <div className="sm:col-span-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)} aria-label={`Edit ${label}`}>
            <Pencil aria-hidden="true" /> Edit leg
          </Button>
        </div>
      )}
    </li>
  );
}
