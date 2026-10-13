import { type NextRequest, NextResponse } from "next/server";

import { searchAirports } from "@/features/places/airports";

/** GET /api/airports?q=munich → matching airports (city, name or code). */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 80);
  return NextResponse.json(await searchAirports(q), { headers: { "Cache-Control": "public, max-age=86400" } });
}
