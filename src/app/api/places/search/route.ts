import { NextResponse, type NextRequest } from "next/server";

import { searchPlaces } from "@/features/attractions/search";
import { categorySuggestions } from "@/features/places/category-search";
import { searchNamedPlaces } from "@/features/places/name-search";
import { distanceKm } from "@/lib/geo";
import { createClient } from "@/lib/supabase/server";
import { readPoint } from "../read-point";

/** GET /api/places/search?q=sintra&lat=38.72&lng=-9.14 → official matches first. */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (q.trim().length < 2) return NextResponse.json({ results: [] });
  const supabase = await createClient();
  const near = readPoint(request);
  // "Munich cafe" → real cafés; otherwise official sights first.
  const query = q.slice(0, 120);
  const [category, sights, named] = await Promise.all([
    categorySuggestions(query, near),
    searchPlaces(supabase, query, near),
    searchNamedPlaces(query, near),
  ]);
  if (category.length) return NextResponse.json({ results: [...category, ...sights.slice(0, 3)] });
  // Official listings first, then named places from the map (restaurants, beer halls, shops), then Wikidata sights.
  const official = sights.filter((s) => s.source === "official");
  const others = sights.filter((s) => s.source !== "official");
  const results: typeof sights = [];
  for (const s of [...official, ...named, ...others]) {
    const dup = results.some((r) => distanceKm(r, s) < 0.25 && (r.name.toLowerCase().includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(r.name.toLowerCase())));
    if (!dup) results.push(s);
  }
  return NextResponse.json({ results: results.slice(0, 8) });
}
