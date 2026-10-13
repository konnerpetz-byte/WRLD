import Link from "next/link";

import { CONTACT_EMAIL, LEGAL_ADDRESS, LEGAL_NAME, LEGAL_UPDATED } from "@/features/legal/version";

export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <article>
      <h1 className="text-4xl font-semibold">Terms of Service</h1>
      <p className="text-muted-foreground">Last updated {LEGAL_UPDATED}</p>

      <p>
        These terms are an agreement between you and {LEGAL_NAME}
        {LEGAL_ADDRESS ? ` (${LEGAL_ADDRESS})` : ""} (&ldquo;WRLD&rdquo;, &ldquo;we&rdquo;) for using wrldtrips.com and the WRLD
        apps. By creating an account you agree to them and to our{" "}
        <Link href="/privacy" className="text-primary underline underline-offset-2">
          Privacy Policy
        </Link>
        . If you don&rsquo;t agree, please don&rsquo;t use WRLD.
      </p>

      <h2>1. Who can use WRLD</h2>
      <p>
        You must be at least 13 years old (16 in the EU and UK), and old enough to agree to these terms where you live. Keep your
        password private; you&rsquo;re responsible for activity on your account.
      </p>

      <h2>2. What WRLD is, and isn&rsquo;t</h2>
      <ul>
        <li>WRLD is a planning tool. We are not a travel agency, airline, tour operator or seller of travel.</li>
        <li>
          Bookings you make through links in WRLD (tours, tickets, flights, stays) are contracts between you and that provider, under
          their terms, prices and refund rules. We aren&rsquo;t responsible for their services.
        </li>
        <li>
          Prices, opening times, award seats, transfer ratios, official links and entry rules shown in WRLD come from public and
          partner sources, change often and may be wrong or out of date. Always confirm with the provider or official government
          site before you book, move points or travel.
        </li>
        <li>
          Travel-document information is a reminder, not legal or immigration advice. You&rsquo;re responsible for having the right
          passport, visas and permissions for your trip.
        </li>
        <li>Award-flight results may be samples or delayed; points transfers usually can&rsquo;t be undone.</li>
      </ul>

      <h2>3. Partner links and commissions</h2>
      <p>
        Some links to booking sites (for example Viator and GetYourGuide) are affiliate links. If you book after following one, WRLD
        may earn a commission at no extra cost to you. This never changes the price you pay. Suggestions are ranked by how well they
        fit your travel type, not by commission.
      </p>

      <h2>4. Your content</h2>
      <ul>
        <li>
          You own what you add to WRLD (trips, notes, photos, messages, saved links). You give us permission to store, display and
          process it only to run WRLD for you and the people you share trips with.
        </li>
        <li>
          Everyone on a trip can see and, depending on their role, edit that trip&rsquo;s content. Only invite people you trust.
        </li>
        <li>
          Only add content you have the right to share. If you believe something in WRLD infringes your rights, email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-2">
            {CONTACT_EMAIL}
          </a>{" "}
          and we&rsquo;ll review it promptly.
        </li>
      </ul>

      <h2>5. Acceptable use</h2>
      <p>Don&rsquo;t use WRLD to:</p>
      <ul>
        <li>break the law, or harass, threaten or impersonate anyone;</li>
        <li>post illegal, hateful, sexual or violent content, spam or malware;</li>
        <li>access other people&rsquo;s accounts or trips without permission, or try to get around our security;</li>
        <li>scrape, copy or resell WRLD&rsquo;s data, or overload our services with automated requests.</li>
      </ul>
      <p>We may remove content or suspend accounts that break these rules.</p>

      <h2>6. Paid features</h2>
      <p>
        WRLD is free today. If we offer paid features (such as a Trip Pass or WRLD Pro), we&rsquo;ll show the price, what&rsquo;s
        included, how renewals and cancellation work and our{" "}
        <Link href="/refunds" className="text-primary underline underline-offset-2">
          Refund Policy
        </Link>{" "}
        before you pay. Purchases made in the Apple App Store or Google Play also follow their rules.
      </p>

      <h2>7. Third-party services and data</h2>
      <p>
        WRLD uses other services to work: map data © OpenStreetMap contributors (Open Database License), map tiles from OpenFreeMap,
        place information from Wikidata and Wikipedia, and partner listings from Viator. Their content belongs to them and is
        provided as is.
      </p>

      <h2>8. Ending your account</h2>
      <p>
        You can delete your account at any time from the Account page. We may suspend or close accounts that break these terms or
        to comply with the law. If we stop offering WRLD, we&rsquo;ll give reasonable notice where we can so you can save your
        trips.
      </p>

      <h2>9. Disclaimers</h2>
      <p>
        WRLD is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. To the extent the law allows, we make no warranties
        that it will be error-free or always available, or that information in it is accurate or complete. Some places don&rsquo;t
        allow these exclusions, so they may not all apply to you.
      </p>

      <h2>10. Limit on liability</h2>
      <p>
        To the extent the law allows, WRLD isn&rsquo;t liable for indirect, incidental or consequential losses, or for missed
        flights, bookings, entry refusals or other travel problems, and our total liability for any claim is limited to the
        greater of the amount you paid us in the 12 months before the claim or US$50. Nothing in these terms limits liability that
        can&rsquo;t be limited by law, or your rights as a consumer where you live.
      </p>

      <h2>11. Law and disputes</h2>
      <p>
        These terms are governed by the laws of the State of Michigan, USA, without regard to conflict-of-law rules. Before filing a
        claim, please email us so we can try to resolve it. Disputes will be handled in the state or federal courts located in
        Wayne County, Michigan, unless the law where you live gives you the right to bring a claim in your local courts.
      </p>

      <h2>12. Changes to these terms</h2>
      <p>
        If we make a material change, we&rsquo;ll tell you in the app or by email before it takes effect. Continuing to use WRLD
        after that means you accept the new terms.
      </p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-2">
          {CONTACT_EMAIL}
        </a>
      </p>
    </article>
  );
}
