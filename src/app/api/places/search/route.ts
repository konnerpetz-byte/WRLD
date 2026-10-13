import { NextResponse, type NextRequest } from "next/server";

import { searchPlaces } from "@/features/attractions/search";
import { categorySuggestions } from "@/features/places/category-search";
import { createClient } from "@/lib/supabase/server";
import { readPoint } from "../read-point";

/** GET /api/places/search?q=sintra&lat=38.72&lng=-9.14 → official matches first. */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (q.trim().length < 2) return NextResponse.json({ results: [] });
  const supabase = await createClient();
  const near = readPoint(request);
  // "Munich cafe" → real cafés; otherwise official sights first.
  const [category, sights] = await Promise.all([categorySuggestions(q.slice(0, 120), near), searchPlaces(supabase, q.slice(0, 120), near)]);
  const results = category.length ? [...category, ...sights.slice(0, 3)] : sights;
  return NextResponse.json({ results });
}
