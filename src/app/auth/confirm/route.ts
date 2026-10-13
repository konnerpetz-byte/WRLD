import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { safePath } from "@/lib/safe-path";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for links in Supabase emails (confirm sign-up, magic link).
 * Handles both link styles Supabase can send:
 *   ?code=…                 (default template, PKCE flow)
 *   ?token_hash=…&type=…    (custom template using {{ .TokenHash }})
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safePath(searchParams.get("next"));

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }

  // The email is usually confirmed even when the session can't be created here
  // (for example, the link was opened in a different browser). Sign in works.
  return NextResponse.redirect(new URL("/login?error=link", request.url));
}
