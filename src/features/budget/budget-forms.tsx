"use client";

import { useActionState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { addExpense, updateTripMoney, type ActionState } from "@/features/trips/actions";
import { EXPENSE_CATEGORIES } from "@/types/database";
import { CATEGORY_LABEL } from "./labels";



export function BudgetSettingsForm({ tripId, budget, partySize, currency }: { tripId: string; budget: number | null; partySize: number; currency: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateTripMoney.bind(null, tripId), {});
  return (
    <form action={action} className="grid grid-cols-[1fr_5rem] items-end gap-3 sm:grid-cols-[1fr_6rem_auto]">
      <div className="grid gap-2">
        <Label htmlFor="budget">Budget ({currency})</Label>
        <Input id="budget" name="budget" type="number" min={0} step="0.01" defaultValue={budget ?? ""} placeholder="No limit set" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="party_size">Travelers</Label>
        <Input id="party_size" name="party_size" type="number" min={1} max={50} defaultValue={partySize} />
      </div>
      <Button type="submit" variant="outline" disabled={pending} className="col-span-2 sm:col-span-1">Save</Button>
      {state.error && <p role="alert" className="col-span-2 text-sm text-destructive sm:col-span-3">{state.error}</p>}
    </form>
  );
}

export function ExpenseForm({ tripId, currency, currencies, today }: { tripId: string; currency: string; currencies: string[]; today: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addExpense.bind(null, tripId), {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="grid gap-3 rounded-xl border bg-card p-5">
      <h3 className="text-lg font-semibold">Log something you spent</h3>
      <p className="-mt-2 text-sm text-muted-foreground">Meals, taxis, souvenirs. Converted to {currency} at that day&rsquo;s rate.</p>
      <div className="grid gap-2">
        <Label htmlFor="e-desc">What for</Label>
        <Input id="e-desc" name="description" placeholder="Dinner at Taberna" required />
      </div>
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <div className="grid gap-2">
          <Label htmlFor="e-amount">Amount</Label>
          <Input id="e-amount" name="amount" type="number" min={0} step="0.01" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="e-cur">Currency</Label>
          <NativeSelect id="e-cur" name="currency" defaultValue={currency}>
            {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
          </NativeSelect>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="e-cat">Category</Label>
          <NativeSelect id="e-cat" name="category" defaultValue="food">
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="e-date">Date</Label>
          <Input id="e-date" name="incurred_on" type="date" defaultValue={today} required />
        </div>
      </div>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <div>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Add expense"}</Button>
      </div>
    </form>
  );
}

