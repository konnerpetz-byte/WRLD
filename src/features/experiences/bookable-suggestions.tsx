"use client";

import { Clock, ExternalLink, Plus, Star } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { addExperience } from "@/features/itinerary/place-actions";
import type { ActionState } from "@/features/trips/actions";
import { formatDuration, formatMoney } from "@/lib/format";

type Offer = {
  provider: "viator" | "sample";
  id: string;
  title: string;
  url: string;
  imageUrl: string | null;
  price: number | null;
  currency: string;
  rating: number | null;
  reviews: number | null;
  durationMinutes: number | null;
  why: string;
};
type Result = { mode: "live" | "sample" | "links"; offers: Offer[]; links: { label: string; url: string }[]; city: string | null };

const PROVIDER = { viator: "Viator", sample: "Sample" } as const;

/** "Bookable for you": tours and classes for this part of the day, matched to the traveler's type. */
export function BookableSuggestions({ tripId, blockId }: { tripId: string; blockId: string }) {
  const [result, setResult] = useState<Result | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/experiences?trip=${tripId}&block=${blockId}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setResult)
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [tripId, blockId]);

  if (failed) return null;
  if (!result)
    return (
      <p className="text-xs text-muted-foreground" role="status">
        Finding bookable experiences for you…
      </p>
    );

  return (
    <section aria-label="Bookable experiences" className="grid gap-2">
      <h4 className="text-xs font-semibold">
        Bookable for your travel type{result.city ? ` in ${result.city}` : ""}
      </h4>
      {result.offers.length > 0 ? (
        <ul className="grid gap-2">
          {result.offers.map((o) => (
            <OfferRow key={o.id} offer={o} tripId={tripId} blockId={blockId} />
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Browse tours and classes on:</p>
      )}
      {result.links.length > 0 && (
        <p className="flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          {result.offers.length > 0 && <span>More on</span>}
          {result.links.map((l) => (
            <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer sponsored" className="underline underline-offset-2 hover:text-foreground">
              {l.label}
            </a>
          ))}
        </p>
      )}
      <p className="text-[10px] text-muted-foreground">
        {result.mode === "sample" ? "Sample listings for testing. " : ""}WRLD may earn a commission when you book through these links.
      </p>
    </section>
  );
}

function OfferRow({ offer, tripId, blockId }: { offer: Offer; tripId: string; blockId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addExperience.bind(null, tripId, blockId), {});
  return (
    <li className="flex gap-2 rounded-md border bg-card p-2">
      {offer.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- provider images at fixed size
        <img src={offer.imageUrl} alt="" className="size-14 shrink-0 rounded object-cover" referrerPolicy="no-referrer" />
      ) : null}
      <div className="grid min-w-0 flex-1 gap-0.5 text-xs">
        <span className="line-clamp-2 font-medium text-foreground">{offer.title}</span>
        <span className="flex flex-wrap items-center gap-x-2 text-muted-foreground">
          {offer.rating !== null && (
            <span className="inline-flex items-center gap-0.5">
              <Star className="size-3 fill-current text-travel" aria-hidden="true" />
              {offer.rating.toFixed(1)}
              {offer.reviews ? ` (${offer.reviews.toLocaleString()})` : ""}
            </span>
          )}
          {offer.durationMinutes && (
            <span className="inline-flex items-center gap-0.5">
              <Clock className="size-3" aria-hidden="true" />
              {formatDuration(offer.durationMinutes)}
            </span>
          )}
          {offer.price !== null && <span className="font-medium text-foreground">from {formatMoney(offer.price, offer.currency)}</span>}
        </span>
        <span className="text-primary">{offer.why}</span>
        {state.error && (
          <span role="alert" className="text-destructive">
            {state.error}
          </span>
        )}
        <span className="mt-1 flex flex-wrap items-center gap-2">
          {state.ok ? (
            <span role="status" className="font-medium text-primary">
              Added to this block
            </span>
          ) : (
            <form action={action}>
              <input type="hidden" name="id" value={offer.id} />
              <Button type="submit" size="sm" className="h-7 px-2 text-xs" disabled={pending}>
                <Plus aria-hidden="true" /> {pending ? "Adding…" : "Add"}
              </Button>
            </form>
          )}
          <a
            href={offer.url}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2"
          >
            Book on {PROVIDER[offer.provider] === "Sample" ? "Viator" : PROVIDER[offer.provider]}
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
          {offer.provider === "sample" && <span className="rounded bg-muted px-1 text-[10px]">Sample</span>}
        </span>
      </div>
    </li>
  );
}
