import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const KINDS = new Set(["booking_click", "suggestions_shown"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Stores one stats event for the signed-in user. Always answers 204. */
export async function POST(request: Request) {
  const done = new NextResponse(null, { status: 204 });
  let input: { kind?: unknown; tripId?: unknown; provider?: unknown; count?: unknown };
  try {
    input = await request.json();
  } catch {
    return done;
  }
  if (typeof input.kind !== "string" || !KINDS.has(input.kind)) return done;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return done;

  const tripId = typeof input.tripId === "string" && UUID.test(input.tripId) ? input.tripId : null;
  const provider = typeof input.provider === "string" && /^[a-z]{1,40}$/.test(input.provider) ? input.provider : null;
  const count = typeof input.count === "number" ? Math.min(50, Math.max(1, Math.round(input.count))) : 1;

  const row = { user_id: userId, kind: input.kind as "booking_click" | "suggestions_shown", trip_id: tripId, provider, count };
  const { error } = await supabase.from("app_events").insert(row);
  // A trip the user can't see fails the foreign key/RLS check; keep the event without it.
  if (error && tripId) await supabase.from("app_events").insert({ ...row, trip_id: null });
  return done;
}
