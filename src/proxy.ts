import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Skip static files and images.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|vendor/|\\.well-known/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mjs|txt|zip)$).*)",
  ],
};
