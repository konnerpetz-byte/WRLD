"use client";

import { EyeOff, Users } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/features/trips/actions";
import { formatMoney } from "@/lib/format";
import { applyComfortBudget, releaseComfortBudget, setComfortBudget } from "./group-budget-actions";

export type ComfortSummary = { responses: number; members: number; comfortable: number | null; mine: number | null };
export type ComfortAnswered = { user_id: string; name: string; answered: boolean; is_me: boolean }[];

/**
 * "What can everyone afford?" Each traveler answers privately; the group sees
 * only the lowest answer, rounded down, so nobody has to say a number out loud
 * or quietly overspend to keep the peace.
 */
export function GroupBudgetCard({
  tripId,
  currency,
  partySize,
  summary,
  canEdit,
  currentBudget,
  answered = [],
}: {
  answered?: ComfortAnswered;
  tripId: string;
  currency: string;
  partySize: number;
  summary: ComfortSummary;
  canEdit: boolean;
  currentBudget: number | null;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(setComfortBudget.bind(null, tripId), {});
  const [applyState, apply, applying] = useActionState<ActionState, FormData>(applyComfortBudget.bind(null, tripId), {});
  const [releaseState, release, releasing] = useActionState<ActionState, FormData>(releaseComfortBudget.bind(null, tripId), {});
  const solo = summary.members <= 1;
  const suggested = summary.comfortable !== null ? summary.comfortable * partySize : null;
  const alreadyApplied = suggested !== null && currentBudget !== null && Math.abs(currentBudget - suggested) < 1;

  return (
    <section aria-labelledby="comfort-h" className="grid gap-5 rounded-2xl border bg-card p-5 md:grid-cols-[1.1fr_1fr]">
      <div className="grid content-start gap-2">
        <h2 id="comfort-h" className="flex items-center gap-2 text-xl font-semibold">
          <EyeOff className="size-5 text-brand" aria-hidden="true" />
          {solo ? "What do you want to spend?" : "What can everyone afford?"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {solo
            ? "Set what you're comfortable spending on this trip, per person. Recommendations will favor what fits."
            : "Each person answers privately. WRLD shows the group only the lowest answer, rounded down, never who said it. No awkward conversations, no paying more just to keep the peace."}
        </p>
        <form action={action} className="mt-2 grid max-w-sm grid-cols-[1fr_auto] items-end gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor="comfort-amount">
              {summary.mine !== null ? "Your private answer" : "Comfortable for you, per person"} ({currency})
            </Label>
            <Input
              id="comfort-amount"
              name="amount"
              type="number"
              inputMode="decimal"
              min={1}
              step="1"
              required
              defaultValue={summary.mine ?? ""}
              placeholder="e.g. 1500"
              aria-describedby="comfort-help"
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : summary.mine !== null ? "Update" : "Save privately"}
          </Button>
          <p id="comfort-help" className="col-span-2 text-xs text-muted-foreground">
            Everything for the trip: flights, stays, food and activities.
            {summary.members === 2 && " With two people, the other person can work out roughly what you said."}
          </p>
          {state.error && (
            <p role="alert" className="col-span-2 text-sm text-destructive">
              {state.error}
            </p>
          )}
          {state.ok && (
            <p role="status" className="col-span-2 text-sm text-primary">
              {state.note}
            </p>
          )}
        </form>
      </div>

      <div className="grid content-start gap-3 rounded-xl bg-muted/60 p-4">
        {!solo && (
          <div className="grid gap-2">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Users className="size-4 text-muted-foreground" aria-hidden="true" />
              {summary.responses} of {summary.members} have answered
            </p>
            <div className="flex gap-1" aria-hidden="true">
              {Array.from({ length: summary.members }, (_, i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-full ${i < summary.responses ? "bg-primary" : "bg-border"}`} />
              ))}
            </div>
            {answered.length > 0 && (
              <ul className="grid gap-1 text-sm">
                {answered.map((a) => (
                  <li key={a.user_id} className="flex justify-between gap-3">
                    <span>{a.is_me ? `${a.name} (you)` : a.name}</span>
                    <span className={a.answered ? "text-primary" : "text-muted-foreground"}>{a.answered ? "Answered" : "Waiting"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {summary.comfortable !== null ? (
          <>
            <div>
              <p className="text-sm text-muted-foreground">{solo ? "Your budget" : "Everyone is comfortable with"}</p>
              <p className="font-display text-3xl font-semibold tabular-nums">
                {formatMoney(summary.comfortable, currency, { cents: false })}
                <span className="text-base font-normal text-muted-foreground"> per person</span>
              </p>
              {partySize > 1 && (
                <p className="text-sm text-muted-foreground">
                  {formatMoney(suggested, currency, { cents: false })} for {partySize} travelers
                </p>
              )}
            </div>
            {canEdit &&
              (alreadyApplied ? (
                <p className="text-sm text-primary">This is the trip budget.</p>
              ) : (
                <form action={apply}>
                  <Button type="submit" variant="outline" disabled={applying}>
                    {applying ? "Updating…" : "Use as the trip budget"}
                  </Button>
                </form>
              ))}
            {applyState.error && (
              <p role="alert" className="text-sm text-destructive">
                {applyState.error}
              </p>
            )}
          </>
        ) : (
          <div className="grid gap-2">
            <p className="text-sm text-muted-foreground">
              The group number appears once everyone has answered, so nobody can work out anyone else&rsquo;s. You see who has answered,
              never what they said.
            </p>
            {canEdit && summary.responses >= 2 && summary.responses < summary.members && (
              <form action={release}>
                <Button type="submit" variant="outline" size="sm" disabled={releasing}>
                  {releasing ? "One moment…" : `Go ahead with ${summary.responses} answers`}
                </Button>
              </form>
            )}
            {releaseState.error && (
              <p role="alert" className="text-sm text-destructive">
                {releaseState.error}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
