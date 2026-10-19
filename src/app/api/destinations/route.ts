import { type NextRequest, NextResponse } from "next/server";

import { searchAirports } from "@/features/places/airports";
import { searchCities } from "@/features/places/geocode";
import { withApprovedPlaces } from "@/features/planner/approved-places";
import { matchGetaways } from "@/features/planner/drive";

export type DestinationOption = {
  /** What goes in the form: a town or road-trip name, or an airport code */
  value: string;
  label: string;
  detail: string;
  kind: "drive" | "place" | "airport";
};

/** GET /api/destinations?q=torch → road-trip spots, towns and airports for the planner's "Going to". */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json([]);
  await withApprovedPlaces();
  const drives: DestinationOption[] = matchGetaways(q, 4).map((g) => ({
    value: `${g.name}, ${g.state}`,
    label: `${g.name}, ${g.state}`,
    detail: `Road trip · ${g.why}`,
    kind: "drive",
  }));
  const [airports, towns] = await Promise.all([
    searchAirports(q, 5),
    drives.length || q.length < 3 ? Promise.resolve([]) : searchCities(q, 3).catch(() => []),
  ]);
  const places: DestinationOption[] = towns.map((t) => ({ value: t.label, label: t.label, detail: "Town or city", kind: "place" }));
  // With a road-trip match, show only airports whose own name or city matched, not the
  // look-alike place the airport search falls back to (there's a second Torch Lake up north).
  const flights: DestinationOption[] = airports.filter((a) => !drives.length || a.km == null).map((a) => ({
    value: `${a.city} (${a.code})`,
    label: a.city,
    detail: `Fly into ${a.name} (${a.code})${a.km != null ? `, ${a.km} km away` : ""}`,
    kind: "airport",
  }));
  return NextResponse.json([...drives, ...places, ...flights].slice(0, 8), { headers: { "Cache-Control": "public, max-age=86400" } });
}
