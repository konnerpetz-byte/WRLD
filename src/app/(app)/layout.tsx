import { LogOut } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { AppNav, NavLinks } from "@/components/layout/app-nav";
import { Wordmark } from "@/components/layout/wordmark";
import { signOut } from "@/features/auth/actions";
import { requireUserId } from "@/lib/supabase/server";

/**
 * The shell (logo, nav) is static and shows instantly.
 * Anything that reads the signed-in user streams in behind <Suspense>.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr] lg:bg-[linear-gradient(to_right,var(--sidebar)_15rem,var(--background)_15rem)]">
      <aside className="sticky top-0 z-20 flex items-center justify-between gap-4 bg-sidebar px-4 py-3 text-sidebar-foreground lg:h-dvh lg:flex-col lg:items-stretch lg:justify-start lg:px-4 lg:py-6">
        <Link href="/trips" className="px-2 text-white lg:mb-8">
          <Wordmark />
        </Link>
        <Suspense fallback={<NavLinks />}>
          <AppNav />
        </Suspense>
        <div className="flex items-center gap-2 lg:mt-auto lg:flex-col lg:items-stretch lg:border-t lg:border-white/10 lg:pt-4">
          <Suspense fallback={<div className="hidden h-9 lg:block" />}>
            <CurrentUser />
          </Suspense>
          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-travel"
            >
              <LogOut className="size-4" aria-hidden="true" />
              <span className="max-sm:sr-only">Sign out</span>
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-8 sm:px-8 lg:px-12">{children}</main>
    </div>
  );
}

async function CurrentUser() {
  const { supabase, userId } = await requireUserId();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, home_currency")
    .eq("id", userId)
    .maybeSingle();
  return (
    <div className="hidden px-3 text-sm lg:block">
      <p className="text-white">{profile?.display_name ?? "Traveler"}</p>
      <p className="text-xs text-sidebar-foreground/70">Home currency {profile?.home_currency ?? "USD"}</p>
    </div>
  );
}
