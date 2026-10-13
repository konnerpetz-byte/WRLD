import { NextResponse, type NextRequest } from "next/server";

import { suggestionsForBlock, suggestionsForTrip } from "@/features/experiences/for-trip";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/experiences?trip=…[&day=…]  → recommendations for "Add a place" (budget-aware)
 * GET /api/experiences?trip=…&block=…  → recommendations for one part of a day
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const trip = sp.get("trip") ?? "";
  const block = sp.get("block");
  const day = sp.get("day");
  const uuid = /^[\w-]{1,64}$/;
  if (!uuid.test(trip) || (block && !uuid.test(block)) || (day && !uuid.test(day))) {
    return NextResponse.json({ error: "A trip is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10);
  const result = block
    ? await suggestionsForBlock(supabase, userId, trip, block, 3)
    : await suggestionsForTrip(supabase, userId, trip, day || null, today);
  if (!result) return NextResponse.json({ mode: "links", offers: [], links: [], city: null, ideas: [] });
  return NextResponse.json(result);
}
