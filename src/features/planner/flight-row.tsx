"use client";

import { ExternalLink, Plane } from "lucide-react";

import { providerOf, track } from "@/lib/track";

/** A clear button to today's fares for this route, these dates and this group. */
export function FlightRow({ links }: { links: { label: string; url: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {links.map((l) => (
        <a
          key={l.label}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={() => track({ kind: "booking_click", provider: providerOf(l.url) })}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 text-sm font-medium text-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Plane className="size-4 shrink-0" aria-hidden="true" />
          {l.label === "Aviasales" ? "Check today’s fares on Aviasales" : "Check today’s fares for these dates"}
          <ExternalLink className="size-3.5 shrink-0 opacity-70" aria-hidden="true" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ))}
    </div>
  );
}
