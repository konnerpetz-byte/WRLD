/**
 * Who owes whom, Splitwise-style.
 *
 * Each expense is split equally between its participants (everyone on the
 * trip when none are chosen). The payer is owed the others' shares.
 * Payments recorded between people ("settlements") cancel debts.
 * Amounts are in the trip currency; expenses without an exchange rate yet
 * are left out and counted in `skipped`.
 */

export type BalanceExpense = {
  id: string;
  paid_by: string | null;
  amount_in_trip_currency: number | null;
};
export type BalanceSettlement = { from_user: string; to_user: string; amount: number };
export type Transfer = { from: string; to: string; amount: number };

const cents = (n: number) => Math.round(n * 100);

export function computeBalances(input: {
  members: string[];
  expenses: BalanceExpense[];
  participants: Map<string, string[]>;
  settlements: BalanceSettlement[];
}) {
  const net = new Map<string, number>(input.members.map((m) => [m, 0])); // in cents; + is owed money
  let skipped = 0;
  const add = (who: string, c: number) => net.set(who, (net.get(who) ?? 0) + c);

  for (const e of input.expenses) {
    if (!e.paid_by) continue; // paid by someone who has left
    if (e.amount_in_trip_currency === null) {
      skipped++;
      continue;
    }
    const people = input.participants.get(e.id)?.length ? input.participants.get(e.id)! : input.members;
    if (!people.length) continue;
    const total = cents(Number(e.amount_in_trip_currency));
    const share = Math.floor(total / people.length);
    let remainder = total - share * people.length; // spread leftover cents so totals match exactly
    add(e.paid_by, total);
    for (const p of people) {
      add(p, -(share + (remainder-- > 0 ? 1 : 0)));
    }
  }
  for (const s of input.settlements) {
    add(s.from_user, cents(Number(s.amount)));
    add(s.to_user, -cents(Number(s.amount)));
  }

  // Fewest payments: largest debtor pays largest creditor, repeat.
  const debtors = [...net].filter(([, c]) => c < 0).map(([id, c]) => ({ id, c: -c })).sort((a, b) => b.c - a.c);
  const creditors = [...net].filter(([, c]) => c > 0).map(([id, c]) => ({ id, c })).sort((a, b) => b.c - a.c);
  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].c, creditors[j].c);
    if (pay > 0) transfers.push({ from: debtors[i].id, to: creditors[j].id, amount: pay / 100 });
    debtors[i].c -= pay;
    creditors[j].c -= pay;
    if (debtors[i].c === 0) i++;
    if (creditors[j].c === 0) j++;
  }

  return {
    net: new Map([...net].map(([k, v]) => [k, v / 100])),
    transfers,
    skipped,
  };
}
