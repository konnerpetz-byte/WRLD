"use client";

import { ArrowLeft, ArrowRight, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { markTourSeen } from "./actions";

type Path = "trip" | "explore" | "group";

/** Each stop points at a part of the app; `target` matches a nav link's data-tour. */
const STEPS: { title: string; body: string; target?: string }[] = [
  {
    title: "Welcome to WRLD",
    body: "Plan the whole trip in one place and see what your points really pay for. A quick look around takes under a minute.",
  },
  {
    title: "Trips: everything for one trip",
    body: "Each trip has tabs in the order it comes together: Overview, Itinerary, Map, Flights, Stays, Points, Budget, Group, Checklist, and Export.",
    target: "trips",
  },
  {
    title: "Explore: no destination yet?",
    body: "Enter your cash and points. WRLD prices flights, hotel and days there for places that fit, then starts the trip for you in one click.",
    target: "explore",
  },
  {
    title: "Wallet: your points, no logins",
    body: "Add card and airline balances by hand in about two minutes. Explore and each trip's Points tab use them to show the cheapest way to pay.",
    target: "wallet",
  },
  {
    title: "Plan together, take it with you",
    body: "Invite friends to vote and split costs. When it's set, export the trip as a PDF, calendar or spreadsheet, with tickets and confirmations in one place.",
  },
];

// Ring for the highlighted nav link (kept as literal classes so they're built).
const RING = ["ring-2", "ring-travel", "ring-offset-2", "ring-offset-sidebar", "motion-safe:animate-pulse"];

/**
 * First-run tour: a small panel beside the nav (not a blocking modal), one
 * step at a time, with Skip on every step. Shows once; "Replay the tour" on
 * the You page brings it back with ?tour=1.
 */
export function WelcomeTour({ seen }: { seen: boolean }) {
  const replay = useSearchParams().get("tour") === "1";
  // Keyed on replay so "Replay the tour" starts it fresh even after it was closed.
  return <Tour key={String(replay)} seen={seen} replay={replay} />;
}

function Tour({ seen, replay }: { seen: boolean; replay: boolean }) {
  const [open, setOpen] = useState(!seen || replay);
  const [step, setStep] = useState(0);
  const [path, setPath] = useState<Path | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const last = step === STEPS.length; // the final "where to start" step

  // Move focus into the panel when it opens and on each step, for keyboard and screen reader users.
  useEffect(() => {
    if (open) panel.current?.querySelector<HTMLElement>("h2")?.focus();
  }, [open, step]);

  // Highlight the nav link this step is about.
  useEffect(() => {
    const target = STEPS[step]?.target;
    if (!open || !target) return;
    const els = [...document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)];
    els.forEach((el) => el.classList.add(...RING));
    return () => els.forEach((el) => el.classList.remove(...RING));
  }, [open, step]);

  const close = () => {
    setOpen(false);
    startTransition(async () => {
      await markTourSeen();
      if (replay) router.replace(window.location.pathname);
    });
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  const s = STEPS[step];
  const starts: Record<Path, { href: string; label: string }> = {
    trip: { href: "/trips/new", label: "Start my trip" },
    explore: { href: "/points", label: "Open Explore" },
    group: { href: "/trips/new", label: "Start the group trip" },
  };

  return (
    <div
      ref={panel}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md rounded-2xl border bg-card p-5 shadow-[0_24px_60px_-20px_rgb(29_43_38/0.45)] lg:inset-x-auto lg:right-8 lg:bottom-8 lg:mx-0"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground" aria-live="polite">
          {last ? "Last step" : `${step + 1} of ${STEPS.length + 1}`}
        </p>
        <button
          type="button"
          onClick={close}
          className="-m-1 inline-flex items-center gap-1 rounded-md p-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          Skip tour <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      {!last ? (
        <>
          <h2 id={titleId} tabIndex={-1} className="mt-2 text-xl font-semibold outline-none">
            {s.title}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
          {step === 0 && (
            <fieldset className="mt-4 grid gap-2">
              <legend className="mb-1 text-sm font-medium">Where are you starting?</legend>
              {(
                [
                  ["trip", "I know where I'm going"],
                  ["explore", "I have points. Show me where I can go"],
                  ["group", "I'm planning with friends"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring ${
                    path === value ? "border-primary bg-open-soft" : "hover:bg-muted/50"
                  }`}
                >
                  <input type="radio" name="tour-path" value={value} checked={path === value} onChange={() => setPath(value)} className="accent-primary" />
                  {label}
                </label>
              ))}
            </fieldset>
          )}
        </>
      ) : (
        <>
          <h2 id={titleId} tabIndex={-1} className="mt-2 text-xl font-semibold outline-none">
            You&rsquo;re set
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {path === "explore"
              ? "Add your points in Wallet first for the best answers, or jump straight into Explore."
              : path === "group"
                ? "Create the trip, then invite friends from its Group tab. Everyone can vote and add ideas."
                : "Create the trip with where and when. WRLD sets up each day, and the Points tab shows how to pay for it."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild onClick={close}>
              <Link href={starts[path ?? "trip"].href}>{starts[path ?? "trip"].label}</Link>
            </Button>
            <Button asChild variant="outline" onClick={close}>
              <Link href="/points/wallet">Add my points first</Link>
            </Button>
          </div>
        </>
      )}

      <div className="mt-5 flex items-center justify-between gap-3">
        <div className="flex gap-1.5" aria-hidden="true">
          {[...STEPS, null].map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-[width,background-color] ${i === step ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30"}`} />
          ))}
        </div>
        <div className="flex gap-2">
          {step > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
              <ArrowLeft aria-hidden="true" /> Back
            </Button>
          )}
          {!last && (
            <Button type="button" size="sm" onClick={() => setStep(step + 1)}>
              Next <ArrowRight aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
