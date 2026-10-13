"use client";

import {
  Bird,
  BookOpen,
  Building2,
  Clock,
  Coffee,
  ExternalLink,
  Landmark,
  MapPin,
  Mountain,
  Music,
  Palette,
  Plus,
  ShoppingBasket,
  Sparkles,
  Star,
  Trees,
  UtensilsCrossed,
  Waves,
  Wine,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { addNamedPlaceToTrip, addOfferToTrip } from "@/features/itinerary/place-actions";
import type { ActionState } from "@/features/trips/actions";
import { formatDuration, formatMoney } from "@/lib/format";
import { providerOf, track } from "@/lib/track";

type BudgetChip = { label: string; fits: boolean } | null;
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
  budget?: BudgetChip;
};
type NamedPlace = { name: string; latitude: number; longitude: number; address: string | null; km: number };
type Idea = { id: string; title: string; blurb: string; why: string; places: NamedPlace[] };
type Result = {
  mode: "live" | "sample" | "links";
  offers: Offer[];
  links: { label: string; url: string }[];
  city: string | null;
  ideas?: Idea[];
  near?: string | null;
  budget?: { currency: string; perPersonPerDay: number | null; over: boolean } | null;
};

/** A picture for each kind of idea, so cards are scannable without third-party photos. */
const IDEA_ART: Record<string, { icon: LucideIcon; tone: string }> = {
  "cafe-morning": { icon: Coffee, tone: "from-[#f3dcc4] to-[#e4bf9b] text-[#6b3f1d]" },
  bookshop: { icon: BookOpen, tone: "from-[#e9e1d3] to-[#cdbd9f] text-[#4a3b22]" },
  market: { icon: ShoppingBasket, tone: "from-[#f5e3b8] to-[#e5c26f] text-[#5b4210]" },
  "park-picnic": { icon: Trees, tone: "from-[#d6e7d3] to-[#a9cba3] text-[#24472a]" },
  "small-gallery": { icon: Palette, tone: "from-[#efd9e1] to-[#d9aebe] text-[#5a2338]" },
  "big-museum": { icon: Landmark, tone: "from-[#e2e0ea] to-[#bdb8d1] text-[#322c4f]" },
  "special-dinner": { icon: UtensilsCrossed, tone: "from-[#f2d6cc] to-[#dca390] text-[#5c2414]" },
  wine: { icon: Wine, tone: "from-[#ecd3d8] to-[#c98e9a] text-[#561a28]" },
  "live-music": { icon: Music, tone: "from-[#d9dcef] to-[#a6acd8] text-[#25295a]" },
  "beach-day": { icon: Waves, tone: "from-[#d3e8ee] to-[#9ccbd9] text-[#123f4d]" },
  architecture: { icon: Building2, tone: "from-[#e5e1dc] to-[#c4bab0] text-[#3d342b]" },
  "sunrise-hike": { icon: Mountain, tone: "from-[#f6dfc8] to-[#c9b7d6] text-[#3a2c4f]" },
  wildlife: { icon: Bird, tone: "from-[#dbe6cf] to-[#b2c99a] text-[#2f4419]" },
};
const FALLBACK_ART = { icon: MapPin, tone: "from-[#e4ece8] to-[#bfd2c9] text-[#24433a]" };

/**
 * "Recommended for you" under the Add a place search: named places for the
 * traveler's type and bookable experiences, budget-aware, each opening a
 * details sheet with a one-tap Add.
 */
export function PlaceRecommendations({ tripId, dayId, dayLabel }: { tripId: string; dayId: string; dayLabel: string | null }) {
  const [result, setResult] = useState<Result | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<{ kind: "idea"; idea: Idea } | { kind: "offer"; offer: Offer } | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const key = `${tripId}:${dayId}`;

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ trip: tripId });
    if (dayId) params.set("day", dayId);
    fetch(`/api/experiences?${params}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((r: Result) => {
        setResult(r);
        setFailed(false);
        setLoadedKey(key);
        if (r.offers.length) track({ kind: "suggestions_shown", tripId, count: r.offers.length });
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [tripId, dayId, key]);

  if (failed) return null;
  const loading = !result || loadedKey !== key;
  const budget = result?.budget ?? null;
  const ideas = result?.ideas ?? [];
  const offers = result?.offers ?? [];

  return (
    <section aria-labelledby="recs-title" aria-busy={loading} className="grid gap-4 border-t pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id="recs-title" className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="size-4 text-brand" aria-hidden="true" />
          Recommended for your travel type
          {result?.city && !loading && (
            <span className="font-normal text-muted-foreground">
              {" "}
              in {result.city}
              {dayLabel ? `, ${dayLabel}` : ""}
            </span>
          )}
        </h3>
        {budget && !loading && (
          <p className="text-xs text-muted-foreground">
            {budget.perPersonPerDay === null ? (
              <>
                <Link href={`/trips/${tripId}/budget`} className="font-medium text-primary underline underline-offset-2">
                  Set a budget
                </Link>{" "}
                to see what fits it first.
              </>
            ) : budget.over ? (
              <span className="font-medium text-destructive">Over budget: showing free places first.</span>
            ) : (
              <>
                About <span className="font-semibold text-foreground">{formatMoney(budget.perPersonPerDay, budget.currency, { cents: false })}</span> left per person per day, so picks that fit come first.
              </>
            )}
          </p>
        )}
      </div>

      {loading ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Loading recommendations">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="h-44 animate-pulse rounded-2xl bg-muted" />
          ))}
        </ul>
      ) : (
        <>
          {ideas.length > 0 && (
            <div className="grid gap-2">
              <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Places to go{result?.near ? `, near ${result.near}` : ""} · free or pay as you go
              </h4>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {ideas.map((idea) => {
                  const art = IDEA_ART[idea.id] ?? FALLBACK_ART;
                  const Icon = art.icon;
                  return (
                    <li key={idea.id}>
                      <button
                        type="button"
                        onClick={() => setOpen({ kind: "idea", idea })}
                        className="group grid h-full w-full content-start overflow-hidden rounded-2xl border bg-background text-left transition-[border-color,box-shadow,transform] duration-200 ease-out hover:border-primary/60 hover:shadow-[0_8px_24px_-12px_rgb(29_43_38/0.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-safe:active:scale-[0.98]"
                      >
                        <span className={`grid h-24 place-items-center bg-gradient-to-br ${art.tone}`} aria-hidden="true">
                          <Icon className="size-9 transition-transform duration-300 ease-out motion-safe:group-hover:scale-110" strokeWidth={1.5} />
                        </span>
                        <span className="grid gap-1 p-3">
                          <span className="text-sm leading-snug font-semibold">{idea.title}</span>
                          <span className="text-xs text-primary">{idea.why}</span>
                          <span className="text-xs text-muted-foreground">
                            {idea.places.length} {idea.places.length === 1 ? "place" : "places"} nearby · See them
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {offers.length > 0 && (
            <div className="grid gap-2">
              <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Tours and tickets you can book</h4>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {offers.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => setOpen({ kind: "offer", offer: o })}
                      className="group grid h-full w-full content-start overflow-hidden rounded-2xl border bg-background text-left transition-[border-color,box-shadow,transform] duration-200 ease-out hover:border-primary/60 hover:shadow-[0_8px_24px_-12px_rgb(29_43_38/0.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-safe:active:scale-[0.98]"
                    >
                      <span className="relative block h-24 overflow-hidden bg-muted">
                        {o.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- provider photo at a fixed size
                          <img src={o.imageUrl} alt="" className="size-full object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-105" referrerPolicy="no-referrer" loading="lazy" />
                        ) : (
                          <span className={`grid size-full place-items-center bg-gradient-to-br ${FALLBACK_ART.tone}`} aria-hidden="true">
                            <Landmark className="size-9" strokeWidth={1.5} />
                          </span>
                        )}
                        {o.budget && <BudgetBadge chip={o.budget} className="absolute top-2 left-2" />}
                      </span>
                      <span className="grid gap-1 p-3">
                        <span className="line-clamp-2 text-sm leading-snug font-semibold">{o.title}</span>
                        <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                          {o.price !== null && <span className="font-semibold text-foreground">from {formatMoney(o.price, o.currency)}</span>}
                          {o.rating !== null && (
                            <span className="inline-flex items-center gap-0.5">
                              <Star className="size-3 fill-current text-travel" aria-hidden="true" />
                              {o.rating.toFixed(1)}
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-primary">{o.why}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(result?.links.length ?? 0) > 0 && (
            <p className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>More tours on</span>
              {result!.links.map((l) => (
                <a
                  key={l.label}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  onClick={() => track({ kind: "booking_click", tripId, provider: providerOf(l.url) })}
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {l.label}
                </a>
              ))}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            {result?.mode === "sample" ? "Sample listings for testing. " : ""}Places from OpenStreetMap; check hours before you go. WRLD may earn a commission when you book tours through these links.
          </p>
        </>
      )}

      <DetailsSheet open={open} onClose={() => setOpen(null)} tripId={tripId} dayId={dayId} city={result?.city ?? null} />
    </section>
  );
}

function BudgetBadge({ chip, className = "" }: { chip: NonNullable<BudgetChip>; className?: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm ${chip.fits ? "bg-open-soft text-primary" : "bg-card text-destructive"} ${className}`}>
      {chip.label}
    </span>
  );
}

/** Details for one recommendation: summary, picture, budget fit and Add. Native <dialog> handles focus and Esc. */
function DetailsSheet({
  open,
  onClose,
  tripId,
  dayId,
  city,
}: {
  open: { kind: "idea"; idea: Idea } | { kind: "offer"; offer: Offer } | null;
  onClose: () => void;
  tripId: string;
  dayId: string;
  city: string | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      // Grow out of the card that was tapped, so it's clear where the sheet came from.
      const trigger = document.activeElement instanceof HTMLElement ? document.activeElement.getBoundingClientRect() : null;
      d.showModal();
      if (trigger) {
        const box = d.getBoundingClientRect();
        d.style.transformOrigin = `${trigger.left + trigger.width / 2 - box.left}px ${trigger.top + trigger.height / 2 - box.top}px`;
      }
    }
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // click on the backdrop
      }}
      aria-labelledby="rec-details-title"
      className="sheet m-auto max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-3xl border bg-card p-0 text-card-foreground shadow-[0_24px_80px_-20px_rgb(10_18_15/0.55)]"
    >
      {open?.kind === "idea" && <IdeaDetails idea={open.idea} tripId={tripId} dayId={dayId} onClose={onClose} />}
      {open?.kind === "offer" && <OfferDetails offer={open.offer} tripId={tripId} dayId={dayId} city={city} onClose={onClose} />}
    </dialog>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <Button type="button" variant="ghost" size="icon" onClick={onClose} className="material-light absolute top-3 right-3 size-9 rounded-full border border-white/40 shadow-sm" aria-label="Close details">
      <X aria-hidden="true" />
    </Button>
  );
}

function IdeaDetails({ idea, tripId, dayId, onClose }: { idea: Idea; tripId: string; dayId: string; onClose: () => void }) {
  const art = IDEA_ART[idea.id] ?? FALLBACK_ART;
  const Icon = art.icon;
  return (
    <div className="relative grid">
      <div className={`grid h-36 place-items-center bg-gradient-to-br ${art.tone}`} aria-hidden="true">
        <Icon className="size-14" strokeWidth={1.25} />
      </div>
      <CloseButton onClose={onClose} />
      <div className="grid gap-3 p-5">
        <div>
          <h2 id="rec-details-title" className="text-xl font-semibold">
            {idea.title}
          </h2>
          <p className="mt-1 text-sm text-primary">{idea.why}</p>
        </div>
        <p className="text-sm text-muted-foreground">{idea.blurb}</p>
        <p className="rounded-md bg-open-soft px-3 py-2 text-xs">Free to visit or pay as you go. Add what you spend later, or leave it blank.</p>
        <ul className="grid gap-2">
          {idea.places.map((p) => (
            <PlaceAddRow key={`${p.name}-${p.latitude}`} place={p} tripId={tripId} dayId={dayId} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function PlaceAddRow({ place, tripId, dayId }: { place: NamedPlace; tripId: string; dayId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addNamedPlaceToTrip.bind(null, tripId), {});
  const distance = place.km < 1 ? `${Math.round(place.km * 1000)} m away` : `${place.km} km away`;
  const maps = `https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=18/${place.latitude}/${place.longitude}`;
  return (
    <li className="flex items-center gap-3 rounded-lg border p-3">
      <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1 text-sm">
        <span className="block truncate font-medium">{place.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{[place.address, distance].filter(Boolean).join(" · ")}</span>
        <a href={maps} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline underline-offset-2">
          See on map<span className="sr-only"> (opens OpenStreetMap)</span>
        </a>
        {state.error && (
          <span role="alert" className="block text-xs text-destructive">
            {state.error}
          </span>
        )}
        {state.ok && (
          <span role="status" className="block text-xs font-medium text-primary">
            {state.note ?? "Added."}
          </span>
        )}
      </span>
      {!state.ok && (
        <form action={action}>
          <input type="hidden" name="name" value={place.name} />
          <input type="hidden" name="latitude" value={place.latitude} />
          <input type="hidden" name="longitude" value={place.longitude} />
          <input type="hidden" name="address" value={place.address ?? ""} />
          <input type="hidden" name="day_id" value={dayId} />
          <Button type="submit" size="sm" disabled={pending}>
            <Plus aria-hidden="true" /> {pending ? "Adding…" : <>Add<span className="sr-only"> {place.name}</span> to trip</>}
          </Button>
        </form>
      )}
    </li>
  );
}

function OfferDetails({ offer, tripId, dayId, city, onClose }: { offer: Offer; tripId: string; dayId: string; city: string | null; onClose: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addOfferToTrip.bind(null, tripId, city ?? "", offer.id), {});
  return (
    <div className="relative grid">
      <div className="h-48 bg-muted">
        {offer.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- provider photo
          <img src={offer.imageUrl} alt={`Photo from the ${offer.title} listing`} className="size-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className={`grid size-full place-items-center bg-gradient-to-br ${FALLBACK_ART.tone}`} aria-hidden="true">
            <Landmark className="size-14" strokeWidth={1.25} />
          </div>
        )}
      </div>
      <CloseButton onClose={onClose} />
      <div className="grid gap-3 p-5">
        <div>
          <h2 id="rec-details-title" className="text-xl leading-snug font-semibold">
            {offer.title}
          </h2>
          <p className="mt-1 text-sm text-primary">{offer.why}</p>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-lg bg-muted/60 p-2">
            <dt className="text-xs text-muted-foreground">Price</dt>
            <dd className="font-semibold">{offer.price !== null ? `from ${formatMoney(offer.price, offer.currency)}` : "See listing"}</dd>
          </div>
          <div className="rounded-lg bg-muted/60 p-2">
            <dt className="text-xs text-muted-foreground">Length</dt>
            <dd className="inline-flex items-center gap-1 font-semibold">
              <Clock className="size-3.5" aria-hidden="true" />
              {offer.durationMinutes ? formatDuration(offer.durationMinutes) : "Varies"}
            </dd>
          </div>
          <div className="rounded-lg bg-muted/60 p-2">
            <dt className="text-xs text-muted-foreground">Rating</dt>
            <dd className="inline-flex items-center gap-1 font-semibold">
              {offer.rating !== null ? (
                <>
                  <Star className="size-3.5 fill-current text-travel" aria-hidden="true" />
                  {offer.rating.toFixed(1)}
                  {offer.reviews ? <span className="text-xs font-normal text-muted-foreground">({offer.reviews.toLocaleString()})</span> : null}
                </>
              ) : (
                "New"
              )}
            </dd>
          </div>
        </dl>
        {offer.budget && (
          <p className={`rounded-md px-3 py-2 text-xs ${offer.budget.fits ? "bg-open-soft" : "bg-muted"}`}>
            <span className="font-semibold">{offer.budget.label}.</span> Prices are per person.
          </p>
        )}
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        {state.ok && (
          <p role="status" className="text-sm font-medium text-primary">
            {state.note} Book it on the provider&rsquo;s site to lock in your spot.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {!state.ok && (
            <form action={action}>
              <input type="hidden" name="day_id" value={dayId} />
              <Button type="submit" disabled={pending}>
                <Plus aria-hidden="true" /> {pending ? "Adding…" : "Add to itinerary"}
              </Button>
            </form>
          )}
          <Button asChild variant="outline">
            <a
              href={offer.url}
              target="_blank"
              rel="noopener noreferrer sponsored"
              onClick={() => track({ kind: "booking_click", tripId, provider: "viator" })}
            >
              Book on Viator <ExternalLink aria-hidden="true" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {offer.provider === "sample" ? "Sample listing for testing. " : ""}Sold by Viator. Their cancellation rules apply. WRLD may earn a commission.
        </p>
      </div>
    </div>
  );
}
