import "server-only";

import { formatDateRange, formatDay, formatMoney, toNumber } from "@/lib/format";

import type { Entry, ExportData, ExportFile } from "./data";
import { type ExportOptions, SECTIONS } from "./options";

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const safeUrl = (u: string | null) => (u && /^https?:\/\//i.test(u) ? u : null);
const kb = (n: number) => (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);

/**
 * The trip as one printable HTML document. Used for the PDF (the browser's
 * Save as PDF) and inside the .zip, where file links point at the tickets folder.
 */
export function renderTripHtml(data: ExportData, o: ExportOptions, how: { print: boolean; fileHref: (f: ExportFile) => string | null }) {
  const { trip } = data;
  const fileList = (files: ExportFile[]) =>
    files.length
      ? `<ul class="files">${files
          .map((f) => {
            const href = how.fileHref(f);
            return `<li>${href ? `<a href="${esc(href)}">${esc(f.name)}</a>` : esc(f.name)} <span class="muted">${esc(kb(f.size))}</span></li>`;
          })
          .join("")}</ul>`
      : "";
  const entry = (e: Entry, withDate = false) => {
    const files = data.files.filter((f) => f.bookingId === e.bookingId);
    const url = safeUrl(e.url);
    return `<li class="entry ${e.type}">
      <div class="when">${withDate ? `${esc(formatDay(e.date))}<br>` : ""}${esc(e.time)}</div>
      <div class="what">
        <strong>${esc(e.title)}</strong>
        ${e.lines.filter(Boolean).map((l) => `<div>${esc(l)}</div>`).join("")}
        ${e.confirmation ? `<div class="code">Confirmation <b>${esc(e.confirmation)}</b></div>` : ""}
        ${e.cost || e.status ? `<div class="muted">${[e.status && e.status !== "booked" ? e.status : null, e.cost].filter(Boolean).map(esc).join(" · ")}</div>` : ""}
        ${url ? `<div class="muted link">${esc(url)}</div>` : ""}
        ${fileList(files)}
      </div>
    </li>`;
  };

  const timeline = [...data.transit, ...data.stays, ...data.items];
  const byDate = (list: Entry[]) => [...list].sort((a, b) => a.date.localeCompare(b.date) || a.sortAt.localeCompare(b.sortAt));

  const section: Record<string, () => string> = {
    overview: () => {
      const budget = toNumber(trip.budget);
      const projected = toNumber(data.budget?.projected_total);
      return `<section><h2>Overview</h2><dl class="facts">
        <dt>Dates</dt><dd>${esc(formatDateRange(trip.start_date, trip.end_date))}</dd>
        <dt>Route</dt><dd>${esc(data.stops.map((s) => s.city).join(" → ") || trip.destination || "")}</dd>
        <dt>Travelers</dt><dd>${esc(trip.party_size)}</dd>
        ${projected != null ? `<dt>Trip total</dt><dd>${esc(formatMoney(projected, trip.currency, { cents: false }))}${budget != null ? ` of a ${esc(formatMoney(budget, trip.currency, { cents: false }))} budget` : ""}</dd>` : ""}
        <dt>Bookings</dt><dd>${[
          [data.transit.length, "flight or transfer", "flights and transfers"],
          [data.stays.length / 2, "stay", "stays"],
          [data.items.length, "plan", "plans"],
        ]
          .map(([n, one, many]) => `${n} ${n === 1 ? one : many}`)
          .join(", ")}</dd>
      </dl>${trip.notes ? `<p>${esc(trip.notes)}</p>` : ""}</section>`;
    },
    days: () => {
      const source = o.group === "day" ? timeline : data.items;
      return `<section><h2>Day by day</h2>${data.days
        .map((d) => {
          const list = byDate(source.filter((e) => e.date === d.date && e.type !== "stay_out"));
          const outs = o.group === "day" ? data.stays.filter((e) => e.type === "stay_out" && e.date === d.date) : [];
          return `<div class="day"><h3>${esc(formatDay(d.date))}${d.city ? ` · ${esc(d.city)}` : ""}${d.title ? ` · ${esc(d.title)}` : ""}</h3>
            ${d.notes ? `<p class="muted">${esc(d.notes)}</p>` : ""}
            ${list.length || outs.length ? `<ul class="entries">${[...outs, ...list].map((e) => entry(e)).join("")}</ul>` : `<p class="muted">Nothing planned yet.</p>`}</div>`;
        })
        .join("")}</section>`;
    },
    flights: () =>
      `<section><h2>Flights &amp; transit</h2>${
        data.transit.length ? `<ul class="entries">${byDate(data.transit).map((e) => entry(e, true)).join("")}</ul>` : `<p class="muted">None added.</p>`
      }</section>`,
    stays: () => {
      const ins = byDate(data.stays.filter((e) => e.type === "stay_in"));
      return `<section><h2>Stays</h2>${ins.length ? `<ul class="entries">${ins.map((e) => entry(e, true)).join("")}</ul>` : `<p class="muted">None added.</p>`}</section>`;
    },
    bookings: () => {
      const rows = byDate([...data.transit, ...data.stays.filter((e) => e.type === "stay_in"), ...data.items.filter((e) => e.confirmation || e.status === "booked")]);
      return `<section><h2>All confirmations</h2>${
        rows.length
          ? `<table><thead><tr><th>Date</th><th>Booking</th><th>Confirmation</th><th>Cost</th></tr></thead><tbody>${rows
              .map(
                (e) =>
                  `<tr><td>${esc(formatDay(e.date))}</td><td>${esc(e.title)}</td><td><b>${esc(e.confirmation ?? "—")}</b></td><td>${esc(e.cost ?? "")}</td></tr>`,
              )
              .join("")}</tbody></table>`
          : `<p class="muted">No bookings yet.</p>`
      }</section>`;
    },
    files: () => {
      if (!data.files.length) return `<section><h2>Tickets &amp; files</h2><p class="muted">No files uploaded. Add boarding passes and tickets on the Export tab.</p></section>`;
      const label = (f: ExportFile) => {
        const e = timeline.find((x) => x.bookingId === f.bookingId && x.type !== "stay_out");
        return e ? `${formatDay(e.date)} · ${e.title}` : "Whole trip";
      };
      const groups = new Map<string, ExportFile[]>();
      for (const f of data.files) groups.set(label(f), [...(groups.get(label(f)) ?? []), f]);
      return `<section><h2>Tickets &amp; files</h2>${[...groups]
        .map(([g, fs]) => `<h3>${esc(g)}</h3>${fileList(fs)}`)
        .join("")}</section>`;
    },
    budget: () => {
      const costed = byDate([...data.transit, ...data.stays.filter((e) => e.type === "stay_in"), ...data.items].filter((e) => e.cost));
      const total = toNumber(data.budget?.projected_total);
      return `<section><h2>Budget</h2>${
        costed.length
          ? `<table><thead><tr><th>Date</th><th>Item</th><th>Cost</th></tr></thead><tbody>${costed
              .map((e) => `<tr><td>${esc(formatDay(e.date))}</td><td>${esc(e.title)}</td><td>${esc(e.cost)}</td></tr>`)
              .join("")}</tbody></table>`
          : ""
      }${total != null ? `<p><b>Projected total: ${esc(formatMoney(total, trip.currency, { cents: false }))}</b></p>` : ""}</section>`;
    },
    checklist: () => {
      const lists = { documents: "Documents", todo: "To do", packing: "Packing" } as const;
      return `<section><h2>Checklist</h2>${(Object.keys(lists) as (keyof typeof lists)[])
        .map((k) => {
          const items = data.checklist.filter((c) => c.list === k);
          return items.length
            ? `<h3>${lists[k]}</h3><ul class="check">${items
                .map((c) => `<li>${c.done ? "☑" : "☐"} ${esc(c.title)}${c.due_on ? ` <span class="muted">by ${esc(formatDay(c.due_on))}</span>` : ""}</li>`)
                .join("")}</ul>`
            : "";
        })
        .join("") || `<p class="muted">Nothing on the checklist.</p>`}</section>`;
    },
    people: () =>
      `<section><h2>Who&rsquo;s going</h2><ul>${data.members.map((m) => `<li>${esc(m.name)} <span class="muted">${esc(m.role)}</span></li>`).join("")}</ul></section>`,
  };

  const body = o.sections.map((s) => section[s]?.() ?? "").join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(trip.title)} · WRLD</title>
<style>
@page { size: ${o.paper === "a4" ? "A4" : "letter"}; margin: 14mm; }
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1d2b26; margin: 0 auto; max-width: 780px; padding: 24px 16px; background: #fff; }
h1 { font-size: 28px; margin: 0; }
h2 { font-size: 18px; margin: 28px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #1d2b26; break-after: avoid; }
h3 { font-size: 14px; margin: 16px 0 6px; break-after: avoid; }
.muted { color: #5c6b65; }
.sub { margin: 4px 0 0; color: #5c6b65; }
.facts { display: grid; grid-template-columns: 9rem 1fr; gap: 4px 12px; margin: 0; }
.facts dt { color: #5c6b65; } .facts dd { margin: 0; }
.entries { list-style: none; padding: 0; margin: 0; }
.entry { display: grid; grid-template-columns: 5.5rem 1fr; gap: 12px; padding: 8px 0; border-top: 1px solid #e3e7e4; break-inside: avoid; }
.entry .when { color: #5c6b65; font-variant-numeric: tabular-nums; }
.entry.transit strong::before { content: "✈ "; } .entry.stay_in strong::before, .entry.stay_out strong::before { content: "⌂ "; }
.code { margin-top: 2px; } .code b { font-family: ui-monospace, Menlo, monospace; letter-spacing: .04em; }
.link { word-break: break-all; font-size: 12px; }
.files { margin: 4px 0 0; padding-left: 18px; }
.day { break-inside: avoid-page; }
table { width: 100%; border-collapse: collapse; } th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e3e7e4; vertical-align: top; }
th { font-size: 12px; color: #5c6b65; font-weight: 600; }
.check { list-style: none; padding: 0; }
.toolbar { position: sticky; top: 0; display: flex; gap: 8px; align-items: center; justify-content: space-between; padding: 10px 12px; margin: -24px -16px 16px; background: #f4f1ea; border-bottom: 1px solid #e3e7e4; }
.toolbar button { font: inherit; padding: 6px 14px; border-radius: 999px; border: 0; background: #1d2b26; color: #fff; cursor: pointer; }
footer { margin-top: 32px; font-size: 12px; color: #5c6b65; }
@media print { .toolbar { display: none; } body { padding: 0; } a { color: inherit; } }
</style></head><body>
${how.print ? `<div class="toolbar"><span>Choose <b>Save as PDF</b> in the print window.</span><button type="button" onclick="window.print()">Print or save PDF</button></div>` : ""}
<header><h1>${esc(trip.title)}</h1><p class="sub">${esc(formatDateRange(trip.start_date, trip.end_date))}${data.stops.length ? ` · ${esc(data.stops.map((s) => s.city).join(" → "))}` : ""}</p></header>
${body}
<footer>Exported from WRLD on ${esc(new Date().toISOString().slice(0, 10))}. Sections: ${o.sections.map((s) => esc(SECTIONS[s].label)).join(", ")}.</footer>
${how.print ? `<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},400)})</script>` : ""}
</body></html>`;
}
