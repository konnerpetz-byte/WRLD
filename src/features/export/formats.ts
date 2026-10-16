import "server-only";

import type { Entry, ExportData } from "./data";
import type { ExportOptions } from "./options";

// ---------------------------------------------------------------- Calendar (.ics)
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const utc = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
/** RFC 5545 lines are folded at 75 octets. */
const fold = (line: string) => {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest, "utf8") > 74) {
    let cut = 74;
    while (Buffer.byteLength(rest.slice(0, cut), "utf8") > 74) cut--;
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  out.push(rest);
  return out.join("\r\n");
};

/**
 * Flights and transit as timed events (exact UTC times), stays as one event
 * from check-in to check-out, and planned activities that have a time.
 * Imports into Apple Calendar, Google Calendar and Outlook.
 */
export function buildIcs(data: ExportData, raw: { transit: { id: string; depart_at: string; arrive_at: string }[]; lodging: { id: string; check_in_at: string; check_out_at: string }[]; items: { id: string; startUtc: string | null; endUtc: string | null }[] }) {
  const now = utc(new Date().toISOString());
  const ev: string[] = [];
  const add = (uid: string, start: string, end: string, e: Entry) => {
    const desc = [...e.lines, e.confirmation ? `Confirmation: ${e.confirmation}` : "", e.url ?? ""].filter(Boolean).join("\n");
    ev.push(
      ["BEGIN:VEVENT", `UID:${uid}@wrldtrips.com`, `DTSTAMP:${now}`, `DTSTART:${utc(start)}`, `DTEND:${utc(end)}`, `SUMMARY:${icsText(e.title)}`, desc ? `DESCRIPTION:${icsText(desc)}` : "", "END:VEVENT"]
        .filter(Boolean)
        .map(fold)
        .join("\r\n"),
    );
  };
  for (const t of raw.transit) {
    const e = data.transit.find((x) => x.bookingId === t.id);
    if (e) add(`transit-${t.id}`, t.depart_at, t.arrive_at, e);
  }
  for (const l of raw.lodging) {
    const e = data.stays.find((x) => x.bookingId === l.id && x.type === "stay_in");
    if (e) add(`stay-${l.id}`, l.check_in_at, l.check_out_at, { ...e, title: e.title.replace(/^Check in: /, "Stay: ") });
  }
  for (const i of raw.items) {
    const e = data.items.find((x) => x.bookingId === i.id);
    if (e && i.startUtc) add(`item-${i.id}`, i.startUtc, i.endUtc ?? new Date(Date.parse(i.startUtc) + 3600_000).toISOString(), e);
  }
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//WRLD//Trip export//EN", "CALSCALE:GREGORIAN", fold(`X-WR-CALNAME:${icsText(data.trip.title)}`), ...ev, "END:VCALENDAR", ""].join("\r\n");
}

// ---------------------------------------------------------------- Spreadsheet (.csv)
const cell = (v: unknown) => {
  const s = String(v ?? "");
  // Formula injection guard for spreadsheet apps.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** One row per booking or plan: date, time, type, title, details, confirmation, cost, status, link, files. Sorted by day or grouped by type. */
export function buildCsv(data: ExportData, o: ExportOptions) {
  const label = { transit: "Flight / transit", stay_in: "Stay", stay_out: "Check out", item: "Plan" } as const;
  const order = { transit: 0, stay_in: 1, stay_out: 1, item: 2 } as const;
  const rows = [...data.transit, ...data.stays.filter((e) => e.type === "stay_in"), ...data.items].sort((a, b) =>
    o.group === "type" ? order[a.type] - order[b.type] || a.sortAt.localeCompare(b.sortAt) : a.date.localeCompare(b.date) || a.sortAt.localeCompare(b.sortAt),
  );
  const head = ["Date", "Time", "Type", "Title", "Details", "Confirmation", "Cost", "Status", "Link", "Files"];
  const lines = rows.map((e) =>
    [
      e.date,
      e.time,
      label[e.type],
      e.title,
      e.lines.filter(Boolean).join(" | "),
      e.confirmation ?? "",
      e.cost ?? "",
      e.status ?? "",
      e.url ?? "",
      data.files
        .filter((f) => f.bookingId === e.bookingId)
        .map((f) => f.name)
        .join("; "),
    ]
      .map(cell)
      .join(","),
  );
  // Byte-order mark so Excel opens it as UTF-8.
  return `\uFEFF${[head.join(","), ...lines].join("\r\n")}\r\n`;
}
