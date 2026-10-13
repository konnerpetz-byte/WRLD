"use client";

import { useEffect, useRef, useState } from "react";

import { GYG_WIDGET_ORIGIN, gygActivitiesFrame, gygAvailabilityFrame } from "@/lib/affiliate";

const CURRENCIES = new Set(["AUD", "CAD", "CHF", "CZK", "DKK", "EUR", "GBP", "HKD", "INR", "JPY", "NOK", "NZD", "PLN", "SEK", "SGD", "THB", "USD", "ZAR"]);
const gygCurrency = (c?: string | null) => (c && CURRENCIES.has(c.toUpperCase()) ? c.toUpperCase() : "USD");

/**
 * A GetYourGuide panel as a plain, sandboxed iframe. WRLD doesn't load
 * GetYourGuide's script: the panel runs on their domain, can't touch this page,
 * and only tells us its height. Loads when scrolled near.
 */
function GygFrame({ src, title, minHeight }: { src: string; title: string; minHeight: number }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(minHeight);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== GYG_WIDGET_ORIGIN || e.source !== ref.current?.contentWindow) return;
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        const h = Number(data?.height);
        if (data?.channel === "GYG" && Number.isFinite(h)) setHeight(Math.min(Math.max(Math.round(h), 120), 2400));
      } catch {
        // Not a size message.
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <iframe
      ref={ref}
      src={src}
      title={title}
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      style={{ height }}
      className="w-full rounded-xl border-0 bg-background"
    />
  );
}

/** Bookable tours for a search ("Lisbon food tours"), from GetYourGuide. */
export function GygActivities({ q, count = 3, currency, title }: { q: string; count?: number; currency?: string | null; title?: string }) {
  return (
    <GygFrame
      src={gygActivitiesFrame(q, count, { currency: gygCurrency(currency) })}
      title={title ?? `Tours for ${q} on GetYourGuide`}
      minHeight={count > 2 ? 420 : 320}
    />
  );
}

/** Live dates and prices for one GetYourGuide tour. */
export function GygAvailability({ tourId, currency, title }: { tourId: string; currency?: string | null; title: string }) {
  return <GygFrame src={gygAvailabilityFrame(tourId, { currency: gygCurrency(currency) })} title={`Dates and prices for ${title} on GetYourGuide`} minHeight={560} />;
}
