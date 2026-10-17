import { describe, expect, it } from "vitest";

import { computeBalances } from "./balances";
import { pointsAsExpenses, pointsWorth } from "./points-split";

const [A, B, C] = ["a", "b", "c"];

describe("fair split for points", () => {
  it("values points at the group's agreed rate, or the entry's own", () => {
    expect(pointsWorth({ points: 88_000, value_cents: null }, 1.3)).toBe(1144);
    expect(pointsWorth({ points: 60_000, value_cents: 1 }, 1.3)).toBe(600);
  });

  it("someone who booked with points is owed the others' share, like cash", () => {
    // A booked 3 flights with 90,000 miles at 1.2¢ = $1,080 → B and C each owe A $360.
    const pts = pointsAsExpenses([{ id: "1", paid_by: A, points: 90_000, value_cents: null, split_with: [] }], 1.2, [A, B, C]);
    const r = computeBalances({ members: [A, B, C], expenses: pts.expenses, participants: pts.participants, settlements: [] });
    expect(r.transfers.sort((x, y) => x.from.localeCompare(y.from))).toEqual([
      { from: B, to: A, amount: 360 },
      { from: C, to: A, amount: 360 },
    ]);
  });

  it("nets points against cash: B paid the $600 hotel in cash, A paid flights in points", () => {
    const pts = pointsAsExpenses([{ id: "1", paid_by: A, points: 60_000, value_cents: null, split_with: [A, B] }], 1, [A, B]);
    const r = computeBalances({
      members: [A, B],
      expenses: [...pts.expenses, { id: "hotel", paid_by: B, amount_in_trip_currency: 600 }],
      participants: pts.participants,
      settlements: [],
    });
    // Each owes half of $600 (points) and half of $600 (cash): even.
    expect(r.transfers).toEqual([]);
  });

  it("only splits between the people chosen, and ignores people no longer on the trip", () => {
    const pts = pointsAsExpenses([{ id: "1", paid_by: A, points: 50_000, value_cents: 1, split_with: [A, B, "gone"] }], 1, [A, B, C]);
    expect(pts.participants.get("points:1")).toEqual([A, B]);
  });
});
