/**
 * Partner links and embeds, built by WRLD: no partner scripts on our pages.
 *
 * GetYourGuide (direct partner account). The partner ID is public: it appears
 * in every partner link. The parameters match what GetYourGuide's own link
 * builder produces for this account. Safe to import on the client.
 */
export const GYG_PARTNER_ID = process.env.NEXT_PUBLIC_GYG_PARTNER_ID || "5YFPKG2";
export const GYG_WIDGET_ORIGIN = "https://widget.getyourguide.com";

const isGyg = (u: URL) => u.protocol === "https:" && (u.hostname === "getyourguide.com" || u.hostname.endsWith(".getyourguide.com"));

/** Adds WRLD's partner code to a GetYourGuide link; any other link comes back unchanged. */
export function partnerUrl(url: string): string;
export function partnerUrl(url: string | null | undefined): string | null;
export function partnerUrl(url: string | null | undefined): string | null {
  if (!url) return url ?? null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  if (!isGyg(u) || u.hostname.startsWith("partner.") || u.hostname.startsWith("widget.")) return url;
  u.searchParams.set("partner_id", GYG_PARTNER_ID);
  u.searchParams.set("utm_medium", "travel_agent");
  u.searchParams.set("travel_agent", "1");
  return u.toString();
}

export function getYourGuideUrl(target: URL): string {
  return partnerUrl(target.toString());
}

/** The tour number in a GetYourGuide activity link (".../some-tour-t280242/"). */
export function gygTourId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!isGyg(u)) return null;
    return /-t(\d{2,9})\/?$/.exec(u.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

type Common = { locale?: string; currency?: string };

/** GetYourGuide's activity panel (tours for a search), as a plain iframe URL. */
export function gygActivitiesFrame(q: string, count = 3, o: Common = {}) {
  const u = new URL("/default/activities.frame", GYG_WIDGET_ORIGIN);
  u.search = new URLSearchParams({
    widget: "activities",
    partner_id: GYG_PARTNER_ID,
    locale_code: o.locale ?? "en-US",
    number_of_items: String(Math.min(Math.max(count, 1), 12)),
    q: q.slice(0, 120),
    ...(o.currency ? { currency: o.currency } : {}),
    hide_join_affiliate_program: "true",
    document_lang: "en",
    website: "https://wrldtrips.com/",
  }).toString();
  return u.toString();
}

/** GetYourGuide's live availability for one tour, as a plain iframe URL. */
export function gygAvailabilityFrame(tourId: string, o: Common & { variant?: "horizontal" | "vertical" } = {}) {
  const u = new URL("/default/availability.frame", GYG_WIDGET_ORIGIN);
  u.search = new URLSearchParams({
    widget: "availability",
    partner_id: GYG_PARTNER_ID,
    locale_code: o.locale ?? "en-US",
    tour_id: tourId,
    currency: o.currency ?? "USD",
    variant: o.variant ?? "vertical",
    hide_join_affiliate_program: "true",
    document_lang: "en",
    website: "https://wrldtrips.com/",
  }).toString();
  return u.toString();
}

export const affiliateStatus = () => ({ getYourGuide: Boolean(GYG_PARTNER_ID) });
