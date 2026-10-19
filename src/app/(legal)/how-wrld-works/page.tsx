import Link from "next/link";

import { CONTACT_EMAIL } from "@/features/legal/version";

export const metadata = {
  title: "How WRLD prices trips and earns money",
  description: "Which prices in WRLD are live, which are estimates and how they're made, and how WRLD earns money.",
};

/** Plain answers to "is this price real?" and "how does WRLD make money?", linked from every estimate and partner link. */
export default function HowWrldWorksPage() {
  return (
    <article>
      <h1 className="text-4xl font-semibold tracking-[-0.02em]">How WRLD prices trips and earns money</h1>
      <p className="text-muted-foreground">
        WRLD shows what a trip will likely cost so a group can decide where to go. Most numbers are estimates to plan with, not quotes.
        Here is which is which, and how we earn money.
      </p>

      <h2 id="prices">What&rsquo;s live and what&rsquo;s estimated</h2>
      <ul>
        <li>
          <strong>Live:</strong> the prices you see after you tap <em>Live stays</em> (Airbnb, Booking.com, Google Hotels), <em>See fares
          on Google Flights</em>, Viator tours and official ticket pages. Those sites set the price.
        </li>
        <li>
          <strong>Estimated:</strong> every total on a WRLD trip card, marked <em>est.</em> Use it to compare places and set a budget,
          then check the live links before you book.
        </li>
      </ul>

      <h3>Flights</h3>
      <p>
        When recent fares are available for your month, WRLD uses the lowest ones travelers found (Aviasales data via Travelpayouts).
        Otherwise it estimates from distance, adjusted for the month: U.S. trips cost more in June, July and over the holidays and less
        after mid-August; Europe peaks June to August; the Caribbean and Mexico peak in winter and spring.
      </p>

      <h3>Hotels and days there</h3>
      <p>
        WRLD starts from U.S. government per diem rates for the month you pick: the State Department&rsquo;s rates for 1,000+ places
        abroad and GSA&rsquo;s month-by-month rates for about 300 U.S. destinations. Those are what a business traveler is reimbursed, so
        WRLD scales them down to leisure travel and re-measures that scale as travelers log what they really spent. Places without a
        government rate use WRLD&rsquo;s own estimate for that kind of place and season.
      </p>

      <h3>Road trips</h3>
      <ul>
        <li>Gas: the government&rsquo;s weekly average price for your region (or the national average), at 25 miles a gallon, one car for every four people.</li>
        <li>Drive time: real road routes when available, otherwise distance at highway speed with stops.</li>
        <li>
          Places to stay: hotel rooms for two, or for groups of five or more a whole vacation house when that&rsquo;s cheaper, including
          typical cleaning and service fees. Lake towns, ski towns and beaches follow their busy and quiet seasons.
        </li>
      </ul>

      <h3>How close are the estimates?</h3>
      <p>
        Close enough to choose between places, not close enough to budget to the dollar. Expect real prices to differ by 15% or more,
        especially for holiday weekends, festivals and last-minute trips. If something looks wrong, tell us at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">
          {CONTACT_EMAIL}
        </a>
        .
      </p>

      <h2 id="money">How WRLD earns money</h2>
      <ul>
        <li>
          <strong>Partner commissions.</strong> Some links to tours and activities (Viator, GetYourGuide) pay WRLD a commission when you
          book. You pay the same price. Those links are marked &ldquo;WRLD may earn a commission.&rdquo;
        </li>
        <li>
          <strong>Never at your expense.</strong> When an attraction sells tickets on its own site, WRLD shows that official price first,
          and labels resellers as resellers.
        </li>
        <li>
          <strong>Later, paid features.</strong> Planning, invites, group chat, voting and splitting costs stay free. Extras such as a
          Trip Pass for the whole group may cost money; see the{" "}
          <Link href="/refunds" className="text-primary underline">
            refund policy
          </Link>{" "}
          for how that will work.
        </li>
      </ul>
      <p>
        WRLD does not sell your data. See the{" "}
        <Link href="/privacy" className="text-primary underline">
          privacy policy
        </Link>
        .
      </p>
    </article>
  );
}
