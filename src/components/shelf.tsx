"use client";

import { ChevronRight } from "lucide-react";
import { Children, type ReactNode, useId, useRef, useState } from "react";

/**
 * A titled row of cards, the way the App Store shows lists.
 *   Phone: one row you swipe sideways, every card in it, with the next card peeking in so it's
 *   obvious there's more. "See all" turns it into a vertical list.
 *   Tablet and up: a grid showing the first six; "See all" shows the rest.
 * The cards are <li> elements rendered on the server.
 */
export function Shelf({
  title,
  subtitle,
  children,
  first = 6,
  tone = "default",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  first?: 6;
  tone?: "default" | "muted";
}) {
  const [all, setAll] = useState(false);
  const id = useId();
  const top = useRef<HTMLElement>(null);
  const count = Children.count(children);
  if (!count) return null;
  const more = count > 1;
  const moreOnWide = count > first;

  const toggle = () => {
    setAll(!all);
    // Collapsing a long list: bring its title back into view so nobody is left mid-page.
    if (all) top.current?.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  return (
    <section ref={top} aria-labelledby={`${id}-h`} className="grid scroll-mt-20 gap-3">
      <div className="flex items-end justify-between gap-4 px-1">
        <div className="min-w-0">
          <h3 id={`${id}-h`} className={`text-[17px] font-semibold leading-tight tracking-[-0.01em] ${tone === "muted" ? "text-muted-foreground" : ""}`}>
            {title}
          </h3>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {more && (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={all}
            aria-controls={`${id}-list`}
            className={`tap inline-flex shrink-0 items-center gap-0.5 rounded-md text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring ${
              moreOnWide ? "" : "sm:hidden"
            }`}
          >
            {all ? "Show less" : `See all ${count}`}
            {!all && <ChevronRight className="size-4" aria-hidden="true" />}
          </button>
        )}
      </div>
      <ul
        id={`${id}-list`}
        className={
          all
            ? "relative grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            : // Phone: a sideways row that snaps card to card, edge to edge. Wider: the first six in a grid.
              // `relative` keeps hidden screen-reader text inside the row, so off-screen cards can't widen the page.
              "relative -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>li]:w-[82%] [&>li]:shrink-0 [&>li]:snap-start sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 sm:[&>li]:w-auto lg:grid-cols-3 sm:[&>li:nth-child(n+7)]:hidden"
        }
      >
        {children}
      </ul>
      {all && count > 4 && (
        <button
          type="button"
          onClick={toggle}
          className="tap mx-auto rounded-full border px-4 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
        >
          Show less
        </button>
      )}
    </section>
  );
}
