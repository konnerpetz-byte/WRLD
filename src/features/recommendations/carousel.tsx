"use client";

import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Lightbulb,
  Star,
  Ticket,
} from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { addOfferToTrip } from "@/features/itinerary/place-actions";
import { AddNamedPlaceRow, AddSightButton } from "@/features/itinerary/quick-add";
import type { ActionState } from "@/features/trips/actions";
import { formatDuration, formatMoney } from "@/lib/format";
import { providerOf, track as trackEvent } from "@/lib/track";
import type { Recommendation } from "./recommend";

const BADGE = {
  official: {
    label: "Official sight",
    icon: BadgeCheck,
    className: "bg-open-soft text-primary",
  },
  idea: {
    label: "Idea",
    icon: Lightbulb,
    className: "bg-travel-soft text-travel-foreground",
  },
  bookable: {
    label: "Bookable",
    icon: Ticket,
    className: "bg-primary text-primary-foreground",
  },
} as const;

export function RecommendationCarousel({
  items,
  subtitle,
  links = [],
  sample = false,
}: {
  items: Recommendation[];
  subtitle: string;
  links?: { label: string; url: string }[];
  sample?: boolean;
}) {
  const track = useRef<HTMLUListElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = track.current;
    if (el)
      el.scrollBy({
        left: dir * Math.max(280, el.clientWidth * 0.8),
        behavior: "smooth",
      });
  };
  const hasBookable = items.some((i) => i.kind === "bookable");
  const bookableCount = items.filter((i) => i.kind === "bookable").length;
  useEffect(() => {
    if (bookableCount) trackEvent({ kind: "suggestions_shown", count: bookableCount });
  }, [bookableCount]);

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
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => scroll(-1)}
            aria-label="Previous recommendations"
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => scroll(1)}
            aria-label="More recommendations"
          >
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
            <Card r={r} />
          </li>
        ))}
      </ul>

      {(links.length > 0 || hasBookable) && (
        <p className="text-xs text-muted-foreground">
          {links.length > 0 && (
            <>
              Browse more on{" "}
              {links.map((l, i) => (
                <span key={l.label}>
                  {i > 0 && ", "}
                  <a
                    href={l.url}
                    target="_blank"
                    onClick={() => trackEvent({ kind: "booking_click", provider: providerOf(l.url) })}
                    rel="noopener noreferrer sponsored"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    {l.label}
                  </a>
                </span>
              ))}
              .{" "}
            </>
          )}
          {sample ? "Bookable cards are samples for testing. " : ""}WRLD may
          earn a commission when you book through these links.
        </p>
      )}
    </section>
  );
}

function Card({ r }: { r: Recommendation }) {
  const badge = BADGE[r.kind];
  const Icon = badge.icon;
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border bg-card">
      {r.kind === "bookable" && r.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- provider images
        <img
          src={r.imageUrl}
          alt=""
          className="h-32 w-full object-cover"
          referrerPolicy="no-referrer"
        />
      )}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${badge.className}`}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {r.kind === "bookable"
              ? r.provider === "sample"
                ? "Bookable · sample"
                : "Bookable on Viator"
              : badge.label}
          </span>
          {r.kind !== "bookable" && (
            <span className="text-muted-foreground">
              {r.score >= 70
                ? "Great fit"
                : r.score >= 50
                ? "Good fit"
                : "Worth a look"}
            </span>
          )}
        </div>
        <div className="grid gap-1">
          <h3 className="line-clamp-3 text-lg leading-snug font-semibold">
            {r.title}
          </h3>
          {r.kind !== "idea" && r.city && (
            <p className="text-xs text-muted-foreground">{r.city}</p>
          )}
        </div>
        {r.kind === "bookable" ? (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {r.rating != null && (
              <span className="inline-flex items-center gap-1">
                <Star
                  className="size-3.5 fill-current text-travel"
                  aria-hidden="true"
                />
                {r.rating.toFixed(1)}
                {r.reviews ? ` (${r.reviews.toLocaleString()})` : ""}
              </span>
            )}
            {r.durationMinutes ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" aria-hidden="true" />
                {formatDuration(r.durationMinutes)}
              </span>
            ) : null}
          </p>
        ) : (
          <p className="line-clamp-3 text-sm text-muted-foreground">
            {r.blurb}
          </p>
        )}
        <p className="text-sm font-medium text-primary">{r.why}</p>
        <div className="mt-auto grid gap-2">
          {r.price && (
            <p className="text-xs text-muted-foreground">
              From {formatMoney(r.price.amount, r.price.currency)} per{" "}
              {r.kind === "bookable" ? "person" : "adult"}
            </p>
          )}
          {r.places?.length && r.tripId ? (
            <ul className="grid gap-2 border-t pt-2">
              {r.places.map((p) => (
                <AddNamedPlaceRow key={`${p.name}-${p.latitude}`} tripId={r.tripId!} place={p} />
              ))}
            </ul>
          ) : r.places?.length ? (
            <p className="text-sm">Try {r.places.map((p) => p.name).join(", ")}.</p>
          ) : null}
          {r.addToTrip ? (
            <AddOffer {...r.addToTrip} />
          ) : r.attractionId && r.tripId ? (
            <AddSightButton tripId={r.tripId} attractionId={r.attractionId} title={r.title} />
          ) : r.places?.length && r.tripId ? null : (
            <Button asChild size="sm">
              <Link href={r.href}>{r.action}</Link>
            </Button>
          )}
          {r.externalHref && (
            <a
              href={r.externalHref}
              target="_blank"
              onClick={() => r.kind === "bookable" && trackEvent({ kind: "booking_click", provider: "viator" })}
              rel={
                r.kind === "bookable"
                  ? "noopener noreferrer sponsored"
                  : "noopener noreferrer"
              }
              className="inline-flex items-center justify-center gap-1 text-xs text-muted-foreground underline underline-offset-2"
            >
              {r.kind === "bookable" ? "Book on Viator" : "Official site"}{" "}
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function AddOffer({
  tripId,
  city,
  offerId,
  tripTitle,
}: {
  tripId: string;
  city: string;
  offerId: string;
  tripTitle: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addOfferToTrip.bind(null, tripId, city, offerId),
    {}
  );
  if (state.ok) {
    return (
      <p role="status" className="text-center text-sm">
        {state.note}{" "}
        <Link
          href={`/trips/${tripId}/itinerary`}
          className="font-medium text-primary underline underline-offset-2"
        >
          See it
        </Link>
      </p>
    );
  }
  return (
    <form action={action} className="grid gap-1">
      <Button type="submit" size="sm" disabled={pending} className="w-full">
        {pending ? "Adding…" : `Add to ${tripTitle}`}
      </Button>
      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
