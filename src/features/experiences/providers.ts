import "server-only";

import { cacheLife } from "next/cache";
import { env } from "@/lib/env";
import { viatorPost } from "./viator-client";

/**
 * Bookable experiences from booking sites.
 *
 *  Viator (Tripadvisor's experiences marketplace) — Partner API, affiliate.
 *    Set VIATOR_API_KEY (free affiliate sign-up at partnerresources.viator.com).
 *    Product URLs returned to affiliate keys carry your tracking, so bookings
 *    earn commission. Field names below follow API v2; check them against
 *    your account's API version.
 *  GetYourGuide, Airbnb Experiences, Tripadvisor — no open search API for
 *    new partners, so WRLD links to their search for the same city and theme
 *    (GetYourGuide adds your GETYOURGUIDE_PARTNER_ID for commission).
 *  Sample listings — only when PRICING_SAMPLE_DATA=true and there's no
 *    Viator key, clearly labeled "Sample", for trying the app.
 *
 * Results are cached for a few hours per city + theme, which keeps the app
 * fast and inside the providers' rate limits.
 */

export type ExperienceOffer = {
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
  /** The theme that found it, e.g. "food tour" */
  term: string;
};

type ViatorProduct = {
  productCode: string;
  title: string;
  productUrl?: string;
  images?: { variants?: { url: string; width: number; height: number }[] }[];
  reviews?: { totalReviews?: number; combinedAverageRating?: number };
  duration?: { fixedDurationInMinutes?: number; variableDurationFromMinutes?: number };
  pricing?: { summary?: { fromPrice?: number }; currency?: string };
};

export async function viatorSearch(city: string, term: string, currency: string): Promise<ExperienceOffer[]> {
  "use cache";
  cacheLife("hours");
  const key = env("VIATOR_API_KEY");
  if (!key) return [];
  try {
    const response = await viatorPost("/search/freetext", {
      searchTerm: `${city} ${term}`,
      currency,
      searchTypes: [{ searchType: "PRODUCTS", pagination: { start: 1, count: 6 } }],
    });
    if (!response) return [];
    if (!response.ok) {
      console.error("Viator search", response.status, (await response.text()).slice(0, 300));
      return [];
    }
    const data = (await response.json()) as { products?: { results?: ViatorProduct[] } };
    return (data.products?.results ?? [])
      .filter((p) => p.productUrl)
      .map((p) => {
        const variants = p.images?.[0]?.variants ?? [];
        const image = variants.filter((v) => v.width >= 300).sort((a, b) => a.width - b.width)[0] ?? variants.at(-1);
        return {
          provider: "viator" as const,
          id: p.productCode,
          title: p.title,
          url: p.productUrl!,
          imageUrl: image?.url?.startsWith("https://") ? image.url : null,
          price: typeof p.pricing?.summary?.fromPrice === "number" ? p.pricing.summary.fromPrice : null,
          currency: p.pricing?.currency ?? currency,
          rating: p.reviews?.combinedAverageRating ?? null,
          reviews: p.reviews?.totalReviews ?? null,
          durationMinutes: p.duration?.fixedDurationInMinutes ?? p.duration?.variableDurationFromMinutes ?? null,
          term,
        };
      });
  } catch (error) {
    console.error("Viator search failed", error);
    return [];
  }
}

/** Placeholder listings for local demos. Never shown unless PRICING_SAMPLE_DATA=true and no Viator key. */
export function sampleSearch(city: string, term: string, currency: string): ExperienceOffer[] {
  if (env("VIATOR_API_KEY") || process.env.PRICING_SAMPLE_DATA !== "true") return [];
  const words = term.replace(/\b\w/g, (c) => c.toUpperCase());
  const base = 25 + (hash(`${city}${term}`) % 90);
  return [
    {
      provider: "sample",
      id: `sample:${slug(city)}:${slug(term)}`,
      title: `${city} ${words}`,
      url: viatorSearchUrl(city, term),
      imageUrl: null,
      price: base,
      currency,
      rating: 4.5 + (hash(term) % 5) / 10,
      reviews: 120 + (hash(city + term) % 2400),
      durationMinutes: [90, 120, 180, 240][hash(term) % 4],
      term,
    },
  ];
}

/** Viator search page, tagged with WRLD's partner IDs (VIATOR_PID / VIATOR_MCID) so bookings earn commission. */
export function viatorSearchUrl(city: string, term: string) {
  const url = new URL("https://www.viator.com/searchResults/all");
  url.searchParams.set("text", `${city} ${term}`);
  const pid = env("VIATOR_PID");
  const mcid = env("VIATOR_MCID");
  if (pid) url.searchParams.set("pid", pid);
  if (mcid) url.searchParams.set("mcid", mcid);
  if (pid) url.searchParams.set("medium", "link");
  return url.toString();
}

/** Search pages on other booking sites for the same city and theme. */
export function moreLinks(city: string, term: string) {
  const q = encodeURIComponent(`${city} ${term}`);
  const gyg = new URL("https://www.getyourguide.com/s/");
  gyg.searchParams.set("q", `${city} ${term}`);
  if (process.env.GETYOURGUIDE_PARTNER_ID) gyg.searchParams.set("partner_id", process.env.GETYOURGUIDE_PARTNER_ID);
  return [
    { label: "Viator", url: viatorSearchUrl(city, term) },
    { label: "GetYourGuide", url: gyg.toString() },
    { label: "Airbnb Experiences", url: `https://www.airbnb.com/s/${encodeURIComponent(city)}/experiences?query=${encodeURIComponent(term)}` },
    { label: "Tripadvisor", url: `https://www.tripadvisor.com/Search?q=${q}` },
  ];
}

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
