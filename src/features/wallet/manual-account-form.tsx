"use client";

import { useActionState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { addManualAccount, type WalletState } from "./actions";

export function ManualAccountForm({ programs }: { programs: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<WalletState, FormData>(addManualAccount, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-[1fr_9rem_6rem_auto] sm:items-end">
      <div className="grid gap-2">
        <Label htmlFor="program_id">Program</Label>
        <NativeSelect id="program_id" name="program_id" defaultValue="" required>
          <option value="" disabled>Choose a program</option>
          {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </NativeSelect>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="balance">Balance</Label>
        <Input id="balance" name="balance" type="number" min={0} step={1} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="member_last4">Last 4</Label>
        <Input id="member_last4" name="member_last4" maxLength={4} placeholder="Opt." />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>{pending ? "Adding…" : "Add"}</Button>
      {state.error && <p role="alert" className="text-sm text-destructive sm:col-span-4">{state.error}</p>}
    </form>
  );
}
