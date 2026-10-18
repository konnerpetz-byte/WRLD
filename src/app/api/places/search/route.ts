import { NextResponse, type NextRequest } from "next/server";

import { searchPlaces } from "@/features/attractions/search";
import { categorySuggestions } from "@/features/places/category-search";
import { searchNamedPlaces } from "@/features/places/name-search";
import { searchTours, tourLinks } from "@/features/places/tour-search";
import { distanceKm } from "@/lib/geo";
import { createClient } from "@/lib/supabase/server";
import { readPoint } from "../read-point";

/** Farther than this from the day's city, only WRLD's own listings still show. */
const LOCAL_KM = 200;

/**
 * GET /api/places/search?q=sintra&lat=38.72&lng=-9.14&city=Lisbon
 * → { results, links }: official matches first, then named places, bookable tours and other sights;
 * links are GetYourGuide and Viator searches for the same words in that city.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (q.trim().length < 2) return NextResponse.json({ results: [], links: [] });
  const city = (request.nextUrl.searchParams.get("city") ?? "").trim().slice(0, 80) || null;
  const supabase = await createClient();
  const near = readPoint(request);
  const query = q.slice(0, 120);
  const [category, sights, named, tours] = await Promise.all([
    categorySuggestions(query, near),
    searchPlaces(supabase, query, near),
    searchNamedPlaces(query, near),
    city ? searchTours(query, city, near) : Promise.resolve([]),
  ]);
  const links = city && query.trim().length >= 3 ? tourLinks(query, city) : [];
  // "Munich cafe" → real cafés; otherwise official sights first.
  if (category.length) return NextResponse.json({ results: [...category, ...sights.slice(0, 3)], links });
  const official = sights.filter((s) => s.source === "official");
  const others = sights.filter((s) => s.source !== "official" && (!near || s.km == null || s.km <= LOCAL_KM));
  const results: typeof sights = [];
  for (const s of [...official, ...named]) {
    const dup = results.some((r) => distanceKm(r, s) < 0.25 && (r.name.toLowerCase().includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(r.name.toLowerCase())));
    if (!dup) results.push(s);
  }
  // Bookable tours come after places that match by name, before other sights.
  results.push(...tours);
  for (const s of others) {
    const dup = results.some((r) => r.source !== "viator" && distanceKm(r, s) < 0.25 && (r.name.toLowerCase().includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(r.name.toLowerCase())));
    if (!dup) results.push(s);
  }
  return NextResponse.json({ results: results.slice(0, 8), links });
}
