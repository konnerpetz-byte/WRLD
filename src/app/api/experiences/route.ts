import { NextResponse, type NextRequest } from "next/server";

import { suggestionsForBlock } from "@/features/experiences/for-trip";
import { createClient } from "@/lib/supabase/server";

/** GET /api/experiences?trip=…&block=… → bookable experiences for that part of the day. */
export async function GET(request: NextRequest) {
  const trip = request.nextUrl.searchParams.get("trip") ?? "";
  const block = request.nextUrl.searchParams.get("block") ?? "";
  const uuid = /^[\w-]{1,64}$/;
  if (!uuid.test(trip) || !uuid.test(block)) return NextResponse.json({ error: "trip and block are required" }, { status: 400 });

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const result = await suggestionsForBlock(supabase, userId, trip, block, 3);
  if (!result) return NextResponse.json({ mode: "links", offers: [], links: [], city: null });
  return NextResponse.json(result);
}
