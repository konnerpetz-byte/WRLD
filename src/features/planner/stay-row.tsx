"use client";

import { BedDouble } from "lucide-react";

import { providerOf, track } from "@/lib/track";

import { stayLinks } from "./stay-links";

/** "Live stays: Airbnb · Booking.com · Google Hotels", searched for this place, these dates and this group. */
export function StayRow({ place, checkIn, nights, people }: { place: string; checkIn: string; nights: number; people: number }) {
  const links = stayLinks(place, checkIn, nights, people);
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
      <BedDouble className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="text-muted-foreground">Live stays:</span>
      {links.map((l, i) => (
        <span key={l.label} className="inline-flex items-center gap-1.5">
          {i > 0 && (
            <span className="text-muted-foreground" aria-hidden="true">
              ·
            </span>
          )}
          <a
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track({ kind: "stay_click", provider: providerOf(l.url) })}
            className="tap font-medium text-primary hover:underline"
          >
            {l.label}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </span>
      ))}
    </p>
  );
}
