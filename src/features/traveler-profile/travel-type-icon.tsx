import { cn } from "@/lib/utils";
import type { TravelArchetype } from "@/types/database";

/**
 * One icon per travel type, drawn in the same 24px line style as the rest
 * of the app (2px stroke, round caps).
 *   Itinerary Athlete — stopwatch with a tick: a full, timed day
 *   Flâneur           — a café cup: slow mornings, side streets
 *   Trailblazer       — a summit flag: elevation gained
 *   Sunset Collector  — sun on the horizon: golden hour
 *   Wildcard          — a wild card: a little of everything
 */
export const TYPE_PATHS: Record<TravelArchetype, string[]> = {
  itinerary_athlete: ["M10 2h4", "M12 2v3", "M19 6.5l1.5-1.5", "M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z", "M8.5 13.5l2.5 2.5 4.5-5"],
  flaneur: ["M8 2.5c-1 1.2 1 2.3 0 3.5", "M12 2.5c-1 1.2 1 2.3 0 3.5", "M4 9h12v4.5A5.5 5.5 0 0 1 10.5 19h-1A5.5 5.5 0 0 1 4 13.5z", "M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16", "M3 21.5h15"],
  trailblazer: ["M2 21l7-11 4 6 3-4 6 9z", "M9 10V3", "M9 3l4.5 1.6L9 6.2"],
  sunset_collector: ["M2 17h20", "M6 17a6 6 0 0 1 12 0", "M12 5V3", "M5 10L3.6 8.6", "M19 10l1.4-1.4", "M6 20.5h12"],
  wildcard: ["M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z", "M12 8l1.2 2.5 2.7.4-2 1.9.5 2.7L12 14.2l-2.4 1.3.5-2.7-2-1.9 2.7-.4z"],
};

/** Badge colors follow the compass quadrants. */
const BADGE: Record<TravelArchetype, string> = {
  itinerary_athlete: "bg-primary text-primary-foreground",
  trailblazer: "bg-brand text-brand-cream",
  flaneur: "bg-sidebar text-sidebar-foreground",
  sunset_collector: "bg-travel text-travel-foreground",
  wildcard: "bg-brand-cream text-sidebar",
};

export function TravelTypeIcon({
  type,
  className,
  title,
}: {
  type: TravelArchetype;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-5", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      {TYPE_PATHS[type].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** Round badge with the icon, for headers and result screens. */
export function TravelTypeBadge({ type, size = 64, className }: { type: TravelArchetype; size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center rounded-full", BADGE[type], className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <TravelTypeIcon type={type} className="size-[55%]" />
    </span>
  );
}
