import "server-only";
import { env } from "@/lib/env";
import { viatorPost } from "@/features/experiences/viator-client";

/**
 * Finds a ticket price for an activity the user typed in by name
 * ("Art Institute of Chicago") so it lands in the budget automatically.
 *
 * Order:
 *   1. Viator affiliate API, if VIATOR_API_KEY is set
 *   2. Sample prices, only if PRICING_SAMPLE_DATA=true (local demos; labeled "sample")
 *   3. Nothing — the item is saved without a price and the UI asks for one
 *
 * A match is only accepted when the listing's title clearly matches what the
 * user typed, so we don't attach a random tour's price to their museum.
 */

export type PriceMatch = {
  unitPrice: number;
  currency: string;
  provider: "viator" | "sample";
  providerRef: string;
  title: string;
  bookingUrl: string | null;
};

const STOP_WORDS = new Set(["the", "a", "an", "of", "and", "at", "in", "to", "tour", "visit", "ticket", "tickets"]);

function words(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/** Share of the user's words that appear in the listing title (0–1). */
export function titleMatch(query: string, listingTitle: string) {
  const q = words(query);
  if (!q.length) return 0;
  const t = new Set(words(listingTitle));
  return q.filter((w) => t.has(w)).length / q.length;
}

const MIN_MATCH = 0.6;

export async function lookupActivityPrice(input: {
  title: string;
  destination: string | null;
  currency: string;
}): Promise<PriceMatch | null> {
  try {
    if (env("VIATOR_API_KEY")) return await viatorLookup(input);
    if (process.env.PRICING_SAMPLE_DATA === "true") return sampleLookup(input.title);
  } catch (error) {
    console.error("Price lookup failed", error);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Viator Partner API (affiliate). Verify field names against your API version:
// https://docs.viator.com/partner-api/affiliate/technical
// ---------------------------------------------------------------------------
type ViatorProduct = {
  productCode: string;
  title: string;
  productUrl?: string;
  pricing?: { summary?: { fromPrice?: number }; currency?: string };
};

async function viatorLookup({ title, destination, currency }: { title: string; destination: string | null; currency: string }) {
  const response = await viatorPost(
    "/search/freetext",
    {
      searchTerm: [title, destination].filter(Boolean).join(" "),
      currency,
      searchTypes: [{ searchType: "PRODUCTS", pagination: { start: 1, count: 5 } }],
    },
    6000,
  );
  if (!response) throw new Error("No Viator key");
  if (!response.ok) throw new Error(`Viator search returned ${response.status}`);

  const data = (await response.json()) as { products?: { results?: ViatorProduct[] } };
  const best = (data.products?.results ?? [])
    .map((p) => ({ p, score: titleMatch(title, p.title) }))
    .filter(({ p, score }) => score >= MIN_MATCH && typeof p.pricing?.summary?.fromPrice === "number")
    .sort((a, b) => b.score - a.score)[0]?.p;
  if (!best) return null;

  return {
    unitPrice: best.pricing!.summary!.fromPrice!,
    currency: best.pricing?.currency ?? currency,
    provider: "viator",
    providerRef: best.productCode,
    title: best.title,
    bookingUrl: best.productUrl ?? null,
  } satisfies PriceMatch;
}

// ---------------------------------------------------------------------------
// Sample prices for local demos. Never enabled unless PRICING_SAMPLE_DATA=true.
// ---------------------------------------------------------------------------
const SAMPLE_PRICES: Array<{ keywords: string[]; price: number; title: string }> = [
  { keywords: ["museum", "gallery", "institute"], price: 30, title: "Museum general admission" },
  { keywords: ["boat", "cruise", "sail"], price: 55, title: "Sightseeing boat cruise" },
  { keywords: ["walking", "food", "tasting"], price: 85, title: "Guided food walk" },
  { keywords: ["hike", "hiking", "trek"], price: 70, title: "Guided day hike" },
  { keywords: ["show", "concert", "fado", "theater", "theatre"], price: 45, title: "Evening show" },
  { keywords: ["palace", "castle", "cathedral", "tower"], price: 20, title: "Landmark entry ticket" },
];

function sampleLookup(title: string): PriceMatch | null {
  const w = new Set(words(title));
  const hit = SAMPLE_PRICES.find((s) => s.keywords.some((k) => w.has(k)));
  if (!hit) return null;
  return {
    unitPrice: hit.price,
    currency: "USD",
    provider: "sample",
    providerRef: `sample:${hit.keywords[0]}`,
    title: hit.title,
    bookingUrl: null,
  };
}
