import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";

import type { Database } from "@/types/database";

/** Supabase client for Server Components, Server Actions and Route Handlers. */
export async function createClient() {
  // Signed-in data is always per request. Saying so up front also keeps
  // Next.js from prerendering past the auth client, which reads the clock
  // (Date.now) to check token expiry.
  await connection();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Safe to ignore: src/proxy.ts refreshes the session on every request.
          }
        },
      },
    },
  );
}

/** The signed-in user's id, or a redirect to /login. Uses getClaims (verified token). */
export async function requireUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  return { supabase, userId };
}

/** For public pages: the client, plus the visitor's id when they happen to be signed in. */
export async function optionalUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: (data?.claims?.sub as string | undefined) ?? null };
}
