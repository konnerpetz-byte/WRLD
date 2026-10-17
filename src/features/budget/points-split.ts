/**
 * Fair split for points. When one person books with points or miles for the group, the group agrees
 * what a point is worth (the trip's value, in cents of the trip currency) and the booking counts as if
 * they'd paid that much in cash: the others owe them their share, settled with everything else.
 * Points never enter the cash budget; they only feed who-owes-whom.
 */
import type { BalanceExpense } from "./balances";

export type PointsEntry = {
  id: string;
  paid_by: string | null;
  points: number;
  /** Cents per point for this entry; null uses the trip's agreed value */
  value_cents: number | null;
  /** Who shares it; empty = everyone */
  split_with: string[];
};

/** Common starting points for the group's conversation, in cents per point. */
export const POINT_VALUE_PRESETS = [
  { cents: 1, label: "1¢", note: "Simple and easy to agree on. What most bank points get in a travel portal." },
  { cents: 1.3, label: "1.3¢", note: "Middle ground. Close to what bank points usually get when moved to airline partners." },
  { cents: 1.5, label: "1.5¢", note: "Generous to whoever booked. Fits business class or a great redemption." },
] as const;

/** What an entry is worth in the trip currency. */
export const pointsWorth = (e: Pick<PointsEntry, "points" | "value_cents">, tripCents: number) =>
  Math.round(e.points * (e.value_cents ?? tripCents)) / 100;

/** Points entries as expenses for computeBalances, plus who shares each one. */
export function pointsAsExpenses(entries: PointsEntry[], tripCents: number, members: string[]) {
  const expenses: BalanceExpense[] = [];
  const participants = new Map<string, string[]>();
  for (const e of entries) {
    const id = `points:${e.id}`;
    expenses.push({ id, paid_by: e.paid_by, amount_in_trip_currency: pointsWorth(e, tripCents) });
    const sharing = e.split_with.filter((u) => members.includes(u));
    if (sharing.length) participants.set(id, sharing);
  }
  return { expenses, participants };
}
