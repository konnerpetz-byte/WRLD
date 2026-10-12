import Link from "next/link";

import { Wordmark } from "@/components/layout/wordmark";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link href="/" className="text-foreground">
          <Wordmark />
        </Link>
        <nav aria-label="Legal" className="flex gap-4 text-sm">
          <Link href="/privacy" className="text-muted-foreground hover:text-foreground">
            Privacy
          </Link>
          <Link href="/delete-account" className="text-muted-foreground hover:text-foreground">
            Delete account
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-6 pt-6 pb-20 [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_li]:mt-1.5 [&_p]:mt-3 [&_p]:leading-relaxed [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
        {children}
      </main>
    </div>
  );
}
