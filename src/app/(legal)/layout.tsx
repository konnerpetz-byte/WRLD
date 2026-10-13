import Link from "next/link";

import { LegalLinks } from "@/components/layout/legal-links";
import { Wordmark } from "@/components/layout/wordmark";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="material-light scroll-edge sticky top-0 z-30 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-3.5">
          <Link href="/" aria-label="WRLD home" className="rounded-md text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
            <Wordmark />
          </Link>
          <LegalLinks className="justify-end text-muted-foreground" />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 pt-10 pb-24 text-[1.0625rem] [&_h2]:mt-12 [&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_a]:underline-offset-2 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_li]:mt-1.5 [&_p]:mt-3 [&_p]:leading-relaxed [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
        {children}
      </main>
    </div>
  );
}
