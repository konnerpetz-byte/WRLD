"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// The six things every group trip needs, in the order it comes together: the plan, the people,
// the money, the days, getting there and staying. Everything else sits under More, so the row
// fits a phone without scrolling past things most trips never open.
const TABS = [
  { slug: "", label: "Overview" },
  { slug: "group", label: "Group" },
  { slug: "budget", label: "Budget" },
  { slug: "itinerary", label: "Itinerary" },
  { slug: "transit", label: "Flights" },
  { slug: "lodging", label: "Stays" },
];
const MORE = [
  { slug: "map", label: "Map" },
  { slug: "points", label: "Pay with points" },
  { slug: "saved", label: "Saved ideas" },
  { slug: "checklist", label: "Checklist" },
  { slug: "import", label: "Import bookings" },
  { slug: "export", label: "Export and share" },
];

export function TripTabs({ unread = 0 }: { unread?: number }) {
  const pathname = usePathname();
  const { tripId } = useParams<{ tripId: string }>();
  const navRef = useRef<HTMLDivElement>(null);
  // On phones the row scrolls: keep the current tab in view so you always know where you are.
  useEffect(() => {
    navRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);
  return (
    // The menu sits outside the scrolling row so its list isn't clipped by it.
    <nav aria-label="Trip sections" className="relative flex border-b">
      <div ref={navRef} className="edge-fade-x flex min-w-0 flex-1 scroll-px-4 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
      </div>
      <MoreTabs tripId={tripId} pathname={pathname} />
    </nav>
  );
}

/** The less-used trip pages, in a small menu at the end of the tab row. */
function MoreTabs({ tripId, pathname }: { tripId: string; pathname: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const current = MORE.find(({ slug }) => pathname.startsWith(`/trips/${tripId}/${slug}`));
  // Close after navigating, or on a click anywhere else.
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  return (
    <details ref={ref} className="group static shrink-0">
      <summary
        aria-current={current ? "page" : undefined}
        className={`-mb-px flex cursor-pointer list-none items-center gap-1 border-b-2 px-4 py-2.5 text-sm whitespace-nowrap focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden ${
          current ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        {current ? current.label : "More"}
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <ul className="absolute right-0 z-30 mt-1 grid min-w-52 gap-0.5 rounded-xl border bg-popover p-1.5 shadow-lg">
        {MORE.map(({ slug, label }) => {
          const href = `/trips/${tripId}/${slug}`;
          const active = pathname.startsWith(href);
          return (
            <li key={slug}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-lg px-3 py-2 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring ${active ? "font-medium text-foreground" : "text-muted-foreground"}`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
