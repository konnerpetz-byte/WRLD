"use client";

import { Bookmark, CircleUserRound, Compass, Luggage } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * In the order people use WRLD: their trips, ideas for the next one, places they've saved, and
 * themselves. Points are optional, so the wallet lives inside Explore and You, not in the tab bar. Each link also owns
 * the pages under it (`also`), so the right one stays highlighted.
 */
const LINKS = [
  { href: "/trips", label: "Trips", short: "Trips", icon: Luggage, also: [] as string[], exact: false },
  { href: "/points", label: "Explore", short: "Explore", icon: Compass, also: ["/points/share", "/points/wallet"], exact: true },
  { href: "/saved", label: "Saved spots", short: "Saved", icon: Bookmark, also: [], exact: false },
  { href: "/account", label: "You", short: "You", icon: CircleUserRound, also: ["/profile"], exact: false },
];

export function AppNav() {
  const pathname = usePathname();
  return <NavLinks pathname={pathname} />;
}

/**
 * Same links with nothing highlighted; shown until the current path is known.
 * Phones: a labeled tab bar along the bottom, within thumb reach, on a
 * translucent material that content scrolls under. Desktop: the sidebar list.
 */
export function NavLinks({ pathname = "" }: { pathname?: string }) {
  return (
    <nav
      aria-label="Main"
      className="material-dark fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-white/10 px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] lg:static lg:flex lg:flex-col lg:gap-1 lg:border-0 lg:bg-transparent lg:p-0 lg:[-webkit-backdrop-filter:none] lg:[backdrop-filter:none]"
    >
      {LINKS.map(({ href, label, short, icon: Icon, also, exact }) => {
        const under = (p: string) => pathname === p || pathname.startsWith(`${p}/`);
        const active = (exact ? pathname === href : under(href)) || also.some(under);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            data-tour={short.toLowerCase()}
            className={`flex flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[11px] leading-none font-medium transition-[color,background-color,transform] duration-150 focus-visible:outline-2 focus-visible:outline-travel motion-safe:active:scale-95 lg:flex-row lg:gap-3 lg:px-3 lg:py-2 lg:text-sm lg:leading-normal lg:font-normal ${
              active ? "text-white lg:bg-white/10 lg:font-medium" : "text-sidebar-foreground/75 hover:text-white lg:hover:bg-white/5"
            }`}
          >
            <span className={`grid h-7 w-12 place-items-center rounded-full transition-colors lg:size-auto ${active ? "bg-white/15 lg:bg-transparent" : ""}`}>
              <Icon className="size-[1.15rem] lg:size-4" aria-hidden="true" />
            </span>
            <span className="max-w-full truncate lg:hidden">{short}</span>
            <span className="max-lg:hidden">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
