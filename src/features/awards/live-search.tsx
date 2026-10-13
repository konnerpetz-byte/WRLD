"use client";

import { Loader2, Radio } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { saveBrowserSeats } from "./actions";

type Route = { origin: string; destination: string };

/**
 * "Search live": asks the WRLD browser extension to look up Alaska Airlines
 * (Atmos Rewards) award prices on alaskaair.com in the traveler's own browser,
 * for the routes and months on screen, then adds them to the explorer.
 */
export function LiveSearch({ routes, months }: { routes: Route[]; months: string[] }) {
  const router = useRouter();
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [status, setStatus] = useState<{ busy: boolean; note?: string; error?: string }>({ busy: false });

  useEffect(() => {
    // The extension marks the page as soon as it loads.
    const check = () => setInstalled(document.documentElement.dataset.wrldExtension === "2");
    const t = setTimeout(check, 300);
    return () => clearTimeout(t);
  }, []);

  // At most 30 lookups a search (one a second): fewer routes when several months are picked.
  const perMonth = Math.max(1, Math.floor(30 / Math.max(1, months.length)));
  const jobs = routes.slice(0, perMonth);
  const seconds = jobs.length * Math.max(1, months.length);

  async function run() {
    setStatus({ busy: true });
    const id = crypto.randomUUID();
    const reply = await new Promise<{ rows?: { origin: string; destination: string; date: string; miles: number }[]; error?: string }>((resolve) => {
      const onMessage = (e: MessageEvent) => {
        if (e.source !== window || e.origin !== window.location.origin || e.data?.type !== "wrld:live-results" || e.data?.id !== id) return;
        window.removeEventListener("message", onMessage);
        resolve(e.data.reply ?? {});
      };
      window.addEventListener("message", onMessage);
      window.postMessage({ type: "wrld:live-search", id, request: { program: "alaska", routes: jobs, months } }, window.location.origin);
      setTimeout(() => {
        window.removeEventListener("message", onMessage);
        resolve({ error: "The search took too long. Try fewer months." });
      }, (seconds + 40) * 1000);
    });
    const saved = await saveBrowserSeats("alaska", "economy", reply.rows ?? []);
    setStatus({ busy: false, note: saved.note, error: reply.error ?? saved.error });
    if (saved.ok) router.refresh();
  }

  if (!jobs.length || !months.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border bg-card px-4 py-3 text-sm">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 font-medium">
          <Radio className="size-4 text-primary" aria-hidden="true" /> Live award prices, free
        </p>
        <p className="text-muted-foreground">
          {installed
            ? `Searches Alaska's award calendar for ${jobs.length} ${jobs.length === 1 ? "route" : "routes"} in your browser (about ${seconds} seconds). Alaska Atmos points book Alaska, American and partner flights.`
            : "Add the free WRLD browser button (below) to search airline award calendars live, in your own browser."}
        </p>
        {(status.note || status.error) && (
          <p role="status" className={`mt-1 ${status.error ? "text-destructive" : "text-primary"}`}>
            {status.error ?? status.note}
          </p>
        )}
      </div>
      {installed ? (
        <button
          type="button"
          onClick={run}
          disabled={status.busy}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 font-medium text-primary-foreground transition-[transform,background-color] hover:bg-primary/90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-safe:active:scale-[0.97]"
        >
          {status.busy && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />}
          {status.busy ? "Searching live" : "Search live"}
        </button>
      ) : (
        <a href="#check-live" className="shrink-0 font-medium text-primary underline underline-offset-2">
          Get the WRLD button
        </a>
      )}
    </div>
  );
}
