import { CONTACT_EMAIL, LEGAL_UPDATED } from "@/features/legal/version";

export const metadata = { title: "Accessibility" };

export default function AccessibilityPage() {
  return (
    <article>
      <h1 className="text-4xl font-semibold">Accessibility</h1>
      <p className="text-muted-foreground">Last updated {LEGAL_UPDATED}</p>

      <p>
        We want everyone to be able to plan a trip with WRLD. We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.1 at
        level AA.
      </p>

      <h2>What we do</h2>
      <ul>
        <li>Every control works with a keyboard, and focus is always visible.</li>
        <li>Forms have labels, and errors are announced to screen readers.</li>
        <li>Text and controls meet AA color contrast in our main colors.</li>
        <li>Images that carry meaning have text alternatives; decorative images are hidden from screen readers.</li>
        <li>Pages work when zoomed to 200% and on small screens.</li>
      </ul>

      <h2>Known limits</h2>
      <ul>
        <li>The trip map is visual. Every place on it is also listed in the day plan, with its address.</li>
        <li>Photos and previews from other sites (tours, shared videos) may not have descriptions.</li>
      </ul>

      <h2>Tell us</h2>
      <p>
        If something in WRLD is hard to use with your setup, email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-2">
          {CONTACT_EMAIL}
        </a>{" "}
        with the page and what happened. We aim to reply within 5 business days.
      </p>
    </article>
  );
}
