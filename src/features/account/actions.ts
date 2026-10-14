"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient, requireUserId } from "@/lib/supabase/server";

export type AccountState = { error?: string; ok?: boolean; message?: string };

const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const text = (max: number) => z.preprocess(blankToNull, z.string().trim().max(max).nullable());
const first = (e: z.ZodError) => e.issues[0]?.message ?? "Check the form and try again.";

// ---------------------------------------------------------------------------
// Name, home country/currency/airport (visible to people on your trips)
// ---------------------------------------------------------------------------
export async function updateProfile(_: AccountState, formData: FormData): Promise<AccountState> {
  const parsed = z
    .object({
      display_name: z.string().trim().min(1, "Add your name.").max(80),
      home_country: z.preprocess(blankToNull, z.string().length(2).nullable()),
      home_currency: z.literal("USD").catch("USD"),
      home_airport: z.preprocess(
        (v) => (typeof v === "string" && v.trim() ? v.trim().toUpperCase() : null),
        z.string().regex(/^[A-Z]{3}$/, "Airport codes are 3 letters, like DTW.").nullable(),
      ),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: first(parsed.error) };

  const { supabase, userId } = await requireUserId();
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", userId);
  if (error) return { error: "Couldn't save your profile." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}

export async function setAvatar(url: string | null): Promise<AccountState> {
  const { supabase, userId } = await requireUserId();
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${userId}/`;
  if (url !== null && !url.startsWith(base)) return { error: "That photo didn't upload correctly." };
  const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
  if (error) return { error: "Couldn't save your photo." };
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Private details: phone and home address (only you can see these)
// ---------------------------------------------------------------------------
export async function updateDetails(_: AccountState, formData: FormData): Promise<AccountState> {
  const parsed = z
    .object({
      phone: z.preprocess(
        blankToNull,
        z.string().trim().regex(/^[+0-9 ().-]{6,32}$/, "Use digits, spaces and + only, like +1 313 555 0100.").nullable(),
      ),
      address_line1: text(200),
      address_line2: text(200),
      city: text(120),
      region: text(120),
      postal_code: text(20),
      country_code: z.preprocess(blankToNull, z.string().length(2).nullable()),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: first(parsed.error) };

  const { supabase, userId } = await requireUserId();
  const { error } = await supabase.from("account_details").upsert({ user_id: userId, ...parsed.data });
  if (error) return { error: "Couldn't save your details." };
  revalidatePath("/account");
  return { ok: true, message: "Saved." };
}

// ---------------------------------------------------------------------------
// Sign-in email and password
// ---------------------------------------------------------------------------
export async function changeEmail(_: AccountState, formData: FormData): Promise<AccountState> {
  const parsed = z.object({ email: z.email("Enter a valid email address.") }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: first(parsed.error) };
  const supabase = await createClient();
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const { error } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo: `${origin}/auth/confirm?next=/account` },
  );
  if (error) return { error: error.message };
  return { ok: true, message: `Check ${parsed.data.email} (and your current inbox) for a link to confirm the change.` };
}

export async function changePassword(_: AccountState, formData: FormData): Promise<AccountState> {
  const parsed = z
    .object({
      password: z.string().min(8, "Use at least 8 characters."),
      confirm: z.string(),
    })
    .refine((v) => v.password === v.confirm, { message: "The two passwords don't match." })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: first(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };
  return { ok: true, message: "Password changed." };
}

// ---------------------------------------------------------------------------
// Delete account (required by the App Store and Google Play)
// ---------------------------------------------------------------------------
export async function deleteAccount(_: AccountState, formData: FormData): Promise<AccountState> {
  if (formData.get("confirm") !== "DELETE") return { error: "Type DELETE to confirm." };
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) redirect("/login?next=/account");

  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ confirm: "DELETE" }),
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  if (!response?.ok) {
    const body = (await response?.json().catch(() => null)) as { error?: string } | null;
    return { error: body?.error ?? "We couldn't delete your account. Try again in a minute." };
  }

  await supabase.auth.signOut();
  redirect("/login?deleted=1");
}
