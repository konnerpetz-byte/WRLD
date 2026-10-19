"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/cookies", label: "Cookies" },
  { href: "/refunds", label: "Refunds" },
  { href: "/accessibility", label: "Accessibility" },
  { href: "/how-wrld-works", label: "How WRLD earns" },
];

/** Links to the legal pages; the page you're on is marked. */
export function LegalLinks({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Legal" className={cn("flex flex-wrap gap-x-4 gap-y-2 text-sm", className)}>
      {LINKS.map((l) => {
        const current = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "rounded-sm underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              current && "font-medium text-foreground underline decoration-primary decoration-2",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
