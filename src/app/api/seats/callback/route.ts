import { PAUSED } from "@/lib/paused";
import { timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { exchangeCode } from "@/features/awards/seats-aero";
import { createClient } from "@/lib/supabase/server";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Finishes "Login with Seats.aero": checks state, swaps the code for tokens on the server, stores them encrypted. */
export async function GET(request: Request) {
  if (PAUSED.seatsAero) return new NextResponse(null, { status: 404 });
  const url = new URL(request.url);
  const back = (status: string) => {
    const res = NextResponse.redirect(new URL(`/points?seats=${status}`, url.origin));
    res.cookies.set("seats_oauth_state", "", { httpOnly: true, secure: true, sameSite: "lax", path: "/api/seats", maxAge: 0 });
    return res;
  };
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const expected = (await cookies()).get("seats_oauth_state")?.value ?? "";
  if (!code || code.length > 2000 || !state || !expected || !same(state, expected)) return back("failed");

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return back("failed");
  try {
    const t = await exchangeCode(code, state);
    const { error } = await supabase.rpc("seats_link_save", { p_access: t.access, p_refresh: t.refresh, p_expires_in: t.expiresIn });
    return back(error ? "failed" : "connected");
  } catch {
    return back("failed");
  }
}
