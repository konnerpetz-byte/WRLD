"use client";

import { ArrowUpRight, ShieldCheck, Smartphone } from "lucide-react";

import { track } from "@/lib/track";

/**
 * Two things international travelers usually sort out the week before:
 * phone data (an eSIM) and travel insurance. Links are WRLD's affiliate links
 * (set in Vercel), shown only when set, with a plain disclosure.
 */
export function TravelExtras({ tripId, esimUrl, insuranceUrl }: { tripId: string; esimUrl: string | null; insuranceUrl: string | null }) {
  const items = [
    esimUrl && {
      href: esimUrl,
      provider: "esim",
      icon: Smartphone,
      title: "Phone data abroad",
      body: "An eSIM gives you local data from landing, usually for less than your carrier's roaming plan. Check your phone supports eSIM first.",
      cta: "Compare eSIM plans",
    },
    insuranceUrl && {
      href: insuranceUrl,
      provider: "insurance",
      icon: ShieldCheck,
      title: "Travel insurance",
      body: "Covers medical care abroad, cancellations and lost bags. Check what your credit card already covers before you buy.",
      cta: "Get a quote",
    },
  ].filter(Boolean) as { href: string; provider: string; icon: typeof Smartphone; title: string; body: string; cta: string }[];
  if (!items.length) return null;
  return (
    <section aria-labelledby="extras-h" className="grid gap-3 rounded-2xl border bg-card p-5 lg:col-span-2">
      <h2 id="extras-h" className="text-lg font-semibold">
        Before you fly abroad
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map(({ href, provider, icon: Icon, title, body, cta }) => (
          <li key={provider} className="grid content-start gap-2 rounded-xl bg-muted/40 p-4">
            <p className="flex items-center gap-2 font-medium">
              <Icon className="size-4 text-primary" aria-hidden="true" /> {title}
            </p>
            <p className="text-sm text-muted-foreground">{body}</p>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer sponsored"
              onClick={() => track({ kind: "booking_click", tripId, provider })}
              className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary underline underline-offset-2"
            >
              {cta}
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">WRLD may earn a commission if you buy through these links. It doesn&rsquo;t change your price.</p>
    </section>
  );
}
