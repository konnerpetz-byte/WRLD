"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// In the order a trip comes together: the overview, the days and where they are,
// getting there and staying, paying for it (points, then the whole budget), the people,
// ideas saved for later, and getting ready to go (checklist and export).
const TABS = [
  { slug: "", label: "Overview" },
  { slug: "itinerary", label: "Itinerary" },
  { slug: "map", label: "Map" },
  { slug: "transit", label: "Flights & transit" },
  { slug: "lodging", label: "Stays" },
  { slug: "points", label: "Points" },
  { slug: "budget", label: "Budget" },
  { slug: "group", label: "Group" },
  { slug: "saved", label: "Saved" },
  { slug: "checklist", label: "Checklist" },
  { slug: "export", label: "Export" },
];

export function TripTabs({ unread = 0 }: { unread?: number }) {
  const pathname = usePathname();
  const { tripId } = useParams<{ tripId: string }>();
  const navRef = useRef<HTMLElement>(null);
  // On phones the row scrolls: keep the current tab in view so you always know where you are.
  useEffect(() => {
    navRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);
  return (
    <nav ref={navRef} aria-label="Trip sections" className="edge-fade-x flex scroll-px-4 gap-1 overflow-x-auto border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {TABS.map(({ slug, label }) => {
        const href = slug ? `/trips/${tripId}/${slug}` : `/trips/${tripId}`;
        const active = slug ? pathname.startsWith(href) : pathname === href;
        return (
          <Link
            key={slug || "plan"}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ${
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
