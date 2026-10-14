"use client";

import { formatMoney } from "@/lib/format";
import { Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

import { type ReportState, readSharedPage, reportManySeats, type SharedPage } from "./actions";
import { RouteFields, Status } from "./report-seat-form";

type Programs = { source: string; name: string }[];

/**
 * Landing page for "Send to WRLD": the WRLD button or bookmark opens this page
 * with the airline page's address and text in the URL fragment (never sent to
 * the server as part of the address). The traveler checks what WRLD read,
 * fixes anything, and shares.
 */
export function ShareFromAirline({ programs, home }: { programs: Programs; home: string }) {
  const [page, setPage] = useState<SharedPage | null>(null);
  const [status, setStatus] = useState<"reading" | "empty" | "done">("reading");
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [state, action, pending] = useActionState<ReportState, FormData>(reportManySeats, {});

  useEffect(() => {
    const raw = window.location.hash.slice(1);
    // Clear the page text from the address bar and history right away.
    history.replaceState(null, "", window.location.pathname);
    let data: { u?: string; t?: string } | null = null;
    try {
      data = raw ? JSON.parse(decodeURIComponent(raw)) : null;
    } catch {
      data = null;
    }
    const read = data ? readSharedPage(String(data.u ?? ""), String(data.t ?? "")) : Promise.resolve(null);
    read.then(
      (r) => {
        setPage(r);
        setStatus(r ? "done" : "empty");
      },
      () => {
        setPage({ rows: [], program: null, error: "Couldn't read that page. Try again." });
        setStatus("done");
      },
    );
  }, []);

  if (status === "reading") {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" /> Reading the airline page…
      </p>
    );
  }
  if (status === "empty" || !page) {
    return (
      <p className="rounded-xl border border-dashed bg-card p-5 text-sm">
        Nothing to share yet. On an airline&rsquo;s award results, click the &ldquo;Save to WRLD&rdquo; bookmark.{" "}
        <Link href="/points#check-live" className="font-medium text-primary underline underline-offset-2">
          Set it up
        </Link>
        .
      </p>
    );
  }

  const rows = page.rows.filter((r) => !skip.has(r.date));
  const programName = programs.find((p) => p.source === page.program)?.name;

  return (
    <div className="grid gap-4">
      {page.error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {page.error}
        </p>
      )}
      {page.rows.length > 0 && (
        <form action={action} className="grid gap-4 rounded-2xl border bg-card p-5">
          <div>
            <h2 className="text-lg font-semibold">
              {page.rows.length} {page.rows.length === 1 ? "price" : "prices"} found{programName ? ` on ${programName}` : ""}
            </h2>
            <p className="text-sm text-muted-foreground">Untick anything that&rsquo;s wrong, check the route, then share.</p>
          </div>
          <fieldset className="grid gap-1.5">
            <legend className="sr-only">Dates and prices</legend>
            <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {page.rows.map((r) => (
                <li key={r.date}>
                  <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={!skip.has(r.date)}
                      onChange={(e) => {
                        const next = new Set(skip);
                        if (e.target.checked) next.delete(r.date);
                        else next.add(r.date);
                        setSkip(next);
                      }}
                    />
                    <span className="tabular-nums">
                      {new Date(`${r.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
                    </span>
                    <span className="ml-auto text-right font-semibold tabular-nums">
                      {r.miles.toLocaleString()}
                      {r.taxes != null && (
                        <span className="block text-xs font-normal text-muted-foreground">
                          + {formatMoney(r.taxes, r.taxCurrency ?? "USD")}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[6rem_6rem_1.4fr_1fr_auto] lg:items-end">
            <RouteFields
              origin={page.origin ?? home}
              destination={page.destination ?? ""}
              program={page.program ?? ""}
              cabin={page.cabin ?? "business"}
              programs={programs}
              prefix="share"
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="direct" className="size-4 accent-primary" /> Nonstop
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            Check the cabin: the airline page doesn&rsquo;t always say which one these prices are for.
          </p>
          <input type="hidden" name="rows" value={JSON.stringify(rows.slice(0, 20))} />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending || !rows.length || state.ok}>
              {state.ok ? (
                <>
                  <Check aria-hidden="true" /> Shared
                </>
              ) : pending ? (
                "Sharing…"
              ) : (
                `Share ${Math.min(rows.length, 20)} with WRLD travelers`
              )}
            </Button>
            <Status state={state} />
            {state.ok && (
              <Link href="/points" className="text-sm font-medium text-primary underline underline-offset-2">
                Back to the explorer
              </Link>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
