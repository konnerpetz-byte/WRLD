"use client";

import { Coins, Trash2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { formatMoney } from "@/lib/format";

import { addPointsContribution, deletePointsContribution, type PointsState, setPointValue } from "./points-actions";
import { POINT_VALUE_PRESETS, pointsWorth } from "./points-split";

export type PointsRow = {
  id: string;
  paidBy: string | null;
  payerName: string;
  description: string;
  program: string | null;
  points: number;
  valueCents: number | null;
  sharedBy: number | null;
};

const PROGRAMS = [
  "Chase Ultimate Rewards", "Amex Membership Rewards", "Capital One Miles", "Citi ThankYou", "Bilt Rewards",
  "United MileagePlus", "Delta SkyMiles", "American AAdvantage", "Southwest Rapid Rewards", "Alaska Mileage Plan",
  "JetBlue TrueBlue", "Air Canada Aeroplan", "Air France-KLM Flying Blue", "British Airways Avios",
  "World of Hyatt", "Marriott Bonvoy", "Hilton Honors", "IHG One Rewards",
];

const pts = (n: number) => n.toLocaleString("en-US");

/**
 * Paid with points: the group agrees what a point is worth, and anyone who books with points for
 * others is paid back like cash in "Who owes whom". Points never count toward the cash budget.
 */
export function PointsSplitCard({
  tripId,
  currency,
  valueCents,
  rows,
  members,
  me,
  canEdit,
}: {
  tripId: string;
  currency: string;
  valueCents: number;
  rows: PointsRow[];
  members: { id: string; name: string }[];
  me: string;
  canEdit: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const group = members.length > 1;
  const total = rows.reduce((s, r) => s + pointsWorth({ points: r.points, value_cents: r.valueCents }, valueCents), 0);

  return (
    <section aria-labelledby="points-split" className="grid gap-4 rounded-xl border border-travel/40 bg-travel-soft p-5">
      <div>
        <h3 id="points-split" className="flex items-center gap-2 text-lg font-semibold">
          <Coins className="size-5 text-travel-ink" aria-hidden="true" /> Paid with points
        </h3>
        <p className="text-sm text-muted-foreground">
          {group
            ? "Booked something for the group with your points? Agree what a point is worth and you get paid back like cash."
            : "Invite your travel partners and anyone who books with points gets paid back fairly, at a value you all agree on."}
        </p>
      </div>

      <PointValue tripId={tripId} currency={currency} valueCents={valueCents} canEdit={canEdit} />

      {rows.length > 0 && (
        <ul className="divide-y rounded-lg border bg-card">
          {rows.map((r) => {
            const worth = pointsWorth({ points: r.points, value_cents: r.valueCents }, valueCents);
            return (
              <li key={r.id} className="flex items-start gap-3 px-3 py-2.5 text-sm">
                <span className="flex-1">
                  <span className="block font-medium">{r.description}</span>
                  <span className="text-xs text-muted-foreground">
                    {r.paidBy === me ? "You" : r.payerName} used {pts(r.points)} {r.program ?? "points"}
                    {r.valueCents != null && ` at ${r.valueCents}¢`}
                    {group && (r.sharedBy ? `, split ${r.sharedBy} ways` : ", split by everyone")}
                  </span>
                </span>
                <span className="font-display font-semibold">{formatMoney(worth, currency)}</span>
                {canEdit && (
                  <form action={deletePointsContribution.bind(null, tripId, r.id)}>
                    <Button type="submit" variant="ghost" size="icon-xs" aria-label={`Remove ${r.description}`}>
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </form>
                )}
              </li>
            );
          })}
          <li className="flex justify-between px-3 py-2 text-xs text-muted-foreground">
            <span>Counted in who owes whom, not in the cash budget</span>
            <span>{formatMoney(total, currency)}</span>
          </li>
        </ul>
      )}

      {canEdit &&
        (adding ? (
          <AddPoints tripId={tripId} currency={currency} valueCents={valueCents} members={members} me={me} onDone={() => setAdding(false)} />
        ) : (
          <Button type="button" variant="outline" onClick={() => setAdding(true)} className="justify-self-start">
            Add points someone used
          </Button>
        ))}
    </section>
  );
}

function PointValue({ tripId, currency, valueCents, canEdit }: { tripId: string; currency: string; valueCents: number; canEdit: boolean }) {
  const [state, action, pending] = useActionState<PointsState, FormData>(setPointValue.bind(null, tripId), {});
  const [value, setValue] = useState(String(valueCents));
  const per10k = formatMoney((Number(value) || valueCents) * 100, currency);
  if (!canEdit) {
    return (
      <p className="text-sm">
        Your group values a point at <strong>{valueCents}¢</strong> ({formatMoney(valueCents * 100, currency)} per 10,000 points).
      </p>
    );
  }
  return (
    <form action={action} className="grid gap-2">
      <Label htmlFor="pv" className="text-sm">
        What&rsquo;s a point worth to your group?
      </Label>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Common values">
        {POINT_VALUE_PRESETS.map((p) => (
          <button
            key={p.cents}
            type="submit"
            name="point_value_cents"
            value={p.cents}
            title={p.note}
            className={`tap rounded-full border px-3 py-1.5 text-sm transition-colors ${
              Number(valueCents) === p.cents ? "border-travel bg-travel text-travel-foreground" : "bg-card hover:border-travel"
            }`}
          >
            {p.label}
          </button>
        ))}
        <span className="flex items-center gap-1">
          <Input
            id="pv"
            name="point_value_cents"
            type="number"
            min={0.1}
            max={10}
            step="0.05"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-8 w-20"
          />
          <span className="text-sm">¢</span>
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            Set
          </Button>
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {per10k} per 10,000 points.{" "}
        {POINT_VALUE_PRESETS.find((p) => p.cents === Number(value))?.note ?? "Agree on it before anyone books, so nobody feels shortchanged."}
      </p>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}

function AddPoints({
  tripId,
  currency,
  valueCents,
  members,
  me,
  onDone,
}: {
  tripId: string;
  currency: string;
  valueCents: number;
  members: { id: string; name: string }[];
  me: string;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<PointsState, FormData>(addPointsContribution.bind(null, tripId), {});
  const [points, setPoints] = useState("");
  const [own, setOwn] = useState("");
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);
  const worth = Number(points) > 0 ? pointsWorth({ points: Number(points), value_cents: own ? Number(own) : null }, valueCents) : null;

  return (
    <form ref={ref} action={action} className="grid gap-3 rounded-lg border bg-card p-4">
      <div className="grid gap-1.5">
        <Label htmlFor="pc-desc">What for</Label>
        <Input id="pc-desc" name="description" placeholder="Everyone's flights to Lisbon" required maxLength={200} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="pc-pts">Points or miles</Label>
          <Input id="pc-pts" name="points" type="number" inputMode="numeric" min={1} step={1} required value={points} onChange={(e) => setPoints(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pc-prog">Program (optional)</Label>
          <Input id="pc-prog" name="program" list="pc-programs" maxLength={80} placeholder="United MileagePlus" />
          <datalist id="pc-programs">
            {PROGRAMS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
      </div>
      {members.length > 1 && (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="pc-paid">Whose points</Label>
            <NativeSelect id="pc-paid" name="paid_by" defaultValue={me}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id === me ? `Me (${m.name})` : m.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <fieldset className="grid gap-1.5">
            <legend className="mb-1 text-sm font-medium">Shared by</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {members.map((m) => (
                <label key={m.id} className="tap flex min-h-8 items-center gap-2">
                  <input type="checkbox" name="split" value={m.id} defaultChecked className="size-4 accent-primary" />
                  {m.id === me ? "Me" : m.name}
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="pc-val">Value for this one (optional)</Label>
        <span className="flex items-center gap-1">
          <Input id="pc-val" name="value_cents" type="number" min={0.1} max={10} step="0.05" placeholder={String(valueCents)} value={own} onChange={(e) => setOwn(e.target.value)} className="w-24" />
          <span className="text-sm text-muted-foreground">¢ a point. Leave blank to use the group&rsquo;s {valueCents}¢.</span>
        </span>
      </div>
      {worth != null && (
        <p className="text-sm">
          Counts as <strong>{formatMoney(worth, currency)}</strong> toward who owes whom.
        </p>
      )}
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
