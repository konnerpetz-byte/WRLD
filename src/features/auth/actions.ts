"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { safePath } from "@/lib/safe-path";

import { LEGAL_VERSION } from "@/features/legal/version";

import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string; unconfirmed?: boolean };

const credentials = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters for your password."),
});

/** Only allow redirects back into this app. */
const safeNext = (value: FormDataEntryValue | null) => safePath(value);

export async function signIn(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error?.code === "email_not_confirmed") {
    return { error: "This email isn't confirmed yet. Use the link in your sign-up email, or send a new one below.", unconfirmed: true };
  }
  if (error) return { error: "That email and password don't match an account. Forgot your password? Reset it below." };

  redirect(safeNext(formData.get("next")));
}

export async function signUp(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials
    .extend({
      full_name: z.string().trim().min(1, "Enter your name.").max(80),
      accept_terms: z.literal("on", { error: "Please agree to the Terms and Privacy Policy to create an account." }),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;

  // Coming from an invite link → straight back to it; otherwise the quiz.
  const next = formData.get("next") ? safeNext(formData.get("next")) : "/profile/quiz";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Record of consent: which version of the Terms and Privacy Policy they agreed to, and when.
      data: { full_name: parsed.data.full_name, terms_version: LEGAL_VERSION, terms_accepted_at: new Date().toISOString() },
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { error: error.message };

  // Email confirmation on (Supabase default): no session yet.
  if (!data.session) return { message: "Check your email for a link to finish signing up." };
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const siteOrigin = async () => {
  const h = await headers();
  return h.get("origin") ?? `https://${h.get("host")}`;
};
const emailOnly = z.object({ email: z.email("Enter a valid email address.") });

/**
 * "Forgot password": emails a one-time link that signs the person in on /reset-password.
 * Always says the same thing, so nobody can use this to find out who has an account.
 */
export async function requestPasswordReset(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = emailOnly.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteOrigin()}/auth/confirm?next=${encodeURIComponent("/reset-password")}`,
  });
  if (error && error.status === 429) return { error: "Too many reset emails just now. Wait a minute and try again." };
  return { message: "If that email has a WRLD account, a reset link is on its way. Check spam too; the link works once and expires in an hour." };
}

/** Sets a new password for the person the reset link signed in. */
export async function updatePassword(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z
    .object({ password: z.string().min(8, "Use at least 8 characters for your password."), confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "The two passwords don't match.", path: ["confirm"] })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "This reset link has expired or was already used. Ask for a new one." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.code === "same_password" ? "That's your current password. Pick a new one." : error.message };
  redirect("/trips");
}

/** Sends the sign-up confirmation email again. */
export async function resendConfirmation(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = emailOnly.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=${encodeURIComponent("/trips")}` },
  });
  return { message: "If that email is waiting to be confirmed, a new link is on its way." };
}
