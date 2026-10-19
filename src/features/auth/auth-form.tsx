"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signUp, type AuthState } from "./actions";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "login" ? signIn : signUp, {});

  return (
    <form action={action} className="grid gap-5">
      {next && <input type="hidden" name="next" value={next} />}
      {mode === "signup" && (
        <div className="grid gap-2">
          <Label htmlFor="full_name">Name</Label>
          <Input id="full_name" name="full_name" autoComplete="name" required />
        </div>
      )}
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          minLength={8}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
        />
      </div>

      {mode === "signup" && (
        <div className="flex items-start gap-3">
          <input
            id="accept_terms"
            name="accept_terms"
            type="checkbox"
            required
            className="mt-0.5 size-5 shrink-0 accent-primary"
            aria-describedby="accept_terms_note"
          />
          <Label htmlFor="accept_terms" className="block text-sm leading-snug font-normal">
            I agree to the{" "}
            <Link href="/terms" target="_blank" className="font-medium text-primary underline underline-offset-4">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" target="_blank" className="font-medium text-primary underline underline-offset-4">
              Privacy Policy
            </Link>
            .
            <span id="accept_terms_note" className="mt-1 block text-xs text-muted-foreground">
              You must be at least 13 (16 in the EU and UK). We don&rsquo;t send marketing email.
            </span>
          </Label>
        </div>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="rounded-md bg-open-soft px-3 py-2 text-sm">
          {state.message}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "One moment…" : mode === "login" ? "Sign in" : "Create account"}
      </Button>
      {mode === "login" && (
        <p className="text-sm">
          <Link href={state.unconfirmed ? "/forgot-password?confirm=1" : "/forgot-password"} className="font-medium text-primary underline underline-offset-4">
            {state.unconfirmed ? "Send a new confirmation email" : "Forgot your password?"}
          </Link>
        </p>
      )}

      <p className="text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="font-medium text-primary underline underline-offset-4">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-medium text-primary underline underline-offset-4">
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
