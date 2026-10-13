"use client";

import { Bookmark, Download } from "lucide-react";
import { useEffect, useRef } from "react";

/**
 * The "Send to WRLD" bookmark: on an airline's award results, it opens WRLD's
 * share page with that page's address and visible text in the URL fragment.
 * Runs only when the traveler clicks it, on a page they opened themselves.
 */
const BOOKMARKLET = `javascript:(()=>{const d=JSON.stringify({u:location.href,t:document.body.innerText.slice(0,100000)});window.open('https://wrldtrips.com/points/share#'+encodeURIComponent(d),'_blank')})()`;

/** Bookmark and browser button: send what the airline shows straight to WRLD. */
export function SendFromAirline() {
  const ref = useRef<HTMLAnchorElement>(null);
  // React won't render a javascript: link, so set it after mount.
  useEffect(() => {
    ref.current?.setAttribute("href", BOOKMARKLET);
  }, []);

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Open any result&rsquo;s <strong className="text-foreground">Check live seats</strong>, then send what the airline shows you in one
        click. WRLD keeps only the dates, points and taxes you confirm, and never searches airline sites on its own.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid content-start gap-2 rounded-xl bg-muted/50 p-4 text-sm">
          <p className="font-medium">Bookmark, on a computer</p>
          <p className="text-muted-foreground">Drag this to your bookmarks bar, then click it on the airline&rsquo;s results.</p>
          <a
            ref={ref}
            href="#check-live"
            onClick={(e) => e.preventDefault()}
            draggable
            className="mt-1 inline-flex min-h-9 w-fit cursor-grab items-center gap-1.5 rounded-full bg-primary px-3.5 text-sm font-medium text-primary-foreground active:cursor-grabbing"
          >
            <Bookmark className="size-4" aria-hidden="true" /> Send to WRLD
          </a>
        </div>
        <div className="grid content-start gap-2 rounded-xl bg-muted/50 p-4 text-sm">
          <p className="font-medium">Button for Chrome and Edge</p>
          <p className="text-muted-foreground">
            Unzip it, open <span className="font-mono text-xs">chrome://extensions</span>, turn on Developer mode and choose &ldquo;Load
            unpacked.&rdquo;
          </p>
          <a href="/wrld-seat-sharer.zip" download className="mt-1 inline-flex w-fit items-center gap-1.5 font-medium text-primary underline underline-offset-2">
            <Download className="size-4" aria-hidden="true" /> Download (2 KB)
          </a>
        </div>
      </div>
    </div>
  );
}
