"use server";

import { updateTag } from "next/cache";
import { z } from "zod";

import { VIBES } from "@/features/planner/vibes";
import { requireUserId } from "@/lib/supabase/server";

const Review = z.object({
  qid: z.string().regex(/^Q\d+$/),
  status: z.enum(["approved", "rejected", "pending"]),
  vibes: z.array(z.enum(VIBES.map((v) => v.key) as [string, ...string[]])).max(5).default([]),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
  gem: z.boolean().default(false),
  why: z.string().trim().max(120).default(""),
});

/** Approve or reject one harvested place. Admins only (enforced again by the table's policies). */
export async function reviewPlace(input: z.input<typeof Review>): Promise<{ ok: boolean; error?: string }> {
  const r = Review.safeParse(input);
  if (!r.success) return { ok: false, error: "Check the fields" };
  const { supabase, userId } = await requireUserId();
  const { data: isAdmin } = await supabase.rpc("is_app_admin");
  if (!isAdmin) return { ok: false, error: "Not allowed" };
  const v = r.data;
  if (v.status === "approved" && (!v.why || !v.vibes.length)) return { ok: false, error: "Add a short why and at least one vibe" };
  const { error } = await supabase
    .from("getaway_candidates")
    .update({
      status: v.status,
      vibes: v.status === "approved" ? v.vibes : null,
      tier: v.status === "approved" ? v.tier : null,
      gem: v.status === "approved" ? v.gem : null,
      why: v.status === "approved" ? v.why : null,
      reviewed_at: v.status === "pending" ? null : new Date().toISOString(),
      reviewed_by: v.status === "pending" ? null : userId,
    })
    .eq("qid", v.qid);
  if (error) return { ok: false, error: error.message };
  updateTag("approved-places");
  return { ok: true };
}
