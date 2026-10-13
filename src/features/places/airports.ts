import "server-only";

import { distanceKm } from "@/lib/geo";
import data from "./airports.json";
import { geocode } from "./geocode";

/** Airports with scheduled service (OurAirports, public domain): code, name, city, country, lat, lng, size 3/2/1. */
type Row = [string, string, string, string, number, number, number];
const AIRPORTS = data as Row[];

export type Airport = { code: string; name: string; city: string; country: string; latitude: number; longitude: number; km?: number };

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const toAirport = (r: Row, km?: number): Airport => ({ code: r[0], name: r[1], city: r[2], country: r[3], latitude: r[4], longitude: r[5], ...(km != null ? { km } : {}) });

/**
 * "Munich" → MUC; "lis" → LIS; "new york" → JFK, LGA, EWR…
 * If no airport matches by name, looks the place up and returns the closest
 * airports (so "Sintra" suggests LIS).
 */
export async function searchAirports(query: string, limit = 8): Promise<Airport[]> {
  const q = fold(query.trim());
  if (q.length < 2) return [];
  const scored: { r: Row; score: number }[] = [];
  for (const r of AIRPORTS) {
    const code = r[0].toLowerCase();
    const city = fold(r[2]);
    const name = fold(r[1]);
    let score = 0;
    if (code === q) score = 100;
    else if (city === q) score = 80;
    else if (city.startsWith(q)) score = 60;
    else if (name.startsWith(q)) score = 50;
    else if (q.length >= 3 && (city.includes(q) || name.includes(q))) score = 30;
    if (score) scored.push({ r, score: score + r[6] * 5 });
  }
  if (scored.length) {
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => toAirport(s.r));
  }
  if (q.length < 3) return [];
  const place = await geocode(query);
  if (!place) return [];
  return nearestAirports(place, limit);
}

export function nearestAirports(at: { latitude: number; longitude: number }, limit = 5, maxKm = 250): Airport[] {
  return AIRPORTS.filter((r) => r[6] >= 2)
    .map((r) => ({ r, km: distanceKm(at, { latitude: r[4], longitude: r[5] }) }))
    .filter((x) => x.km <= maxKm)
    .sort((a, b) => a.km - b.km - (b.r[6] - a.r[6]) * 15)
    .slice(0, limit)
    .map((x) => toAirport(x.r, Math.round(x.km)));
}

let BY_CODE: Map<string, Row> | null = null;
export function airportByCode(code: string): Airport | null {
  BY_CODE ??= new Map(AIRPORTS.map((a) => [a[0], a]));
  const r = BY_CODE.get(code.toUpperCase());
  return r ? toAirport(r) : null;
}
