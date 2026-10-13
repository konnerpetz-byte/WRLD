"use client";

import { Bookmark, Download } from "lucide-react";
import { useEffect, useRef } from "react";

/**
 * The "Send to WRLD" bookmark: on an airline's award results, it opens WRLD's
 * share page with that page's address and visible text in the URL fragment.
 * Runs only when the traveler clicks it, on a page they opened themselves.
 */
const BOOKMARKLET = `javascript:(()=>{const d=JSON.stringify({u:location.href,t:document.body.innerText.slice(0,100000)});window.open('https://wrldtrips.com/points/share#'+encodeURIComponent(d),'_blank')})()`;

export function CheckLive() {
  const ref = useRef<HTMLAnchorElement>(null);
  // React won't render a javascript: link, so set it after mount.
  useEffect(() => {
    ref.current?.setAttribute("href", BOOKMARKLET);
  }, []);

  return (
    <section id="check-live" aria-labelledby="check-live-h" className="grid gap-3 rounded-2xl border bg-card p-5">
      <div>
        <h2 id="check-live-h" className="text-lg font-semibold">
          Live seats, checked on the airline&rsquo;s own site
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every option has a <strong className="text-foreground">Check live</strong> button that opens the airline&rsquo;s award search,
          already filled in. You see real, up-to-the-minute seats and taxes. Then send them to WRLD in one click so the explorer, and
          everyone else, has them too.
        </p>
      </div>
      <ol className="grid gap-3 text-sm sm:grid-cols-2">
        <li className="grid content-start gap-2 rounded-xl bg-muted/50 p-3">
          <p className="font-semibold">On a computer: add the Send to WRLD bookmark</p>
          <p className="text-muted-foreground">Drag this button to your bookmarks bar. On airline results, click it.</p>
          <a
            ref={ref}
            href="#check-live"
            onClick={(e) => e.preventDefault()}
            draggable
            className="inline-flex w-fit cursor-grab items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground active:cursor-grabbing"
          >
            <Bookmark className="size-4" aria-hidden="true" /> Send to WRLD
          </a>
        </li>
        <li className="grid content-start gap-2 rounded-xl bg-muted/50 p-3">
          <p className="font-semibold">Or the WRLD button for Chrome and Edge</p>
          <p className="text-muted-foreground">
            Download, unzip, open <span className="font-mono text-xs">chrome://extensions</span>, turn on Developer mode and choose
            &ldquo;Load unpacked.&rdquo; It only reads a page when you click it.
          </p>
          <a href="/wrld-seat-sharer.zip" download className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary underline underline-offset-2">
            <Download className="size-4" aria-hidden="true" /> Download the WRLD button (2 KB)
          </a>
        </li>
      </ol>
      <p className="text-xs text-muted-foreground">
        WRLD keeps only the dates, points and taxes you confirm. It never signs in to airline sites or searches them on its own.
      </p>
    </section>
  );
}
