"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUserId } from "@/lib/supabase/server";

import { chartPrices } from "./charts";
import { readAirlineUrl } from "./deeplinks";
import { type PastedSeat, seatsFromText } from "./paste";
import { SOURCE_PROGRAM } from "./regions";

export type ReportState = { ok?: boolean; error?: string; note?: string };
export type PasteState = { rows?: PastedSeat[]; error?: string };

const route = {
  origin: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter airport code."),
  destination: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter airport code."),
  program: z.string().refine((p) => p in SOURCE_PROGRAM, "Pick the program."),
  cabin: z.enum(["economy", "premium", "business", "first"]),
  direct: z.preprocess((v) => v === "on" || v === true, z.boolean()),
};
const CURRENCIES = ["USD", "CAD", "EUR", "GBP", "AUD"] as const;
const taxes = {
  taxes: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().min(0, "Taxes can't be negative.").max(5000, "That looks too high.").optional()),
  tax_currency: z.enum(CURRENCIES).default("USD"),
};
const single = z.object({
  ...route,
  ...taxes,
  date: z.iso.date("Pick the date."),
  miles: z.coerce.number().int("Whole points only.").min(1000, "That looks too low.").max(1000000),
});

/**
 * Catch typos before they mislead anyone: a report far below the program's own
 * published price for the route is almost always a missing zero.
 */
function sanity(r: { origin: string; destination: string; program: string; cabin: "economy" | "premium" | "business" | "first"; miles: number }) {
  const chart = chartPrices(r.origin, r.destination, r.cabin).find((c) => c.source === r.program);
  if (chart && r.miles < chart.points * 0.6) {
    return `${chart.program}'s published price for this route is ${chart.points.toLocaleString()} points. Double-check the number.`;
  }
  return null;
}

async function save(rows: { origin: string; destination: string; date: string; program: string; cabin: string; miles: number; direct: boolean; taxes?: number; tax_currency?: string }[]) {
  const { supabase } = await requireUserId();
  for (const r of rows) {
    const { error } = await supabase.rpc("report_award_seat", {
      p_origin: r.origin,
      p_destination: r.destination,
      p_date: r.date,
      p_program: r.program,
      p_cabin: r.cabin,
      p_miles: r.miles,
      p_direct: r.direct,
      p_taxes: r.taxes ?? null,
      p_tax_currency: r.taxes == null ? null : (r.tax_currency ?? "USD"),
    });
    if (error) return error.message.includes("20 reports") ? error.message : "Couldn't save that. Check the date is in the next year.";
  }
  return null;
}

/** "I found a seat": a traveler shares award space they saw on the airline's site. */
export async function reportAwardSeat(_: ReportState, formData: FormData): Promise<ReportState> {
  const parsed = single.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  const r = parsed.data;
  if (r.origin === r.destination) return { error: "From and to can't be the same airport." };
  const warning = sanity(r);
  if (warning) return { error: warning };
  const error = await save([r]);
  if (error) return { error };
  revalidatePath("/points");
  return { ok: true, note: r.taxes == null ? "Thanks! Other travelers will see it for the next three days. Adding the taxes next time helps them more." : "Thanks! Other travelers will see it for the next three days." };
}

/**
 * Paste from the airline site: reads every "date … points" pair from text a
 * traveler copied off a results calendar, for them to check before sharing.
 */
export async function readPastedSeats(_: PasteState, formData: FormData): Promise<PasteState> {
  const text = String(formData.get("pasted") ?? "").slice(0, 50_000);
  if (!text.trim()) return { error: "Paste the results first." };
  const rows = seatsFromText(text);
  if (!rows.length) return { error: "Couldn't find dates with points in that text. Copy the calendar or results list, including the dates." };
  return { rows };
}

const many = z.object({
  ...route,
  rows: z
    .array(z.object({ date: z.iso.date(), miles: z.number().int().min(1000).max(1000000), taxes: z.number().min(0).max(5000).optional(), taxCurrency: z.enum(CURRENCIES).optional() }))
    .min(1)
    .max(20),
});

export async function reportManySeats(_: ReportState, formData: FormData): Promise<ReportState> {
  let payload: unknown;
  try {
    payload = { ...Object.fromEntries(formData), rows: JSON.parse(String(formData.get("rows") ?? "[]")) };
  } catch {
    return { error: "Something went wrong reading the list." };
  }
  const parsed = many.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  const r = parsed.data;
  if (r.origin === r.destination) return { error: "From and to can't be the same airport." };
  for (const row of r.rows) {
    const warning = sanity({ ...r, miles: row.miles });
    if (warning) return { error: `${row.date}: ${warning}` };
  }
  const error = await save(r.rows.map((row) => ({ ...r, date: row.date, miles: row.miles, taxes: row.taxes, tax_currency: row.taxCurrency })));
  if (error) return { error };
  revalidatePath("/points");
  return { ok: true, note: `Shared ${r.rows.length} ${r.rows.length === 1 ? "seat" : "seats"}. Thank you!` };
}

/** "Still there?" on a traveler report. */
export async function voteAwardSeat(id: number, still: boolean): Promise<ReportState> {
  if (!Number.isSafeInteger(id) || id <= 0) return { error: "Not found." };
  const { supabase } = await requireUserId();
  const { data, error } = await supabase.rpc("vote_award_seat", { p_id: id, p_still: still });
  if (error) return { error: error.message.includes("no longer open") ? "That report is already closed." : "Couldn't save your vote." };
  revalidatePath("/points");
  return { ok: true, note: data === "closed" ? "Thanks, it's been taken down." : still ? "Thanks, it'll stay up." : "Thanks for checking." };
}

export type SharedPage = {
  rows: PastedSeat[];
  program: string | null;
  origin?: string;
  destination?: string;
  date?: string;
  cabin?: string;
  error?: string;
};

/**
 * "Send to WRLD" from an airline's results page (WRLD button or bookmark).
 * Reads the page's address for the route and the visible text for dates,
 * points and taxes. The text is only read here; it isn't stored or logged.
 */
export async function readSharedPage(url: string, text: string): Promise<SharedPage> {
  await requireUserId();
  const meta = readAirlineUrl(String(url).slice(0, 4000));
  if (!meta.program) return { rows: [], program: null, error: "That page isn't an airline WRLD knows. Open an award search on the airline's site first." };
  const rows = seatsFromText(String(text).slice(0, 200_000), new Date(), meta.date ?? null);
  if (!rows.length) return { ...meta, rows, error: "No award prices found on that page. Wait for the results to load, then try again." };
  return { ...meta, rows };
}

/** Unlinks the traveler's Seats.aero account (tokens are deleted). */
export async function disconnectSeatsAero(): Promise<void> {
  const { supabase } = await requireUserId();
  await supabase.rpc("seats_link_delete");
  revalidatePath("/points");
}
