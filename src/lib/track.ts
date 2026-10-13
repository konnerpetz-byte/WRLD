/**
 * Records a moment the database can't see on its own (a booking link opened,
 * suggestions shown) for the owner stats page. Fire-and-forget: never blocks
 * the click and never shows an error.
 */
export type TrackEvent = {
  kind: "booking_click" | "suggestions_shown";
  tripId?: string | null;
  provider?: string | null;
  count?: number;
};

export function track(event: TrackEvent) {
  try {
    const body = JSON.stringify(event);
    if (navigator.sendBeacon?.(`/api/track`, new Blob([body], { type: "application/json" }))) return;
    void fetch("/api/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  } catch {
    // Stats are nice to have; ignore.
  }
}

/** "viator", "getyourguide"… from a booking link, for the per-site breakdown. */
export function providerOf(url: string | null | undefined): string {
  try {
    let u = new URL(url ?? "");
    // Travelpayouts redirect: the destination is in "u".
    if (u.hostname === "tp.media" && u.searchParams.get("u")) u = new URL(u.searchParams.get("u")!);
    const host = u.hostname.replace(/^www\./, "");
    if (host.endsWith("viator.com")) return "viator";
    if (host.endsWith("getyourguide.com")) return "getyourguide";
    if (host.endsWith("tripadvisor.com")) return "tripadvisor";
    if (host.endsWith("airbnb.com")) return "airbnb";
    return "official";
  } catch {
    return "other";
  }
}
