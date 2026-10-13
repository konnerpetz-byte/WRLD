import Link from "next/link";

import { CONTACT_EMAIL, LEGAL_UPDATED } from "@/features/legal/version";

export const metadata = { title: "Refund Policy" };

export default function RefundsPage() {
  return (
    <article>
      <h1 className="text-4xl font-semibold">Refund Policy</h1>
      <p className="text-muted-foreground">Last updated {LEGAL_UPDATED}</p>

      <h2>WRLD is free right now</h2>
      <p>
        You can&rsquo;t buy anything from WRLD today, so there&rsquo;s nothing to refund. This page explains how refunds will work
        once paid features launch, so you know before you ever pay.
      </p>

      <h2>Bookings with partners</h2>
      <p>
        Tours, tickets, flights and stays you book through links in WRLD are sold by that provider (for example Viator,
        GetYourGuide, an airline or an attraction&rsquo;s official ticket office). Their cancellation and refund rules apply, and
        refunds come from them. We&rsquo;re happy to help you find the right contact:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-2">
          {CONTACT_EMAIL}
        </a>
        .
      </p>

      <h2>When paid features launch</h2>
      <ul>
        <li>
          <strong>Trip Pass (one trip):</strong> full refund if you ask within 14 days of buying and before the trip starts.
        </li>
        <li>
          <strong>WRLD Pro (subscription):</strong> cancel any time and keep Pro until the end of the period you paid for. If you
          cancel within 14 days of your first payment, you&rsquo;ll get a full refund. Renewals aren&rsquo;t refunded for partial
          periods unless the law requires it.
        </li>
        <li>
          <strong>If something doesn&rsquo;t work:</strong> if a paid feature doesn&rsquo;t work as described and we can&rsquo;t fix
          it, we&rsquo;ll refund you.
        </li>
        <li>
          <strong>App Store and Google Play purchases:</strong> refunds go through Apple or Google under their policies. We
          can&rsquo;t issue them directly.
        </li>
      </ul>
      <p>
        Nothing in this policy limits your rights under consumer law where you live (for example, the 14-day withdrawal right in the
        EU and UK).
      </p>

      <h2>How to ask</h2>
      <p>
        Email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-2">
          {CONTACT_EMAIL}
        </a>{" "}
        from your account&rsquo;s email address. Refunds go back to the original payment method, usually within 5 to 10 business
        days. See also our{" "}
        <Link href="/terms" className="text-primary underline underline-offset-2">
          Terms of Service
        </Link>
        .
      </p>
    </article>
  );
}
