"use client";

import { Bookmark } from "lucide-react";
import { useEffect, useRef } from "react";

/**
 * "Save to WRLD", a bookmark (no install): on an airline's award results it
 * opens WRLD's share page with that page's address and visible text in the URL
 * fragment. Runs only when the traveler clicks it, on a page they opened.
 * Works in any desktop browser that has a bookmarks bar.
 */
const BOOKMARKLET = `javascript:(()=>{const d=JSON.stringify({u:location.href,t:document.body.innerText.slice(0,100000)});window.open('https://wrldtrips.com/points/share#'+encodeURIComponent(d),'_blank')})()`;

export function SendFromAirline() {
  const ref = useRef<HTMLAnchorElement>(null);
  // React won't render a javascript: link, so set it after mount.
  useEffect(() => {
    ref.current?.setAttribute("href", BOOKMARKLET);
  }, []);

  return (
    <div className="grid gap-4 text-sm">
      <p className="text-muted-foreground">
        <strong className="text-foreground">What it does:</strong> when you&rsquo;re looking at award prices on any airline&rsquo;s
        website, one click copies the dates, points and taxes into WRLD, so they show up here next to everything else and other
        travelers can see them too. You check them before anything is shared.
      </p>
      <div className="grid gap-3 rounded-xl bg-muted/50 p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-5">
        <a
          ref={ref}
          href="#check-live"
          onClick={(e) => e.preventDefault()}
          draggable
          aria-describedby="bookmark-how"
          className="inline-flex min-h-11 w-fit cursor-grab items-center gap-2 rounded-full bg-primary px-5 font-medium text-primary-foreground shadow-sm active:cursor-grabbing"
        >
          <Bookmark className="size-4" aria-hidden="true" /> Save to WRLD
        </a>
        <ol id="bookmark-how" className="grid gap-1 text-muted-foreground">
          <li>
            1. Show your bookmarks bar: <kbd className="rounded border bg-background px-1 font-mono text-xs">Ctrl Shift B</kbd> (Windows) or{" "}
            <kbd className="rounded border bg-background px-1 font-mono text-xs">⌘ Shift B</kbd> (Mac).
          </li>
          <li>2. Drag the green button onto the bar. That&rsquo;s it, nothing to install.</li>
        </ol>
      </div>
      <p className="text-xs text-muted-foreground">
        Works in Chrome, Safari, Edge, Firefox and Opera on a computer. On a phone, use <strong>Paste</strong> instead.
      </p>
    </div>
  );
}
