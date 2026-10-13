import Link from "next/link";

import { CONTACT_EMAIL, LEGAL_UPDATED } from "@/features/legal/version";

export const metadata = { title: "Cookie Policy" };

const PROJECT_REF = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").match(/https:\/\/([a-z0-9]+)\./)?.[1] ?? "<project>";

export default function CookiesPage() {
  return (
    <article>
      <h1 className="text-4xl font-semibold">Cookie Policy</h1>
      <p className="text-muted-foreground">Last updated {LEGAL_UPDATED}</p>

      <p>
        Cookies are small files a website stores in your browser. WRLD uses as few as possible: only the ones needed to keep you
        signed in. Because they&rsquo;re strictly necessary, we don&rsquo;t ask for consent with a cookie banner. If we ever add
        cookies that aren&rsquo;t necessary, we&rsquo;ll ask first.
      </p>

      <h2>Cookies we use</h2>
      <div className="mt-4 overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Cookies set by WRLD</caption>
          <thead className="bg-muted/60">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Name</th>
              <th scope="col" className="px-3 py-2 font-medium">Purpose</th>
              <th scope="col" className="px-3 py-2 font-medium">Type</th>
              <th scope="col" className="px-3 py-2 font-medium">How long</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t align-top">
              <td className="px-3 py-2 font-mono text-xs break-all">sb-{PROJECT_REF}-auth-token (may be split into .0, .1)</td>
              <td className="px-3 py-2">Keeps you signed in securely (set by our sign-in provider, Supabase).</td>
              <td className="px-3 py-2">Strictly necessary, first party</td>
              <td className="px-3 py-2">Until you sign out (at most 400 days)</td>
            </tr>
            <tr className="border-t align-top">
              <td className="px-3 py-2 font-mono text-xs">sb-{PROJECT_REF}-auth-token-code-verifier</td>
              <td className="px-3 py-2">Completes a secure sign-in or email link.</td>
              <td className="px-3 py-2">Strictly necessary, first party</td>
              <td className="px-3 py-2">Minutes, during sign-in</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>What we don&rsquo;t use</h2>
      <ul>
        <li>No advertising, retargeting or social media cookies or pixels.</li>
        <li>
          No analytics cookies. Vercel Web Analytics counts visits without cookies or anything stored on your device.
        </li>
        <li>No cross-site tracking.</li>
      </ul>

      <h2>Other sites</h2>
      <p>
        When you open a link to another site (a booking partner, an airline, a ticket office), that site may set its own cookies,
        including the partner&rsquo;s cookie that credits WRLD for a booking. GetYourGuide panels you open inside your plan run
        on GetYourGuide&rsquo;s own domain and may set GetYourGuide cookies there; they can&rsquo;t read or set WRLD&rsquo;s. Their
        cookie policies apply.
      </p>

      <h2>Your choices</h2>
      <p>
        You can block or delete cookies in your browser settings. If you block WRLD&rsquo;s sign-in cookie, you won&rsquo;t be able
        to stay signed in. See also our{" "}
        <Link href="/privacy" className="text-primary underline underline-offset-2">
          Privacy Policy
        </Link>
        . Questions:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-2">
          {CONTACT_EMAIL}
        </a>
        .
      </p>
    </article>
  );
}
