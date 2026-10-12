"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

const TABS = [
  { slug: "itinerary", label: "Itinerary" },
  { slug: "map", label: "Map" },
  { slug: "group", label: "Group" },
  { slug: "saved", label: "Saved" },
  { slug: "transit", label: "Getting around" },
  { slug: "lodging", label: "Stays" },
  { slug: "budget", label: "Budget" },
  { slug: "checklist", label: "Checklist" },
];

export function TripTabs({ unread = 0 }: { unread?: number }) {
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
            {slug === "group" && unread > 0 && !active && (
              <span className="ml-1.5 inline-grid min-w-5 place-items-center rounded-full bg-travel px-1.5 text-[11px] font-semibold text-travel-foreground">
                {unread > 99 ? "99+" : unread}
                <span className="sr-only"> unread messages</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
