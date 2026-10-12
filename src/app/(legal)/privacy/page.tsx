import Link from "next/link";

export const metadata = { title: "Privacy policy" };

// DRAFT — have a lawyer review this before launch, and fill in the
// contact address and effective date. Keep it in sync with the App Store
// privacy labels and the Google Play Data safety form.
const CONTACT = process.env.NEXT_PUBLIC_PRIVACY_EMAIL ?? "privacy@wrldtrips.com";

export default function PrivacyPage() {
  return (
    <article>
      <h1 className="text-4xl font-semibold">WRLD privacy policy</h1>
      <p className="text-muted-foreground">Effective date: to be set at launch</p>

      <p>
        WRLD is a trip planner. This page explains what we collect, why, who we share it with and how to delete it. Questions:{" "}
        <a href={`mailto:${CONTACT}`} className="text-primary underline underline-offset-2">
          {CONTACT}
        </a>
        .
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account:</strong> email address, password (stored hashed by our sign-in provider), name, profile photo, home country,
          currency and airport.
        </li>
        <li>
          <strong>Private details you choose to add:</strong> phone number and home address. Only you can see these.
        </li>
        <li>
          <strong>Trips:</strong> cities, dates, activities, stays, flights and trains, prices, expenses, checklists, votes, saved links
          and group chat messages. People you invite to a trip can see that trip&rsquo;s content and your name and photo.
        </li>
        <li>
          <strong>Travel type:</strong> your quiz answers and interests, used to suggest activities.
        </li>
        <li>
          <strong>Points wallet:</strong> loyalty program balances you add, or that a connected service (AwardWallet) sends with your
          permission. We never ask for airline or bank passwords.
        </li>
        <li>
          <strong>Location:</strong> only when you tap &ldquo;Show where I am&rdquo; on the map. It is used on your device to show your
          position and is not stored.
        </li>
        <li>
          <strong>Links you share in:</strong> when you share a TikTok, Instagram, YouTube or other link to WRLD, our server fetches the
          link&rsquo;s public title and preview image.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To run the app: show your trips, sync them between devices and with the people you invite.</li>
        <li>To fill things in for you: place pins, official ticket links, opening hours, prices and time zones.</li>
        <li>To keep accounts secure and fix problems.</li>
      </ul>
      <p>We do not sell your personal information and we do not use it for advertising.</p>

      <h2>Who we share it with</h2>
      <ul>
        <li>
          <strong>Supabase</strong> stores the database, sign-in and photos; <strong>our web host</strong> runs the app.
        </li>
        <li>
          <strong>OpenStreetMap services</strong> (Photon, Nominatim) and <strong>OpenFreeMap</strong> receive place names or addresses
          you type and map requests, to put things on the map.
        </li>
        <li>
          <strong>Wikidata and Wikipedia</strong> receive place names and coordinates to find official websites and nearby sights.
        </li>
        <li>
          <strong>Viator</strong> receives activity names and the trip city when we look up a price.
        </li>
        <li>
          <strong>AwardWallet</strong>, only if you connect it, to bring in your points balances.
        </li>
        <li>The websites you share links from (to fetch their public preview).</li>
      </ul>

      <h2>How long we keep it</h2>
      <p>
        We keep your information while your account exists. When you delete your account we delete your profile, private details,
        photos, wallet, travel type, saved links and the trips you created right away. Backups are overwritten within 30 days.
        Messages and expenses you added to someone else&rsquo;s trip stay with that trip, without your name.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Edit your details any time on the Account page.</li>
        <li>Leave a trip from its Group tab.</li>
        <li>
          Delete your account in the app (Account → Delete my account) or{" "}
          <Link href="/delete-account" className="text-primary underline underline-offset-2">
            follow these steps
          </Link>
          .
        </li>
        <li>Ask us for a copy of your data or to correct it by emailing {CONTACT}.</li>
      </ul>

      <h2>Children</h2>
      <p>WRLD is not meant for children under 13, and we don&rsquo;t knowingly collect their information.</p>

      <h2>Changes</h2>
      <p>If we change this policy in a way that matters, we&rsquo;ll tell you in the app before it takes effect.</p>
    </article>
  );
}
