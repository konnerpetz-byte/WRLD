import { NextResponse, type NextRequest } from "next/server";

import { searchPlaces } from "@/features/attractions/search";
import { createClient } from "@/lib/supabase/server";
import { readPoint } from "../read-point";

/** GET /api/places/search?q=sintra&lat=38.72&lng=-9.14 → official matches first. */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (q.trim().length < 2) return NextResponse.json({ results: [] });
  const supabase = await createClient();
  const results = await searchPlaces(supabase, q.slice(0, 120), readPoint(request));
  return NextResponse.json({ results });
}
