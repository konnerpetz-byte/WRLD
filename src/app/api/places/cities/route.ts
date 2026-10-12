import { NextResponse, type NextRequest } from "next/server";

import { searchCities } from "@/features/places/geocode";

/** GET /api/places/cities?q=Lis → [{ city, countryCode, latitude, longitude }] */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });
  const places = await searchCities(q.slice(0, 80));
  const seen = new Set<string>();
  const results = places
    .filter((p) => p.label && p.countryCode)
    .map((p) => ({ city: p.label, countryCode: p.countryCode, region: p.address, latitude: p.latitude, longitude: p.longitude }))
    .filter((p) => {
      const key = `${p.city}|${p.countryCode}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return NextResponse.json({ results });
}
