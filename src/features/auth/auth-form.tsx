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

      <p className="text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link href="/signup" className="font-medium text-primary underline underline-offset-4">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary underline underline-offset-4">
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
