/**
 * WRLD shows every price in U.S. dollars. Amounts stored in another currency
 * (a hotel in euros, a tour in pounds) are converted for display with the
 * day's exchange rates: units of each currency per 1 USD.
 *
 * The live rates (European Central Bank, via Frankfurter, refreshed hourly)
 * are set by the root layout on the server and in the browser; this snapshot
 * (ECB, Oct 13, 2026) is only used until they arrive.
 */
const SNAPSHOT: Record<string, number> = {
  USD: 1, EUR: 0.89381, GBP: 0.75492, CAD: 1.4241, AUD: 1.4331, NZD: 1.7815, JPY: 158.12, CHF: 0.83232, MXN: 18.3348,
  BRL: 5.0165, CNY: 6.6938, HKD: 7.8479, SGD: 1.2799, THB: 33.59, KRW: 1341.45, INR: 95.28, IDR: 17881, MYR: 4.086, PHP: 62.768,
  SEK: 9.9837, NOK: 9.5357, DKK: 6.6815, ISK: 121.74, PLN: 3.912, CZK: 21.78, HUF: 325.63, TRY: 49.367, ILS: 3.0751, ZAR: 16.4963,
};

let rates: Record<string, number> = SNAPSHOT;

/** Replaces the rates used for display (units per 1 USD). Ignores anything that isn't a sane table. */
export function setUsdRates(next: Record<string, number> | null | undefined) {
  if (!next || !(next.EUR > 0)) return;
  rates = { ...SNAPSHOT, ...next, USD: 1 };
}

/** The amount in U.S. dollars, or null when the currency has no rate. */
export function toUsd(amount: number, currency: string | null | undefined): number | null {
  const code = (currency ?? "USD").toUpperCase();
  if (code === "USD") return amount;
  const r = rates[code];
  return r > 0 ? amount / r : null;
}
