import Link from "next/link";

import { LegalLinks } from "@/components/layout/legal-links";
import { Wordmark } from "@/components/layout/wordmark";
import { Button } from "@/components/ui/button";

/** Header for the public pages (home, points check, shared trips). */
export function SiteHeader({ cta = { href: "/signup", label: "Start a trip" } }: { cta?: { href: string; label: string } }) {
  return (
    // Translucent bar: the page scrolls under it; a hairline appears only once content is beneath.
    <header className="material-light scroll-edge sticky top-0 z-30 pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-6">
        <Link href="/" aria-label="WRLD home" className="rounded-md text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          <Wordmark />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/plan"
            className="tap rounded-md px-3 py-2 text-sm font-medium max-md:hidden hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
          >
            Where can we go?
          </Link>
          <Link
            href="/tickets"
            className="tap rounded-md px-3 py-2 text-sm font-medium max-lg:hidden hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
          >
            Official tickets
          </Link>
          <Button asChild variant="ghost">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild className="max-sm:hidden">
            <Link href={cta.href}>{cta.label}</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground">
      <p>
        © 2026 WRLD. Map data ©{" "}
        <a href="https://www.openstreetmap.org/copyright" className="underline underline-offset-4">
          OpenStreetMap contributors
        </a>
        .
      </p>
      <nav aria-label="Explore" className="flex flex-wrap gap-x-4 gap-y-2">
        <Link href="/plan" className="inline-block py-1 hover:text-foreground hover:underline">
          Budget planner
        </Link>
        <Link href="/getaways" className="inline-block py-1 hover:text-foreground hover:underline">
          Road trips
        </Link>
        <Link href="/tickets" className="inline-block py-1 hover:text-foreground hover:underline">
          Official tickets
        </Link>
      </nav>
      <LegalLinks />
    </footer>
  );
}
