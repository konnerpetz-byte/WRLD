"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUserId } from "@/lib/supabase/server";

import { SOURCE_PROGRAM } from "./regions";

export type ReportState = { ok?: boolean; error?: string; note?: string };

const schema = z.object({
  origin: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter airport code."),
  destination: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter airport code."),
  date: z.iso.date("Pick the date."),
  program: z.string().refine((p) => p in SOURCE_PROGRAM, "Pick the program."),
  cabin: z.enum(["economy", "premium", "business", "first"]),
  miles: z.coerce.number().int("Whole points only.").min(1000, "That looks too low.").max(1000000),
  direct: z.preprocess((v) => v === "on", z.boolean()),
});

/** "I found a seat": a traveler shares award space they saw on the airline's site. */
export async function reportAwardSeat(_: ReportState, formData: FormData): Promise<ReportState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  const r = parsed.data;
  if (r.origin === r.destination) return { error: "From and to can't be the same airport." };
  const { supabase } = await requireUserId();
  const { error } = await supabase.rpc("report_award_seat", {
    p_origin: r.origin,
    p_destination: r.destination,
    p_date: r.date,
    p_program: r.program,
    p_cabin: r.cabin,
    p_miles: r.miles,
    p_direct: r.direct,
  });
  if (error) return { error: error.message.includes("20 reports") ? error.message : "Couldn't save that. Check the date is in the next year." };
  revalidatePath("/points");
  return { ok: true, note: "Thanks! Other travelers will see it for the next three days." };
}
