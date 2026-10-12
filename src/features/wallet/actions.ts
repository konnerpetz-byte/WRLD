"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUserId } from "@/lib/supabase/server";

export type WalletState = { error?: string; ok?: boolean };

export async function addManualAccount(_: WalletState, formData: FormData): Promise<WalletState> {
  const parsed = z
    .object({
      program_id: z.uuid("Choose a program."),
      balance: z.coerce.number().int("Whole points only.").min(0, "Balances can't be negative."),
      member_last4: z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^[0-9A-Za-z]{1,4}$/, "Up to 4 letters or numbers.").nullable()),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase, userId } = await requireUserId();
  const { error } = await supabase.from("loyalty_accounts").insert({ ...parsed.data, user_id: userId, source: "manual" });
  if (error) return { error: "Couldn't add that account." };
  revalidatePath("/wallet");
  return { ok: true };
}

export async function deleteManualAccount(id: string) {
  const { supabase } = await requireUserId();
  await supabase.from("loyalty_accounts").delete().eq("id", id).eq("source", "manual");
  revalidatePath("/wallet");
}

export async function disconnectWallet(connectionId: string) {
  const { supabase } = await requireUserId();
  // Cascades to the token and every synced account from this connection.
  await supabase.from("wallet_connections").delete().eq("id", connectionId);
  revalidatePath("/wallet");
}
