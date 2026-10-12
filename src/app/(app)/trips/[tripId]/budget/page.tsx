import { Suspense } from "react";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { ArrowRight, Trash2 } from "lucide-react";

import { Avatar } from "@/components/avatar";

import { Button } from "@/components/ui/button";
import {
  BudgetSettingsForm,
  ExpenseForm,
} from "@/features/budget/budget-forms";
import { CATEGORY_LABEL } from "@/features/budget/labels";
import { computeBalances } from "@/features/budget/balances";
import { getMembers } from "@/features/group/queries";
import {
  deleteExpense,
  recordSettlement,
  undoSettlement,
} from "@/features/trips/actions";
import { getTrip } from "@/features/trips/queries";
import { formatDay, formatMoney, formatPoints, toNumber } from "@/lib/format";
import { requireUserId } from "@/lib/supabase/server";

export const metadata = { title: "Budget" };

const STATUS = { booked: "Booked", held: "On hold", idea: "Idea" } as const;
const SOURCE = {
  activity: "Activity",
  lodging: "Stay",
  transit: "Travel",
} as const;

export default function BudgetPage(props: PageProps<"/trips/[tripId]/budget">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BudgetPageContent {...props} />
    </Suspense>
  );
}

async function BudgetPageContent({
  params,
}: PageProps<"/trips/[tripId]/budget">) {
  const { tripId } = await params;
  const { supabase } = await requireUserId();
  const [
    { trip, budget, canEdit },
    categories,
    planned,
    points,
    expenses,
    currencies,
    { members, me },
    participants,
    settlements,
  ] = await Promise.all([
    getTrip(tripId),
    supabase.from("trip_budget_by_category").select("*").eq("trip_id", tripId),
    supabase
      .from("trip_planned_costs")
      .select("*")
      .eq("trip_id", tripId)
      .order("on_date"),
    supabase.from("trip_points_planned").select("*").eq("trip_id", tripId),
    supabase
      .from("expenses")
      .select("*")
      .eq("trip_id", tripId)
      .order("incurred_on", { ascending: false }),
    supabase.from("currencies").select("code").order("code"),
    getMembers(tripId),
    supabase
      .from("expense_participants")
      .select("expense_id, user_id")
      .eq("trip_id", tripId),
    supabase
      .from("settlements")
      .select("*")
      .eq("trip_id", tripId)
      .order("settled_on", { ascending: false }),
  ]);

  // Who owes whom
  const name = new Map(members.map((m) => [m.user_id, m.name]));
  const photo = new Map(members.map((m) => [m.user_id, m.avatar_url]));
  const partsByExpense = new Map<string, string[]>();
  for (const p of participants.data ?? [])
    partsByExpense.set(p.expense_id, [
      ...(partsByExpense.get(p.expense_id) ?? []),
      p.user_id,
    ]);
  const group = members.length > 1;
  const balances = computeBalances({
    members: members.map((m) => m.user_id),
    expenses: (expenses.data ?? []).map((e) => ({
      id: e.id,
      paid_by: e.paid_by,
      amount_in_trip_currency:
        e.amount_in_trip_currency === null
          ? null
          : Number(e.amount_in_trip_currency),
    })),
    participants: partsByExpense,
    settlements: (settlements.data ?? []).map((s) => ({
      from_user: s.from_user,
      to_user: s.to_user,
      amount: Number(s.amount),
    })),
  });

  const programIds = (points.data ?? []).map((p) => p.loyalty_program_id);
  const { data: programs } = programIds.length
    ? await supabase
        .from("loyalty_programs")
        .select("id, name")
        .in("id", programIds)
    : { data: [] };
  const programName = new Map((programs ?? []).map((p) => [p.id, p.name]));

  const cur = trip.currency;
  const n = (v: unknown) => toNumber(v as number) ?? 0;
  const projected = n(budget?.projected_total);
  const committed = n(budget?.projected_committed);
  const limit = toNumber(trip.budget);
  const cats = (categories.data ?? [])
    .filter((c) => n(c.total) > 0)
    .sort((a, b) => n(b.total) - n(a.total));
  const maxCat = Math.max(1, ...cats.map((c) => n(c.total)));
  const pointsPlanned = (points.data ?? []).filter(
    (p) => n(p.points_committed) + n(p.points_ideas) > 0
  );

  return (
    <div className="grid gap-10">
      {/* The answer to "how much will this trip cost?" */}
      <section
        aria-labelledby="totals"
        className="grid gap-6 rounded-2xl bg-sidebar p-6 text-sidebar-foreground md:grid-cols-[1.2fr_1fr]"
      >
        <div>
          <h2
            id="totals"
            className="text-sm font-normal text-sidebar-foreground/80"
          >
            This trip costs
          </h2>
          <p className="font-display text-6xl font-semibold text-white">
            {formatMoney(projected, cur)}
          </p>
          <p className="mt-2">
            {formatMoney(committed, cur)} is booked.{" "}
            {n(budget?.planned_ideas) > 0 &&
              `${formatMoney(budget?.planned_ideas, cur)} is still ideas.`}
          </p>
          {trip.party_size > 1 && (
            <p className="mt-1 text-sidebar-foreground/80">
              {formatMoney(budget?.projected_per_person, cur)} per person for{" "}
              {trip.party_size} travelers
            </p>
          )}
          {pointsPlanned.length > 0 && (
            <p className="mt-1 text-travel">
              Plus{" "}
              {pointsPlanned
                .map(
                  (p) =>
                    `${formatPoints(
                      n(p.points_committed) + n(p.points_ideas)
                    )} ${programName.get(p.loyalty_program_id) ?? "points"}`
                )
                .join(" and ")}
            </p>
          )}
        </div>
        <div className="grid content-between gap-4 rounded-xl bg-white/5 p-4">
          {limit !== null ? (
            <p
              className={`font-display text-2xl font-semibold ${
                projected > limit ? "text-travel" : "text-white"
              }`}
            >
              {projected > limit
                ? `${formatMoney(projected - limit, cur)} over budget`
                : `${formatMoney(limit - projected, cur)} left to spend`}
            </p>
          ) : (
            <p className="text-white">Set a budget to see what&rsquo;s left.</p>
          )}
          {canEdit && (
            <div className="rounded-lg bg-background p-3 text-foreground">
              <BudgetSettingsForm
                tripId={tripId}
                budget={limit}
                partySize={trip.party_size}
                currency={cur}
              />
            </div>
          )}
          {n(budget?.items_missing_rate) > 0 && (
            <p className="text-sm">
              {budget?.items_missing_rate} item
              {n(budget?.items_missing_rate) > 1 ? "s are" : " is"} in a
              currency we don&rsquo;t have a rate for yet, so{" "}
              {n(budget?.items_missing_rate) > 1 ? "they aren't" : "it isn't"}{" "}
              counted.
            </p>
          )}
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-[1fr_24rem] lg:items-start">
        <div className="grid gap-10">
          {cats.length > 0 && (
            <section aria-labelledby="by-category">
              <h2 id="by-category" className="mb-4 text-xl font-semibold">
                Where the money goes
              </h2>
              <ul className="grid gap-3">
                {cats.map((c) => (
                  <li
                    key={c.category}
                    className="grid grid-cols-[8rem_1fr_6rem] items-center gap-3 text-sm"
                  >
                    <span>{CATEGORY_LABEL[c.category]}</span>
                    <span
                      className="flex h-3 overflow-hidden rounded-full bg-muted"
                      aria-hidden="true"
                    >
                      <span
                        className="bg-primary"
                        style={{ width: `${(n(c.committed) / maxCat) * 100}%` }}
                      />
                      <span
                        className="bg-primary/40"
                        style={{ width: `${(n(c.ideas) / maxCat) * 100}%` }}
                      />
                      <span
                        className="bg-travel"
                        style={{
                          width: `${(n(c.spent_unplanned) / maxCat) * 100}%`,
                        }}
                      />
                    </span>
                    <span className="text-right font-medium">
                      {formatMoney(c.total, cur)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-primary" />
                  Booked
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-primary/40" />
                  Ideas
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-travel" />
                  Spent outside the plan
                </span>
              </p>
            </section>
          )}

          <section aria-labelledby="planned">
            <h2 id="planned" className="mb-1 text-xl font-semibold">
              Everything priced in the plan
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Added automatically from your itinerary, flights and stays.
            </p>
            {!planned.data?.length ? (
              <p className="rounded-xl border border-dashed bg-card p-6 text-muted-foreground">
                Nothing priced yet. Add an activity, flight or stay and its
                price lands here.
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
                        <span className="block text-xs text-muted-foreground">
                          {SOURCE[p.source]}
                        </span>
                      </td>
                      <td className="py-2.5 max-sm:hidden">
                        {formatDay(p.on_date)}
                      </td>
                      <td className="py-2.5">{STATUS[p.booking_status]}</td>
                      <td className="py-2.5 text-right">
                        {formatMoney(p.cost_in_trip_currency, cur)}
                        {p.currency &&
                          p.currency !== cur &&
                          p.cost !== null && (
                            <span className="block text-xs text-muted-foreground">
                              {formatMoney(p.cost, p.currency)}
                            </span>
                          )}
                        {p.points_used !== null && (
                          <span className="block text-xs text-muted-foreground">
                            + {formatPoints(p.points_used)} pts
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="pt-3 font-medium max-sm:hidden">
                      Planned total
                    </td>
                    <td colSpan={2} className="pt-3 font-medium sm:hidden">
                      Planned total
                    </td>
                    <td className="pt-3 text-right font-display text-lg font-semibold">
                      {formatMoney(budget?.planned_total, cur)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </section>
        </div>

        <aside className="grid gap-6">
          {group && (
            <section
              aria-labelledby="owes"
              className="rounded-xl border bg-card p-5"
            >
              <h3 id="owes" className="text-lg font-semibold">
                Who owes whom
              </h3>
              <p className="mb-3 text-sm text-muted-foreground">
                From what&rsquo;s logged under &ldquo;Spent so far&rdquo;, split
                as entered.
              </p>
              {balances.transfers.length === 0 ? (
                <p className="text-sm">Everyone&rsquo;s square.</p>
              ) : (
                <ul className="grid gap-3">
                  {balances.transfers.map((t) => (
                    <li
                      key={`${t.from}-${t.to}`}
                      className="grid gap-2 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <Avatar
                          name={name.get(t.from)}
                          url={photo.get(t.from)}
                          size={24}
                        />
                        <span className="font-medium">
                          {t.from === me ? "You" : name.get(t.from)}
                        </span>
                        <ArrowRight
                          className="size-3.5 text-muted-foreground"
                          aria-label="pays"
                        />
                        <Avatar
                          name={name.get(t.to)}
                          url={photo.get(t.to)}
                          size={24}
                        />
                        <span className="font-medium">
                          {t.to === me ? "you" : name.get(t.to)}
                        </span>
                        <span className="ml-auto font-display text-base font-semibold">
                          {formatMoney(t.amount, cur)}
                        </span>
                      </span>
                      {(t.from === me || t.to === me || canEdit) && (
                        <form
                          action={recordSettlement.bind(null, tripId)}
                          className="flex justify-end"
                        >
                          <input
                            type="hidden"
                            name="from_user"
                            value={t.from}
                          />
                          <input type="hidden" name="to_user" value={t.to} />
                          <input type="hidden" name="amount" value={t.amount} />
                          <input type="hidden" name="currency" value={cur} />
                          <Button type="submit" size="sm" variant="outline">
                            Mark as paid
                          </Button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {balances.skipped > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {balances.skipped} expense
                  {balances.skipped > 1 ? "s aren't" : " isn't"} counted until
                  we have that day&rsquo;s exchange rate.
                </p>
              )}
              {!!settlements.data?.length && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-muted-foreground">
                    Payments recorded ({settlements.data.length})
                  </summary>
                  <ul className="mt-2 grid gap-1.5">
                    {settlements.data.map((st) => (
                      <li key={st.id} className="flex items-center gap-2">
                        <span className="flex-1">
                          {name.get(st.from_user) ?? "Former member"} paid{" "}
                          {name.get(st.to_user) ?? "Former member"}{" "}
                          {formatMoney(st.amount, st.currency)}
                        </span>
                        {(st.created_by === me || canEdit) && (
                          <form
                            action={undoSettlement.bind(null, tripId, st.id)}
                          >
                            <Button
                              type="submit"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                            >
                              Undo
                            </Button>
                          </form>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </section>
          )}
          {canEdit && (
            <ExpenseForm
              tripId={tripId}
              currency={cur}
              currencies={(currencies.data ?? []).map((c) => c.code)}
              today={new Date().toISOString().slice(0, 10)}
              members={members.map((m) => ({
                user_id: m.user_id,
                name: m.name,
              }))}
              me={me}
            />
          )}
          <section aria-labelledby="spent">
            <h3 id="spent" className="mb-3 text-lg font-semibold">
              Spent so far
            </h3>
            {!expenses.data?.length ? (
              <p className="text-sm text-muted-foreground">
                Nothing logged yet.
              </p>
            ) : (
              <ul className="divide-y rounded-xl border bg-card">
                {expenses.data.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm"
                  >
                    <span className="flex-1">
                      <span className="block font-medium">{e.description}</span>
                      <span className="text-xs text-muted-foreground">
                        {CATEGORY_LABEL[e.category]}, {formatDay(e.incurred_on)}
                        {group && e.paid_by && (
                          <>
                            {" · "}paid by{" "}
                            {e.paid_by === me
                              ? "you"
                              : name.get(e.paid_by) ?? "a former member"}
                            {partsByExpense.get(e.id)?.length
                              ? `, split ${
                                  partsByExpense.get(e.id)!.length
                                } ways`
                              : ", split by everyone"}
                          </>
                        )}
                      </span>
                    </span>
                    <span className="text-right">
                      {formatMoney(
                        e.amount_in_trip_currency ?? e.amount,
                        e.amount_in_trip_currency !== null ? cur : e.currency
                      )}
                      {e.currency !== cur && (
                        <span className="block text-xs text-muted-foreground">
                          {formatMoney(e.amount, e.currency)}
                        </span>
                      )}
                    </span>
                    {canEdit && (
                      <form action={deleteExpense.bind(null, tripId, e.id)}>
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Remove ${e.description}`}
                        >
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
