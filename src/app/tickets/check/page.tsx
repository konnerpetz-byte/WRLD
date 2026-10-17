import { CircleAlert, CircleCheck, CircleHelp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { allTicketPlaces, checkLink, hostOf, type LinkVerdict } from "@/features/tickets/data";
import { LinkCheckForm } from "@/features/tickets/link-check-form";

export const metadata: Metadata = {
  title: "Is this ticket site official?",
  description: "Paste a ticket link for a famous attraction and find out if it's the official site or a lookalike that charges more.",
  alternates: { canonical: "/tickets/check" },
};

export default function CheckPage({ searchParams }: PageProps<"/tickets/check">) {
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 pt-8 pb-20 sm:px-6 lg:pt-14">
        <h1 className="font-display text-4xl leading-[1.05] font-bold tracking-[-0.03em] sm:text-5xl">Is this ticket site official?</h1>
        <Suspense fallback={<div className="mt-8"><LinkCheckForm /></div>}>
          <Result searchParams={searchParams} />
        </Suspense>
        <p className="mt-10 text-sm text-muted-foreground">
          We compare the address with official sites we&rsquo;ve checked by hand.{" "}
          <Link href="/tickets" className="font-medium text-primary underline underline-offset-4">
            See the full list
          </Link>
          .
        </p>
      </main>
      <div className="border-t pb-[env(safe-area-inset-bottom)]">
        <SiteFooter />
      </div>
    </div>
  );
}

async function Result({ searchParams }: { searchParams: PageProps<"/tickets/check">["searchParams"] }) {
  const sp = await searchParams;
  const url = (Array.isArray(sp.url) ? sp.url[0] : sp.url)?.slice(0, 500) ?? "";
  const verdict = url ? checkLink(url, await allTicketPlaces()) : null;
  return (
    <>
      <div className="mt-8">
        <LinkCheckForm value={url} />
      </div>
      {verdict && <Verdict v={verdict} />}
    </>
  );
}

function Verdict({ v }: { v: LinkVerdict }) {
  const box = "mt-8 rounded-3xl p-6 sm:p-8";
  if (v.kind === "invalid")
    return (
      <p role="alert" className={`${box} border text-[17px]`}>
        That doesn&rsquo;t look like a web address. Paste the link from your browser&rsquo;s address bar.
      </p>
    );
  if (v.kind === "official")
    return (
      <section aria-live="polite" className={`${box} bg-primary text-primary-foreground`}>
        <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
          <CircleCheck className="size-6 text-travel" aria-hidden="true" /> Official
        </h2>
        <p className="mt-2 text-[17px]">
          <strong>{v.host}</strong> is the official site for {v.place.name} in {v.place.city}.
        </p>
        <Link href={`/tickets/${v.place.slug}`} className="mt-4 inline-flex min-h-11 items-center font-medium underline underline-offset-4">
          Tips for visiting {v.place.name}
        </Link>
      </section>
    );
  if (v.kind === "lookalike") {
    const real = hostOf(v.place.tickets_url ?? v.place.official_url);
    return (
      <section aria-live="polite" className={`${box} bg-travel text-travel-foreground`}>
        <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
          <CircleAlert className="size-6" aria-hidden="true" /> Not the official site
        </h2>
        <p className="mt-2 text-[17px]">
          <strong>{v.host}</strong> uses the name of {v.place.name}, but it isn&rsquo;t the official site
          {real ? (
            <>
              , which is <strong>{real}</strong>
            </>
          ) : null}
          . It may be a reseller that charges more. Compare the price before you pay.
        </p>
        <Link href={`/tickets/${v.place.slug}`} className="mt-4 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
          Go to the official {v.place.name} site
        </Link>
      </section>
    );
  }
  return (
    <section aria-live="polite" className={`${box} border bg-card`}>
      <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
        <CircleHelp className="size-6 text-muted-foreground" aria-hidden="true" /> Not one we know
      </h2>
      <p className="mt-2 text-[17px]">
        <strong>{v.host}</strong> isn&rsquo;t an official site on our list, and it doesn&rsquo;t use the name of one either. Search for the
        attraction&rsquo;s name plus &ldquo;official site&rdquo;, scroll past the ads, and compare prices before paying.
      </p>
    </section>
  );
}
