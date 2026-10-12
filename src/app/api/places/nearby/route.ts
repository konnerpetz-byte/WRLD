import { NextResponse, type NextRequest } from "next/server";

import { nearbyPlaces } from "@/features/attractions/search";
import { createClient } from "@/lib/supabase/server";
import { readPoint } from "../read-point";

/** GET /api/places/nearby?lat=38.79&lng=-9.39&exclude=Pena → sights around a stop. */
export async function GET(request: NextRequest) {
  const at = readPoint(request);
  if (!at) return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  const supabase = await createClient();
  const exclude = request.nextUrl.searchParams.get("exclude") ?? undefined;
  return NextResponse.json({ results: await nearbyPlaces(supabase, at, exclude) });
}
