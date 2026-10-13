import Link from "next/link";

import { LegalLinks } from "@/components/layout/legal-links";
import { Wordmark } from "@/components/layout/wordmark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
        <Link href="/" className="text-white">
          <Wordmark />
        </Link>
        <div className="max-w-md">
          <p className="font-display text-4xl leading-tight text-white">
            Plan around the flight you&rsquo;re actually on.
          </p>
          <p className="mt-4 text-sidebar-foreground/80">
            Your days start when you land, your points live in one place, and every ticket you add shows up in the budget.
          </p>
        </div>
        <DepartureStrip />
      </aside>
      <main className="flex flex-col items-center justify-center p-6 pt-[max(1.5rem,env(safe-area-inset-top))] sm:p-10">
        {/* On phones the brand panel is hidden, so keep a way home at the top. */}
        <Link href="/" aria-label="WRLD home" className="mb-10 self-start rounded-md text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring lg:hidden">
          <Wordmark />
        </Link>
        <div className="w-full max-w-sm max-lg:my-auto">
          {children}
          <LegalLinks className="mt-10 text-muted-foreground" />
        </div>
      </main>
    </div>
  );
}

function DepartureStrip() {
  const rows = [
    ["TP 212", "Lisbon", "Land 11:00 PM", "Check in"],
    ["UA 958", "Chicago", "Land 2:15 PM", "Free from 4 PM"],
    ["DL 98", "Tokyo", "Land 3:40 PM", "Free from 6 PM"],
  ];
  return (
    <table className="w-full max-w-md text-sm">
      <tbody>
        {rows.map(([flight, city, land, status]) => (
          <tr key={flight} className="border-t border-white/10">
            <td className="py-2 pr-3 font-medium text-travel">{flight}</td>
            <td className="py-2 pr-3 text-white">{city}</td>
            <td className="py-2 pr-3">{land}</td>
            <td className="py-2 text-right">{status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
