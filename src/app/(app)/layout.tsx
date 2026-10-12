import { LogOut } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { Avatar } from "@/components/avatar";
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
      <aside className="sticky top-0 z-20 flex items-center justify-between gap-4 bg-sidebar px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-sidebar-foreground lg:h-dvh lg:flex-col lg:items-stretch lg:justify-start lg:px-4 lg:py-6">
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
          <form action={signOut} className="max-lg:hidden">
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
      <main className="min-w-0 px-4 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-8 lg:px-12">{children}</main>
    </div>
  );
}

async function CurrentUser() {
  const { supabase, userId } = await requireUserId();
  // One row per person per day, for the "came back" number on /admin/stats.
  await supabase.rpc("touch_activity");
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, home_currency, avatar_url")
    .eq("id", userId)
    .maybeSingle();
  return (
    <Link
      href="/account"
      className="hidden items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-travel lg:flex"
    >
      <Avatar name={profile?.display_name} url={profile?.avatar_url} size={32} />
      <span className="min-w-0">
        <span className="block truncate text-white">{profile?.display_name ?? "Traveler"}</span>
        <span className="block text-xs text-sidebar-foreground/70">Home currency {profile?.home_currency ?? "USD"}</span>
      </span>
    </Link>
  );
}
