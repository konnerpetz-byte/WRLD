/**
 * What a point is typically worth when used well, in cents, by program.
 * The Points Guy monthly valuations, October 2026 (published Oct 1, 2026):
 * thepointsguy.com/loyalty-programs/monthly-valuations. NerdWallet's 2026
 * medians agree on Delta and United (1.2); they put American higher (1.7)
 * and Southwest higher (1.4). Avios (British Airways, Iberia, Aer Lingus,
 * Qatar) share one value. Re-check quarterly.
 *
 * The floor for every bank point is 1 cent: that's what Chase, Amex, Capital
 * One and Citi travel sites pay for any seat. Below it, cash (or the travel
 * site) wins.
 */
export const TYPICAL_CENTS: Record<string, number> = {
  aeroplan: 1.5,
  alaska: 1.55,
  american: 1.45,
  ana: 1.4,
  lifemiles: 1.6,
  british: 1.4,
  iberia: 1.4,
  aerlingus: 1.4,
  qatar: 1.4,
  cathay: 1.3,
  delta: 1.2,
  emirates: 1.2,
  etihad: 1.2,
  flyingblue: 1.4,
  frontier: 1.3,
  jetblue: 1.35,
  qantas: 1.25,
  singapore: 1.3,
  southwest: 1.25,
  turkish: 1.1,
  united: 1.2,
  virginatlantic: 1.5,
  aeromexico: 0.8,
};

export const VALUES_CHECKED = "October 2026";

export type Verdict = "great" | "good" | "ok" | "cash";

/**
 * Points or cash for one flight, from the two prices the traveler sees.
 * cents = what each point is worth here: (cash fare − taxes on the award) ÷ points.
 */
export function judge(input: { cash: number; points: number; taxes: number; program?: string | null }) {
  const { cash, points, taxes } = input;
  if (!(cash > 0) || !(points > 0) || taxes < 0) return null;
  const cents = ((cash - taxes) / points) * 100;
  const typical = (input.program && TYPICAL_CENTS[input.program]) || null;
  // Saving against paying cash, counting each point at the 1 cent a card travel site gives.
  const saves = cash - (points / 100 + taxes);
  const verdict: Verdict = cents < 1 ? "cash" : typical && cents >= typical * 1.25 ? "great" : typical && cents >= typical ? "good" : cents >= 1.3 ? "good" : "ok";
  return { cents: Math.round(cents * 100) / 100, typical, saves: Math.round(saves), verdict };
}
