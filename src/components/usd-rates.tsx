"use client";

import { setUsdRates } from "@/lib/currency";

/**
 * Hands the server's exchange rates to the browser before anything below it
 * renders, so prices convert to USD the same way on both sides.
 */
export function UsdRates({ rates }: { rates: Record<string, number> | null }) {
  setUsdRates(rates);
  return null;
}
