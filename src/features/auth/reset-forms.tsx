"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { type AuthState, requestPasswordReset, resendConfirmation, updatePassword } from "./actions";

function Feedback({ state }: { state: AuthState }) {
  return (
    <>
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
    </>
  );
}

/** Email in, reset link out. */
export function ForgotPasswordForm({ resend = false }: { resend?: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(resend ? resendConfirmation : requestPasswordReset, {});
  return (
    <form action={action} className="grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <Feedback state={state} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "One moment…" : resend ? "Send a new confirmation link" : "Email me a reset link"}
      </Button>
    </form>
  );
}

/** New password, twice. */
export function NewPasswordForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(updatePassword, {});
  return (
    <form action={action} className="grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" minLength={8} autoComplete="new-password" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirm">Type it again</Label>
        <Input id="confirm" name="confirm" type="password" minLength={8} autoComplete="new-password" required />
      </div>
      <Feedback state={state} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}
