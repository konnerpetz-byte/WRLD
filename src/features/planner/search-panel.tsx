"use client";

import { SlidersHorizontal } from "lucide-react";
import { type ReactNode, useState } from "react";

/**
 * The search form, folded into one line once there are results, so the results lead.
 * "Edit search" opens it again; the form stays mounted so nothing typed is lost.
 */
export function SearchPanel({ summary, children }: { summary: string | null; children: ReactNode }) {
  const [open, setOpen] = useState(!summary);
  return (
    <section aria-label="Your search" className="rounded-2xl border bg-card">
      {summary && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <p className="min-w-0 text-sm">
            <span className="sr-only">Searching: </span>
            {summary}
          </p>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="tap inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-transform hover:bg-muted active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-ring"
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            {open ? "Close" : "Edit search"}
          </button>
        </div>
      )}
      <div hidden={!open} className={`p-4 sm:p-6 ${summary ? "border-t" : ""}`}>
        {children}
      </div>
    </section>
  );
}
