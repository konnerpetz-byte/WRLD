import Link from "next/link";

export const metadata = { title: "Delete your WRLD account" };

const CONTACT = process.env.NEXT_PUBLIC_PRIVACY_EMAIL ?? "privacy@wrld.example";

/** Public page Google Play requires: how to delete a WRLD account, and what happens to the data. */
export default function DeleteAccountInfoPage() {
  return (
    <article>
      <h1 className="text-4xl font-semibold">Delete your WRLD account</h1>
      <p>You can delete your WRLD account and its data at any time, in the app or by email.</p>

      <h2>In the app</h2>
      <ul>
        <li>
          Sign in to WRLD on the web, iPhone or Android and open <strong>Account</strong>.
        </li>
        <li>
          Under <strong>Privacy and your data</strong>, choose <strong>Delete my account</strong>.
        </li>
        <li>
          Type <strong>DELETE</strong> and confirm. You&rsquo;re signed out and the account is gone.
        </li>
      </ul>
      <p>
        <Link href="/account" className="font-medium text-primary underline underline-offset-2">
          Go to Account
        </Link>{" "}
        (you&rsquo;ll be asked to sign in).
      </p>

      <h2>By email</h2>
      <p>
        Can&rsquo;t sign in? Email{" "}
        <a href={`mailto:${CONTACT}?subject=Delete%20my%20WRLD%20account`} className="text-primary underline underline-offset-2">
          {CONTACT}
        </a>{" "}
        from the address on your account with the subject &ldquo;Delete my WRLD account&rdquo;. We&rsquo;ll confirm and delete it within 7
        days.
      </p>

      <h2>What gets deleted</h2>
      <ul>
        <li>Your profile, photo, phone number and home address</li>
        <li>Trips you created, with their days, plans, stays, travel, expenses, checklists and saved links</li>
        <li>Your points wallet, travel type and quiz answers, and spots you saved for yourself</li>
      </ul>

      <h2>What stays</h2>
      <ul>
        <li>
          Messages and expenses you added to <em>someone else&rsquo;s</em> trip stay on that trip so their records add up. They show
          &ldquo;Former member&rdquo; instead of your name.
        </li>
        <li>Backups are overwritten within 30 days.</li>
      </ul>
    </article>
  );
}
