"use client";

import { ArrowDown, ArrowUp, CalendarDays, FileArchive, FileText, Sheet } from "lucide-react";
import { useState } from "react";

import { ALL_SECTIONS, DEFAULT_SECTIONS, type ExportOptions, optionsQuery, type Section, SECTIONS } from "./options";

/**
 * Pick what goes in, put it in your order, choose day-by-day or by type, then
 * download. Every format uses the same choices.
 */
export function ExportBuilder({ tripId, fileCount }: { tripId: string; fileCount: number }) {
  const [order, setOrder] = useState<Section[]>(() => [...DEFAULT_SECTIONS, ...ALL_SECTIONS.filter((s) => !DEFAULT_SECTIONS.includes(s))]);
  const [on, setOn] = useState<Set<Section>>(() => new Set(DEFAULT_SECTIONS));
  const [group, setGroup] = useState<ExportOptions["group"]>("day");
  const [paper, setPaper] = useState<ExportOptions["paper"]>("letter");

  const sections = order.filter((s) => on.has(s));
  const q = optionsQuery({ sections, group, paper });
  const base = `/trips/${tripId}/export`;
  const move = (i: number, d: -1 | 1) => {
    const next = [...order];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setOrder(next);
  };

  const formats = [
    { href: `${base}/document?${q}`, icon: FileText, title: "PDF", body: "Opens a print-ready page. Choose Save as PDF.", newTab: true },
    { href: `${base}/calendar?${q}`, icon: CalendarDays, title: "Calendar (.ics)", body: "Flights, stays and timed plans for Apple, Google or Outlook.", newTab: false },
    { href: `${base}/spreadsheet?${q}`, icon: Sheet, title: "Spreadsheet (.csv)", body: "Every booking and plan, one per row.", newTab: false },
    {
      href: `${base}/bundle?${q}`,
      icon: FileArchive,
      title: "Everything (.zip)",
      body: `Document, calendar, spreadsheet${fileCount ? ` and all ${fileCount} ticket${fileCount === 1 ? "" : "s"} in folders` : ""}.`,
      newTab: false,
    },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <fieldset className="grid content-start gap-2">
        <legend className="mb-2 text-sm font-semibold">What to include, in this order</legend>
        <ol className="grid gap-1.5">
          {order.map((s, i) => (
            <li key={s} className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${on.has(s) ? "bg-card" : "bg-muted/40"}`}>
              <input
                id={`sec-${s}`}
                type="checkbox"
                checked={on.has(s)}
                onChange={(e) => {
                  const next = new Set(on);
                  if (e.target.checked) next.add(s);
                  else next.delete(s);
                  setOn(next);
                }}
                className="size-4 accent-primary"
              />
              <label htmlFor={`sec-${s}`} className="min-w-0 flex-1 text-sm">
                <span className="block font-medium">{SECTIONS[s].label}</span>
                <span className="block text-xs text-muted-foreground">{SECTIONS[s].hint}</span>
              </label>
              <span className="flex gap-0.5">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${SECTIONS[s].label} up`}
                  className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <ArrowUp className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1}
                  aria-label={`Move ${SECTIONS[s].label} down`}
                  className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <ArrowDown className="size-4" aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ol>
      </fieldset>

      <div className="grid content-start gap-5">
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-semibold">Organize bookings and tickets</legend>
          {(
            [
              ["day", "Day by day", "Flights, check-ins and plans in time order under each day; ticket folders by day."],
              ["type", "By type", "Flights together, stays together, plans together; ticket folders by type."],
            ] as const
          ).map(([value, label, hint]) => (
            <label
              key={value}
              className={`flex cursor-pointer gap-3 rounded-xl border px-3 py-2.5 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring ${group === value ? "border-primary bg-open-soft" : ""}`}
            >
              <input type="radio" name="group" value={value} checked={group === value} onChange={() => setGroup(value)} className="mt-1 accent-primary" />
              <span>
                <span className="block font-medium">{label}</span>
                <span className="block text-xs text-muted-foreground">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <label className="grid gap-1.5 text-sm font-medium">
          Paper size for the PDF
          <select value={paper} onChange={(e) => setPaper(e.target.value as ExportOptions["paper"])} className="h-10 rounded-lg border bg-background px-3">
            <option value="letter">Letter (U.S.)</option>
            <option value="a4">A4</option>
          </select>
        </label>

        <div className="grid gap-2">
          <p className="text-sm font-semibold">Download</p>
          {!sections.length && <p className="text-sm text-destructive">Pick at least one section.</p>}
          <ul className="grid gap-2 sm:grid-cols-2">
            {formats.map(({ href, icon: Icon, title, body, newTab }) => (
              <li key={title}>
                <a
                  href={sections.length ? href : undefined}
                  aria-disabled={!sections.length}
                  {...(newTab ? { target: "_blank", rel: "noopener" } : { download: "" })}
                  className="flex h-full gap-3 rounded-xl border bg-card px-3 py-3 transition-colors hover:border-primary/60 focus-visible:outline-2 focus-visible:outline-ring aria-disabled:pointer-events-none aria-disabled:opacity-50"
                >
                  <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                  <span className="text-sm">
                    <span className="block font-medium">{title}</span>
                    <span className="block text-xs text-muted-foreground">{body}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
