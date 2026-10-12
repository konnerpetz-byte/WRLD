"use client";

import { BadgeCheck, ChevronLeft, ChevronRight, ExternalLink, Lightbulb } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import type { Recommendation } from "./recommend";

export function RecommendationCarousel({ items, subtitle }: { items: Recommendation[]; subtitle: string }) {
  const track = useRef<HTMLUListElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = track.current;
    if (el) el.scrollBy({ left: dir * Math.max(280, el.clientWidth * 0.8), behavior: "smooth" });
  };

  return (
    <section aria-labelledby="recs-h" className="grid gap-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id="recs-h" className="text-2xl font-semibold">
            Recommendations based on your travel type
          </h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="hidden gap-2 sm:flex">
          <Button type="button" variant="outline" size="icon-sm" onClick={() => scroll(-1)} aria-label="Previous recommendations">
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button type="button" variant="outline" size="icon-sm" onClick={() => scroll(1)} aria-label="More recommendations">
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>

      <ul
        ref={track}
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-3 sm:-mx-1 sm:px-1"
        aria-label="Recommendations"
      >
        {items.map((r) => (
          <li key={r.key} className="w-[17.5rem] shrink-0 snap-start">
            <article className="flex h-full flex-col gap-3 rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                    r.kind === "official" ? "bg-open-soft text-primary" : "bg-travel-soft text-travel-foreground"
                  }`}
                >
                  {r.kind === "official" ? <BadgeCheck className="size-3.5" aria-hidden="true" /> : <Lightbulb className="size-3.5" aria-hidden="true" />}
                  {r.kind === "official" ? "Official sight" : "Idea"}
                </span>
                <span className="text-muted-foreground">{r.score >= 70 ? "Great fit" : r.score >= 50 ? "Good fit" : "Worth a look"}</span>
              </div>
              <div className="grid gap-1">
                <h3 className="text-lg leading-snug font-semibold">{r.title}</h3>
                {r.kind === "official" && r.city && <p className="text-xs text-muted-foreground">{r.city}</p>}
              </div>
              <p className="line-clamp-3 text-sm text-muted-foreground">{r.blurb}</p>
              <p className="text-sm font-medium text-primary">{r.why}</p>
              <div className="mt-auto grid gap-2">
                {r.price && <p className="text-xs text-muted-foreground">From {formatMoney(r.price.amount, r.price.currency)} per adult</p>}
                <Button asChild size="sm">
                  <Link href={r.href}>{r.action}</Link>
                </Button>
                {r.externalHref && (
                  <a
                    href={r.externalHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1 text-xs text-muted-foreground underline underline-offset-2"
                  >
                    Official site <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                )}
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
