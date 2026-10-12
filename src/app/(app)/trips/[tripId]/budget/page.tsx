import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BudgetSettingsForm, ExpenseForm } from "@/features/budget/budget-forms";
import { CATEGORY_LABEL } from "@/features/budget/labels";
import { deleteExpense } from "@/features/trips/actions";
import { getTrip } from "@/features/trips/queries";
import { formatDay, formatMoney, formatPoints, toNumber } from "@/lib/format";
import { requireUserId } from "@/lib/supabase/server";

export const metadata = { title: "Budget" };

const STATUS = { booked: "Booked", held: "On hold", idea: "Idea" } as const;
const SOURCE = { activity: "Activity", lodging: "Stay", transit: "Travel" } as const;

export default async function BudgetPage({ params }: PageProps<"/trips/[tripId]/budget">) {
  const { tripId } = await params;
  const { supabase } = await requireUserId();
  const [{ trip, budget, canEdit }, categories, planned, points, expenses, currencies] = await Promise.all([
    getTrip(tripId),
    supabase.from("trip_budget_by_category").select("*").eq("trip_id", tripId),
    supabase.from("trip_planned_costs").select("*").eq("trip_id", tripId).order("on_date"),
    supabase.from("trip_points_planned").select("*").eq("trip_id", tripId),
    supabase.from("expenses").select("*").eq("trip_id", tripId).order("incurred_on", { ascending: false }),
    supabase.from("currencies").select("code").order("code"),
  ]);

  const programIds = (points.data ?? []).map((p) => p.loyalty_program_id);
  const { data: programs } = programIds.length
    ? await supabase.from("loyalty_programs").select("id, name").in("id", programIds)
    : { data: [] };
  const programName = new Map((programs ?? []).map((p) => [p.id, p.name]));

  const cur = trip.currency;
  const n = (v: unknown) => toNumber(v as number) ?? 0;
  const projected = n(budget?.projected_total);
  const committed = n(budget?.projected_committed);
  const limit = toNumber(trip.budget);
  const cats = (categories.data ?? []).filter((c) => n(c.total) > 0).sort((a, b) => n(b.total) - n(a.total));
  const maxCat = Math.max(1, ...cats.map((c) => n(c.total)));
  const pointsPlanned = (points.data ?? []).filter((p) => n(p.points_committed) + n(p.points_ideas) > 0);

  return (
    <div className="grid gap-10">
      {/* The answer to "how much will this trip cost?" */}
      <section aria-labelledby="totals" className="grid gap-6 rounded-2xl bg-sidebar p-6 text-sidebar-foreground md:grid-cols-[1.2fr_1fr]">
        <div>
          <h2 id="totals" className="text-sm font-normal text-sidebar-foreground/80">This trip costs</h2>
          <p className="font-display text-6xl font-semibold text-white">{formatMoney(projected, cur)}</p>
          <p className="mt-2">
            {formatMoney(committed, cur)} is booked. {n(budget?.planned_ideas) > 0 && `${formatMoney(budget?.planned_ideas, cur)} is still ideas.`}
          </p>
          {trip.party_size > 1 && <p className="mt-1 text-sidebar-foreground/80">{formatMoney(budget?.projected_per_person, cur)} per person for {trip.party_size} travelers</p>}
          {pointsPlanned.length > 0 && (
            <p className="mt-1 text-travel">
              Plus {pointsPlanned.map((p) => `${formatPoints(n(p.points_committed) + n(p.points_ideas))} ${programName.get(p.loyalty_program_id) ?? "points"}`).join(" and ")}
            </p>
          )}
        </div>
        <div className="grid content-between gap-4 rounded-xl bg-white/5 p-4">
          {limit !== null ? (
            <p className={`font-display text-2xl font-semibold ${projected > limit ? "text-travel" : "text-white"}`}>
              {projected > limit
                ? `${formatMoney(projected - limit, cur)} over budget`
                : `${formatMoney(limit - projected, cur)} left to spend`}
            </p>
          ) : (
            <p className="text-white">Set a budget to see what&rsquo;s left.</p>
          )}
          {canEdit && (
            <div className="rounded-lg bg-background p-3 text-foreground">
              <BudgetSettingsForm tripId={tripId} budget={limit} partySize={trip.party_size} currency={cur} />
            </div>
          )}
          {n(budget?.items_missing_rate) > 0 && (
            <p className="text-sm">
              {budget?.items_missing_rate} item{n(budget?.items_missing_rate) > 1 ? "s are" : " is"} in a currency we don&rsquo;t have a rate for yet, so {n(budget?.items_missing_rate) > 1 ? "they aren't" : "it isn't"} counted.
            </p>
          )}
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-[1fr_24rem] lg:items-start">
        <div className="grid gap-10">
          {cats.length > 0 && (
            <section aria-labelledby="by-category">
              <h2 id="by-category" className="mb-4 text-xl font-semibold">Where the money goes</h2>
              <ul className="grid gap-3">
                {cats.map((c) => (
                  <li key={c.category} className="grid grid-cols-[8rem_1fr_6rem] items-center gap-3 text-sm">
                    <span>{CATEGORY_LABEL[c.category]}</span>
                    <span className="flex h-3 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                      <span className="bg-primary" style={{ width: `${(n(c.committed) / maxCat) * 100}%` }} />
                      <span className="bg-primary/40" style={{ width: `${(n(c.ideas) / maxCat) * 100}%` }} />
                      <span className="bg-travel" style={{ width: `${(n(c.spent_unplanned) / maxCat) * 100}%` }} />
                    </span>
                    <span className="text-right font-medium">{formatMoney(c.total, cur)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-primary" />Booked</span>
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-primary/40" />Ideas</span>
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-travel" />Spent outside the plan</span>
              </p>
            </section>
          )}

          <section aria-labelledby="planned">
            <h2 id="planned" className="mb-1 text-xl font-semibold">Everything priced in the plan</h2>
            <p className="mb-4 text-sm text-muted-foreground">Added automatically from your itinerary, flights and stays.</p>
            {!planned.data?.length ? (
              <p className="rounded-xl border border-dashed bg-card p-6 text-muted-foreground">
                Nothing priced yet. Add an activity, flight or stay and its price lands here.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 font-normal">Item</th>
                    <th className="py-2 font-normal max-sm:hidden">Day</th>
                    <th className="py-2 font-normal">Status</th>
                    <th className="py-2 text-right font-normal">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {planned.data.map((p) => (
                    <tr key={p.source_id} className="border-b last:border-0">
                      <td className="py-2.5">
                        <span className="font-medium">{p.title}</span>
                        <span className="block text-xs text-muted-foreground">{SOURCE[p.source]}</span>
                      </td>
                      <td className="py-2.5 max-sm:hidden">{formatDay(p.on_date)}</td>
                      <td className="py-2.5">{STATUS[p.booking_status]}</td>
                      <td className="py-2.5 text-right">
                        {formatMoney(p.cost_in_trip_currency, cur)}
                        {p.currency && p.currency !== cur && p.cost !== null && (
                          <span className="block text-xs text-muted-foreground">{formatMoney(p.cost, p.currency)}</span>
                        )}
                        {p.points_used !== null && <span className="block text-xs text-muted-foreground">+ {formatPoints(p.points_used)} pts</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="pt-3 font-medium max-sm:hidden">Planned total</td>
                    <td colSpan={2} className="pt-3 font-medium sm:hidden">Planned total</td>
                    <td className="pt-3 text-right font-display text-lg font-semibold">{formatMoney(budget?.planned_total, cur)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </section>
        </div>

        <aside className="grid gap-6">
          {canEdit && (
            <ExpenseForm
              tripId={tripId}
              currency={cur}
              currencies={(currencies.data ?? []).map((c) => c.code)}
              today={new Date().toISOString().slice(0, 10)}
            />
          )}
          <section aria-labelledby="spent">
            <h3 id="spent" className="mb-3 text-lg font-semibold">Spent so far</h3>
            {!expenses.data?.length ? (
              <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
            ) : (
              <ul className="divide-y rounded-xl border bg-card">
                {expenses.data.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="flex-1">
                      <span className="block font-medium">{e.description}</span>
                      <span className="text-xs text-muted-foreground">
                        {CATEGORY_LABEL[e.category]}, {formatDay(e.incurred_on)}
                      </span>
                    </span>
                    <span className="text-right">
                      {formatMoney(e.amount_in_trip_currency ?? e.amount, e.amount_in_trip_currency !== null ? cur : e.currency)}
                      {e.currency !== cur && <span className="block text-xs text-muted-foreground">{formatMoney(e.amount, e.currency)}</span>}
                    </span>
                    {canEdit && (
                      <form action={deleteExpense.bind(null, tripId, e.id)}>
                        <Button type="submit" variant="ghost" size="icon-xs" aria-label={`Remove ${e.description}`}>
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
