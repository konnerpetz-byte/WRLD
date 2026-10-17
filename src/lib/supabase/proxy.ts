import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/", "/plan", "/tickets", "/points-check", "/sitemap.xml", "/robots.txt", "/opengraph-image", "/login", "/signup", "/auth", "/privacy", "/terms", "/cookies", "/refunds", "/accessibility", "/delete-account", "/invite", ...(process.env.NODE_ENV === "production" ? [] : ["/dev"])];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || (p !== "/" && pathname.startsWith(`${p}/`)));
}

/** Refreshes the auth cookie on every request and sends signed-out visitors to /login. */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    },
  );

  // Do not run other code between creating the client and this call —
  // it refreshes the session and can otherwise log users out at random.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  if (!signedIn && !isPublic(request.nextUrl.pathname)) {
    // Come back to the same page and filters after signing in (safePath checks it on the way back).
    const url = new URL("/login", request.nextUrl.origin);
    const back = request.nextUrl.pathname + request.nextUrl.search;
    url.searchParams.set("next", back.length <= 512 ? back : request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Return the response that setAll last built, so refreshed cookies reach the browser.
  return supabaseResponse;
}
