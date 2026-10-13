"use client";

import { Plane, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/points", label: "Compare flights", icon: Plane },
  { href: "/points/wallet", label: "My points", icon: Wallet },
];

export function PointsTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Points or cash" className="flex gap-1 border-b">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm whitespace-nowrap focus-visible:outline-2 focus-visible:outline-ring ${
              active ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
