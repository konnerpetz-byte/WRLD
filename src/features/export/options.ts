/**
 * What goes in a trip export, in what order, and how it's grouped.
 * Shared by the export page (browser) and the download routes (server).
 */
export const SECTIONS = {
  overview: { label: "Trip overview", hint: "Dates, cities, travelers, budget" },
  days: { label: "Day by day", hint: "Each day's plan, with flights and check-ins in place" },
  flights: { label: "Flights & transit", hint: "Times, seats, confirmation codes" },
  stays: { label: "Stays", hint: "Addresses, check-in and out, confirmations" },
  bookings: { label: "All confirmations", hint: "Every booking and its code in one list" },
  files: { label: "Tickets & files", hint: "Boarding passes, tickets, receipts you uploaded" },
  budget: { label: "Budget", hint: "What's booked and what it costs" },
  checklist: { label: "Checklist", hint: "Documents, packing, to-dos" },
  people: { label: "Who's going", hint: "Travelers on the trip" },
} as const;
export type Section = keyof typeof SECTIONS;
export const ALL_SECTIONS = Object.keys(SECTIONS) as Section[];
export const DEFAULT_SECTIONS: Section[] = ["overview", "days", "flights", "stays", "bookings", "files", "checklist"];

/** "day": everything on a timeline, day by day. "type": flights together, stays together, activities together. */
export type Grouping = "day" | "type";

export type ExportOptions = { sections: Section[]; group: Grouping; paper: "letter" | "a4" };

export function parseOptions(sp: URLSearchParams | Record<string, string | undefined>): ExportOptions {
  const get = (k: string) => (sp instanceof URLSearchParams ? (sp.get(k) ?? undefined) : sp[k]);
  const raw = get("s");
  const sections = raw === undefined ? DEFAULT_SECTIONS : [...new Set(raw.split(",").filter((s): s is Section => s in SECTIONS))];
  return {
    sections: sections.length ? sections : DEFAULT_SECTIONS,
    group: get("g") === "type" ? "type" : "day",
    paper: get("paper") === "a4" ? "a4" : "letter",
  };
}

export function optionsQuery(o: ExportOptions) {
  return new URLSearchParams({ s: o.sections.join(","), g: o.group, paper: o.paper }).toString();
}
