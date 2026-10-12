"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

const TABS = [
  { slug: "itinerary", label: "Itinerary" },
  { slug: "map", label: "Map" },
  { slug: "transit", label: "Flights & trains" },
  { slug: "lodging", label: "Stays" },
  { slug: "budget", label: "Budget" },
];

export function TripTabs() {
  const pathname = usePathname();
  const { tripId } = useParams<{ tripId: string }>();
  return (
    <nav aria-label="Trip sections" className="flex gap-1 overflow-x-auto border-b">
      {TABS.map(({ slug, label }) => {
        const href = `/trips/${tripId}/${slug}`;
        const active = pathname.startsWith(href);
        return (
          <Link
            key={slug}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm whitespace-nowrap focus-visible:outline-2 focus-visible:outline-ring ${
              active ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
