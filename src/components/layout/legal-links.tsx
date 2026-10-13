import Link from "next/link";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/cookies", label: "Cookies" },
  { href: "/refunds", label: "Refunds" },
  { href: "/accessibility", label: "Accessibility" },
];

/** Footer links to the legal pages. */
export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Legal" className={cn("flex flex-wrap gap-x-4 gap-y-2 text-sm", className)}>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="underline-offset-4 hover:underline focus-visible:underline">
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
