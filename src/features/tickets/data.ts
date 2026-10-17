import "server-only";

import { cacheLife } from "next/cache";

import { publicClient } from "@/lib/supabase/public";
import type { Attraction } from "@/types/database";

export type TicketPlace = Pick<
  Attraction,
  | "slug"
  | "name"
  | "aliases"
  | "city"
  | "country_code"
  | "official_url"
  | "tickets_url"
  | "timed_entry"
  | "best_slot"
  | "duration_minutes"
  | "hours_note"
  | "visit_note"
  | "adult_price"
  | "currency"
  | "price_note"
  | "verified_on"
>;

const COLS =
  "slug, name, aliases, city, country_code, official_url, tickets_url, timed_entry, best_slot, duration_minutes, hours_note, visit_note, adult_price, currency, price_note, verified_on";

/** Every hand-checked attraction, for the public official-tickets pages. Cached: the list changes rarely. */
export async function allTicketPlaces(): Promise<TicketPlace[]> {
  "use cache";
  cacheLife("hours");
  const { data } = await publicClient().from("attractions").select(COLS).order("city").order("name");
  return (data ?? []) as TicketPlace[];
}

export async function ticketPlace(slug: string) {
  return (await allTicketPlaces()).find((p) => p.slug === slug) ?? null;
}

/** "www.tickets.example.co.uk" → "tickets.example.co.uk" (enough to compare against our list). */
export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

const sameSite = (host: string, official: string) => host === official || host.endsWith(`.${official}`);

/** Words too common to tie a web address to one place. */
const GENERIC = new Set(
  "museum museo musee museu palace palacio palazzo tower torre tour tours ticket tickets official national gallery castle cathedral church memorial island gardens garden house park basilica temple shrine city centre center plaza square royal state building bridge market"
    .split(" "),
);

const words = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/);

/** Distinctive words of a place's name ("louvre", "sagrada"), never a city name: lots of honest sites say "barcelona". */
function placeWords(p: TicketPlace, cityWords: Set<string>) {
  const all = words([p.slug, p.name, ...(p.aliases ?? [])].join(" "));
  return [...new Set(all.filter((w) => w.length >= 5 && !GENERIC.has(w) && !cityWords.has(w)))];
}

export type LinkVerdict =
  | { kind: "invalid" }
  | { kind: "official"; place: TicketPlace; host: string }
  | { kind: "lookalike"; place: TicketPlace; host: string; matched: string }
  | { kind: "unknown"; host: string };

/**
 * Is this link the official site? Official when it's on the same site as a hand-checked official or ticket
 * address. A lookalike when the address names one of our places (say "louvre" or "sagrada") but isn't
 * that place's site. Otherwise we don't know it.
 */
export function checkLink(url: string, places: TicketPlace[]): LinkVerdict {
  const host = hostOf(url.trim());
  if (!host || !host.includes(".")) return { kind: "invalid" };
  for (const p of places) {
    for (const o of [hostOf(p.official_url), hostOf(p.tickets_url)]) {
      if (o && sameSite(host, o)) return { kind: "official", place: p, host };
    }
  }
  const flat = host.replace(/[^a-z0-9]/g, "");
  const cityWords = new Set(places.flatMap((p) => words(p.city)));
  for (const p of places) {
    const hit = placeWords(p, cityWords).find((w) => flat.includes(w));
    if (hit) return { kind: "lookalike", place: p, host, matched: hit };
  }
  return { kind: "unknown", host };
}

export const slotLabel: Record<string, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Night",
};

export const durationLabel = (m: number | null) => {
  if (!m) return null;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? `${h} hr${h > 1 ? "s" : ""}${r ? ` ${r} min` : ""}` : `${r} min`;
};
