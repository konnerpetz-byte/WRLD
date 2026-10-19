import { PAUSED } from "@/lib/paused";
import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { consentUrl } from "@/features/awards/seats-aero";
import { createClient } from "@/lib/supabase/server";

/** Starts "Login with Seats.aero": a random state in an httpOnly cookie, then Seats.aero's consent page. */
export async function GET(request: Request) {
  if (PAUSED.seatsAero) return new NextResponse(null, { status: 404 });
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const site = new URL(request.url).origin;
  if (!data?.claims?.sub) return NextResponse.redirect(new URL("/login?next=%2Fpoints", site));
  const state = randomBytes(32).toString("hex");
  const url = consentUrl(state);
  if (!url) return NextResponse.redirect(new URL("/points?seats=unavailable", site));
  const res = NextResponse.redirect(url);
  res.cookies.set("seats_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/seats", maxAge: 600 });
  return res;
}
