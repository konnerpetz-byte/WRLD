"use client";

import { Bookmark, CircleUserRound, Compass, Luggage, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/trips", label: "Trips", icon: Luggage },
  { href: "/saved", label: "Saved spots", icon: Bookmark },
  { href: "/wallet", label: "Points wallet", icon: Wallet },
  { href: "/profile", label: "Travel type", icon: Compass },
  { href: "/account", label: "Account", icon: CircleUserRound },
];

export function AppNav() {
  const pathname = usePathname();
  return <NavLinks pathname={pathname} />;
}

/** Same links with nothing highlighted; shown until the current path is known. */
export function NavLinks({ pathname = "" }: { pathname?: string }) {
  return (
    <nav aria-label="Main" className="flex gap-0.5 sm:gap-1 lg:flex-col">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-md px-2 py-2 text-sm sm:px-3 transition-colors focus-visible:outline-2 focus-visible:outline-travel ${
              active ? "bg-white/10 font-medium text-white" : "text-sidebar-foreground/80 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon className="size-4" aria-hidden="true" />
            <span className="max-lg:sr-only">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
