"use client";

import { Plane } from "lucide-react";

import { providerOf, track } from "@/lib/track";

/** "Live fares: Aviasales · Google Flights" for this route, these dates and this group. */
export function FlightRow({ links }: { links: { label: string; url: string }[] }) {
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
      <Plane className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="text-muted-foreground">Live fares:</span>
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
            rel="noopener noreferrer sponsored"
            onClick={() => track({ kind: "booking_click", provider: providerOf(l.url) })}
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
