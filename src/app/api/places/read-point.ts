import type { NextRequest } from "next/server";

export function readPoint(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));
  const has = request.nextUrl.searchParams.has("lat") && request.nextUrl.searchParams.has("lng");
  return has && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ? { latitude: lat, longitude: lng }
    : null;
}
