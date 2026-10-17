import Link from "next/link";

import { CONTACT_EMAIL, LEGAL_ADDRESS, LEGAL_NAME, LEGAL_UPDATED } from "@/features/legal/version";

export const metadata = { title: "Privacy Policy" };

const Mail = () => (
  <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-2">
    {CONTACT_EMAIL}
  </a>
);

export default function PrivacyPage() {
  return (
    <article>
      <h1 className="text-4xl font-semibold">Privacy Policy</h1>
      <p className="text-muted-foreground">Last updated {LEGAL_UPDATED}</p>

      <p>
        WRLD (wrldtrips.com and the WRLD apps) is a trip planner run by {LEGAL_NAME}
        {LEGAL_ADDRESS ? `, ${LEGAL_ADDRESS}` : ""}. This policy explains what we collect, why, who we share it with, how long we keep
        it and the choices you have. Questions or requests: <Mail />.
      </p>

      <h2>The short version</h2>
      <ul>
        <li>We collect only what the app needs to plan your trips.</li>
        <li>We don&rsquo;t sell or share your personal information for advertising, and we don&rsquo;t show ads.</li>
        <li>We use only the cookies needed to keep you signed in. Our visitor statistics don&rsquo;t use cookies.</li>
        <li>You can get a copy of, correct or delete your information at any time.</li>
      </ul>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account:</strong> your name, email address and password. Passwords are stored hashed by our sign-in provider; we
          never see them. We also record when you agreed to our Terms and this policy, and which version.
        </li>
        <li>
          <strong>Profile (optional):</strong> photo, home country, home currency and home airport.
        </li>
        <li>
          <strong>Trips:</strong> cities, dates, activities, stays, flights and other travel legs, prices, budgets, expenses,
          checklists, document reminders, votes, saved links and group chat messages. People you invite to a trip can see that
          trip&rsquo;s content, your name, photo and travel type.
        </li>
        <li>
          <strong>Tickets and files:</strong> boarding passes, tickets and confirmations you upload to a trip. They&rsquo;re stored
          privately; only people on that trip can open them. Delete them any time from the trip&rsquo;s Export tab.
        </li>
        <li>
          <strong>Forwarded emails:</strong> booking confirmations you forward to your WRLD import address, with their PDF,
          calendar and image attachments. They wait in your private inbox until you review them; dismissing one deletes its
          attachments. Emails sent to an address that isn&rsquo;t yours are discarded.
        </li>
        <li>
          <strong>Travel type:</strong> your quiz answers and interests, used to suggest things to do.
        </li>
        <li>
          <strong>Points wallet:</strong> loyalty balances you type in, or that AwardWallet sends if you choose to connect it. We
          never ask for airline or bank passwords.
        </li>
        <li>
          <strong>Location:</strong> only when you tap &ldquo;Show where I am&rdquo; on the map. It stays on your device and is not
          stored.
        </li>
        <li>
          <strong>Usage information:</strong> the days you open the app, and when you open a booking link or see bookable
          suggestions, linked to your account. We use it to understand which features help and to measure partner bookings. Our
          hosting providers keep standard server logs (such as IP address and browser type) for security and troubleshooting, and
          count page visits without cookies (see Analytics below).
        </li>
      </ul>
      <p>
        We don&rsquo;t collect payment card details, government ID or passport numbers, or your location history.
      </p>

      <h2>Why we use it, and our legal basis</h2>
      <ul>
        <li>
          <strong>To provide WRLD</strong> (performing our contract with you): run your account, show and sync your trips, share them
          with the people you invite, place things on the map, fill in official ticket links, prices, time zones and travel-document
          reminders, and suggest things to do from your travel type.
        </li>
        <li>
          <strong>To keep WRLD secure and working</strong> (our legitimate interests): prevent abuse, fix problems and measure which
          features are used.
        </li>
        <li>
          <strong>When you ask us to</strong> (your consent): connect AwardWallet, or show your location on the map. You can withdraw
          consent at any time.
        </li>
        <li>
          <strong>To meet legal obligations:</strong> for example, responding to valid legal requests.
        </li>
      </ul>

      <h2>Who we share it with</h2>
      <p>We share information only with services that help run WRLD, and only what each one needs:</p>
      <ul>
        <li>
          <strong>Supabase</strong>: database, sign-in and photo storage, on servers in the United States.
        </li>
        <li>
          <strong>Vercel</strong>: website hosting and cookieless visitor statistics, United States.
        </li>
        <li>
          <strong>Anthropic</strong> (United States): when you import a screenshot or photo of a booking, the image may be sent to
          Anthropic&rsquo;s Claude model to read the flight, stay and traveler details, which you then check before anything is
          saved. Under Anthropic&rsquo;s commercial terms, this data isn&rsquo;t used to train its models.
        </li>
        <li>
          <strong>Map and place services:</strong> Photon (komoot), Nominatim (OpenStreetMap), OpenFreeMap, Wikidata and Wikipedia.
          They receive the place names, addresses or map areas you search for or view. Map tiles are requested by your browser, so
          OpenFreeMap sees your IP address.
        </li>
        <li>
          <strong>Booking and price partners:</strong> Viator receives activity searches (a city and a kind of activity, never your
          name or email). When you open a partner link (Viator, GetYourGuide, airlines, ticket sites), you leave WRLD and that
          site&rsquo;s privacy policy applies. Some links carry a WRLD partner code, so we may earn a commission. When you open a
          GetYourGuide panel in your plan (more tours, or dates and prices for a tour), it loads from GetYourGuide&rsquo;s servers,
          which see your IP address and the search (a city and a kind of activity), never your name or email.
        </li>
        <li>
          <strong>Images from other sites:</strong> tour photos and previews of links you save (for example from TikTok, Instagram or
          YouTube) load from those companies&rsquo; servers, which can see your IP address.
        </li>
        <li>
          <strong>Links you save:</strong> our server fetches each link&rsquo;s public title and preview image.
        </li>
        <li>
          <strong>AwardWallet</strong>, only if you connect it.
        </li>
        <li>
          <strong>Seats.aero</strong>, only if you link your Seats.aero account: WRLD sends your Points or cash searches (airports, dates,
          cabins, programs) to Seats.aero with your own access token to show live award seats. Your Seats.aero password never reaches
          WRLD; the access token is stored encrypted and deleted when you disconnect.
        </li>
        <li>
          <strong>For legal reasons:</strong> if the law requires it, or to protect people&rsquo;s safety or WRLD.
        </li>
      </ul>
      <p>
        We do not sell personal information or share it for cross-context behavioral advertising, as those terms are used in U.S.
        state privacy laws.
      </p>

      <h2>Analytics</h2>
      <p>
        We use Vercel Web Analytics to count visits and see which pages are used. It doesn&rsquo;t use cookies, doesn&rsquo;t store
        anything on your device and doesn&rsquo;t follow you to other sites. We don&rsquo;t use advertising trackers or social media
        pixels. Because we don&rsquo;t track you across sites, there&rsquo;s nothing for a browser &ldquo;Do Not Track&rdquo; or
        Global Privacy Control signal to turn off. More in the{" "}
        <Link href="/cookies" className="text-primary underline underline-offset-2">
          Cookie Policy
        </Link>
        .
      </p>

      <h2>International transfers</h2>
      <p>
        WRLD is run from the United States and our providers store data there. If you use WRLD from another country, your
        information is transferred to the U.S. Where the law requires, we rely on our providers&rsquo; standard contractual clauses
        or similar safeguards.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your information while your account exists. When you delete your account, we delete your profile, photo, wallet,
        travel type, saved links, reminders and the trips you created. Messages and expenses you added to someone else&rsquo;s trip
        stay with that trip without your name. Backups roll over within 30 days. Hosting providers keep server logs for a short
        period.
      </p>

      <h2>Your rights and choices</h2>
      <ul>
        <li>Correct your details at any time on the Account page.</li>
        <li>Leave a trip from its Group tab.</li>
        <li>
          Delete your account in the app (Account → Delete my account) or{" "}
          <Link href="/delete-account" className="text-primary underline underline-offset-2">
            follow these steps
          </Link>
          .
        </li>
        <li>
          Ask for a copy of your data, a correction or deletion, or to object to or restrict a use, by emailing <Mail />. We answer
          within 30 days, or 45 days where U.S. state law allows. Using these rights won&rsquo;t change how we treat you.
        </li>
        <li>If you&rsquo;re in the EU, UK or Switzerland, you can also complain to your local data protection authority.</li>
      </ul>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit (HTTPS) and at rest by our providers, and each person can reach only their own information and
        the trips they belong to. No system is perfectly secure; if a breach affects you, we&rsquo;ll tell you as the law requires.
      </p>

      <h2>Children</h2>
      <p>
        WRLD is not for children under 13 (under 16 in the EU and UK). We don&rsquo;t knowingly collect their information. If you
        think a child has given us information, email <Mail /> and we&rsquo;ll delete it.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this policy in a way that matters, we&rsquo;ll tell you in the app or by email before the change takes effect
        and update the date above.
      </p>
    </article>
  );
}
