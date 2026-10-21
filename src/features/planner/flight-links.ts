import "server-only";

import { cacheLife } from "next/cache";

import { env } from "@/lib/env";

/**
 * Where "See live fares" goes: Aviasales' search for this route, dates and group, made into a
 * Travelpayouts partner link so bookings within 30 days earn a commission (40% of Aviasales'
 * revenue, about 1.1–1.3% of the ticket, per Travelpayouts). Links are converted with
 * Travelpayouts' own Links API, as their rules require, using TRAVELPAYOUTS_TOKEN plus the
 * account's TRAVELPAYOUTS_MARKER (partner ID) and TRAVELPAYOUTS_TRS (project ID).
 * Without those, or if the conversion fails, the plain Aviasales search is used (no commission).
 */
export type FlightLink = { label: string; url: string; earns: boolean };

const ddmm = (iso: string) => `${iso.slice(8, 10)}${iso.slice(5, 7)}`;
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Aviasales search: DTW1511BOS20112 = Detroit 15 Nov → Boston, back 20 Nov, 2 adults. */
export function aviasalesSearchUrl(origin: string, destination: string, depart: string, nights: number, adults: number) {
  const back = addDays(depart, nights);
  const n = Math.min(9, Math.max(1, Math.round(adults)));
  return `https://www.aviasales.com/search/${origin}${ddmm(depart)}${destination}${ddmm(back)}${n}`;
}

export const affiliateFlightsReady = () => Boolean(env("TRAVELPAYOUTS_TOKEN") && env("TRAVELPAYOUTS_MARKER") && env("TRAVELPAYOUTS_TRS"));

/** The partner version of an Aviasales link, from Travelpayouts. Cached for a week. */
async function partnerLink(url: string): Promise<string | null> {
  "use cache";
  cacheLife("weeks");
  const token = env("TRAVELPAYOUTS_TOKEN");
  const marker = Number(env("TRAVELPAYOUTS_MARKER"));
  const trs = Number(env("TRAVELPAYOUTS_TRS"));
  if (!token || !marker || !trs) return null;
  try {
    const res = await fetch("https://api.travelpayouts.com/links/v1/create", {
      method: "POST",
      headers: { "X-Access-Token": token, "Content-Type": "application/json" },
      body: JSON.stringify({ trs, marker, shorten: true, links: [{ url }] }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      console.error(`[flight-links] Travelpayouts links ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return null;
    }
    const body = (await res.json()) as { result?: { links?: { partner_url?: string; code?: string }[] } };
    const out = body.result?.links?.[0]?.partner_url;
    return out && /^https:\/\//.test(out) ? out : null;
  } catch (e) {
    console.error(`[flight-links] Travelpayouts links failed: ${String(e).slice(0, 200)}`);
    return null;
  }
}

type FlightQuery = { origin: string; destination: string; depart: string; nights: number; adults: number };

/** The same links before the partner version is ready (no commission). */
export function plainFlightLinks(q: FlightQuery): FlightLink[] {
  return [
    { label: "Aviasales", url: aviasalesSearchUrl(q.origin, q.destination, q.depart, q.nights, q.adults), earns: false },
    googleFlights(q),
  ];
}

const googleFlights = (q: FlightQuery): FlightLink => ({
  label: "Google Flights",
  url: `https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights from ${q.origin} to ${q.destination} on ${q.depart} returning ${addDays(q.depart, q.nights)}`)}`,
  earns: false,
});

/** "Live fares" links for a card: Aviasales (earns when set up) first, then Google Flights. */
export async function flightLinks(q: FlightQuery): Promise<FlightLink[]> {
  const search = aviasalesSearchUrl(q.origin, q.destination, q.depart, q.nights, q.adults);
  const partner = affiliateFlightsReady() ? await partnerLink(search) : null;
  return [
    { label: "Aviasales", url: partner ?? search, earns: Boolean(partner) },
    googleFlights(q),
  ];
}
