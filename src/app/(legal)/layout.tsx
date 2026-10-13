import Link from "next/link";

import { LegalLinks } from "@/components/layout/legal-links";
import { Wordmark } from "@/components/layout/wordmark";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-6 py-5">
        <Link href="/" className="text-foreground">
          <Wordmark />
        </Link>
        <LegalLinks className="justify-end text-muted-foreground" />
      </header>
      <main className="mx-auto max-w-3xl px-6 pt-6 pb-20 [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_li]:mt-1.5 [&_p]:mt-3 [&_p]:leading-relaxed [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
        {children}
      </main>
    </div>
  );
}
