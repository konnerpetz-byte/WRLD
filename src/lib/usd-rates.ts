import "server-only";

import { cacheLife } from "next/cache";

/**
 * Today's rates per 1 USD from the European Central Bank (Frankfurter, free,
 * no key), cached for an hour. Null if it can't be reached; display then uses
 * the snapshot in currency.ts.
 */
export async function liveUsdRates(): Promise<Record<string, number> | null> {
  "use cache";
  cacheLife("hours");
  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?base=USD", { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const body = (await res.json()) as { rates?: Record<string, number> };
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(body.rates ?? {})) if (/^[A-Z]{3}$/.test(k) && Number.isFinite(v) && v > 0) out[k] = v;
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}
