import { distanceKm } from "@/lib/geo";

import type { Cabin } from "./regions";

/**
 * The cash part of an award ticket: what you pay on top of the points.
 *
 * Three parts, each from a published source:
 *   1. Government taxes the departure (and, for the U.S., arrival) country
 *      charges per passenger. Exact where the law sets one amount per ticket.
 *   2. Airport charges, which every airport sets for itself. Shown as a range.
 *   3. Program fees and carrier surcharges ("fuel surcharges"), which depend on
 *      the mileage program and the airline flying the trip.
 *
 * All amounts are one way, one adult. Re-check each source when it changes;
 * the dates below are when WRLD last checked.
 */

type Place = { code: string; country: string; latitude: number; longitude: number };

export type FeeLine = { label: string; low: number; high: number; note?: string };
export type Surcharge = { level: "none" | "some" | "high" | "unknown"; text: string };
export type FeeEstimate = {
  /** Total in USD, as a range (airport charges vary). */
  low: number;
  high: number;
  lines: FeeLine[];
  surcharge: Surcharge;
  /** Surcharges can add more on top of low/high. */
  plusSurcharges: boolean;
};

/** Converts an amount in a currency to USD. `rates` is "1 USD = rate × currency". */
export type Fx = (amount: number, currency: string) => number;
export function fxFrom(rates: Map<string, number>): Fx {
  // Fallbacks (October 2026) only if the daily rates haven't loaded.
  const fallback: Record<string, number> = { USD: 1, EUR: 0.89, GBP: 0.75, CAD: 1.42 };
  return (amount, currency) => {
    const rate = rates.get(currency) ?? fallback[currency];
    return rate ? amount / rate : amount;
  };
}

const KM_PER_MILE = 1.609344;
const EU_EEA_CH = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL",
  "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO", "CH",
]);
const premium = (c: Cabin) => c === "business" || c === "first";

// ---------------------------------------------------------------- 1. Government taxes
// U.S.: Delta's taxes page (checked 2026-10-13), amounts set by U.S. law.
const US = { intl: 23.4, sept11: 5.6, pfc: 4.5, aphis: 3.83, customs: 6.97, immigration: 7.0 };

function departureTaxes(o: Place, d: Place, cabin: Cabin, fx: Fx): FeeLine[] {
  const km = distanceKm(o, d);
  const miles = km / KM_PER_MILE;
  const out: FeeLine[] = [];
  switch (o.country) {
    case "US":
    case "PR":
      if (d.country === "US" || d.country === "PR") {
        out.push({ label: "U.S. September 11th Security Fee", low: US.sept11, high: US.sept11 });
      } else {
        out.push({ label: "U.S. international departure tax", low: US.intl, high: US.intl });
        out.push({ label: "U.S. September 11th Security Fee", low: US.sept11, high: US.sept11 });
      }
      out.push({ label: `${o.code} passenger facility charge`, low: 0, high: US.pfc, note: "Up to $4.50, if the airport charges it" });
      break;
    case "GB": {
      // Air Passenger Duty from April 1, 2026 (One Mile at a Time, checked 2026-10-13).
      // Bands by distance; "premium" = premium economy, business and first.
      const band = miles <= 2000 ? [15, 32] : miles <= 5500 ? [102, 244] : [106, 253];
      const econ = fx(band[0], "GBP");
      const prem = fx(band[1], "GBP");
      const low = cabin === "economy" ? econ : prem;
      out.push({ label: "UK Air Passenger Duty", low, high: low, note: `£${cabin === "economy" ? band[0] : band[1]}` });
      break;
    }
    case "FR": {
      // Solidarity tax on airline tickets (TSBA), rates from March 1, 2025 (French government notice, 2026).
      const band = EU_EEA_CH.has(d.country) || km < 1000 ? [7.4, 30] : km <= 5500 ? [15, 80] : [40, 120];
      const lo = fx(band[0], "EUR");
      const hi = fx(band[1], "EUR");
      // Premium economy counts as "additional services" only on some airlines.
      const [low, high] = cabin === "economy" ? [lo, lo] : premium(cabin) ? [hi, hi] : [lo, hi];
      out.push({ label: "France solidarity tax", low, high });
      break;
    }
    case "DE": {
      // Air transport tax from July 1, 2026 (Haufe / Bundesrat June 2026). Class by distance.
      const eur = km <= 2500 ? 13.03 : km <= 6000 ? 33.01 : 59.43;
      out.push({ label: "German air transport tax", low: fx(eur, "EUR"), high: fx(eur, "EUR") });
      break;
    }
    case "NL":
      // Vliegbelasting 2026 (Belastingdienst).
      out.push({ label: "Dutch air passenger tax", low: fx(30.25, "EUR"), high: fx(30.25, "EUR") });
      break;
  }
  // Arriving in the U.S. from abroad.
  if ((d.country === "US" || d.country === "PR") && o.country !== "US" && o.country !== "PR") {
    const total = US.intl + US.aphis + US.customs + US.immigration;
    out.push({ label: "U.S. arrival taxes and inspection fees", low: total, high: total, note: "Arrival tax, customs, immigration, agriculture" });
  }
  return out;
}

// ---------------------------------------------------------------- 2. Airport charges
// Set by each airport and not published in one place, so these are WRLD's own
// estimate ranges, shown as a range and labeled as an estimate. Traveler
// reports with the real total replace them where they exist.
function airportCharges(o: Place): FeeLine {
  if (o.country === "US" || o.country === "PR") return { label: "Other airport charges", low: 0, high: 10 };
  if (o.country === "GB") return { label: `${o.code} airport charges`, low: 35, high: 110, note: "Set by the airport; varies" };
  if (EU_EEA_CH.has(o.country)) return { label: `${o.code} airport charges`, low: 15, high: 75, note: "Set by the airport; varies" };
  return { label: `${o.code} airport and government charges`, low: 15, high: 90, note: "Varies by country and airport" };
}

// ---------------------------------------------------------------- 3. Program fees and surcharges
// Carrier surcharges by program: The Points Guy, "How to avoid fuel surcharges"
// (updated June 2026). Aeroplan partner booking fee: Frequent Miler Aeroplan guide (2026).
const has = (airlines: string[], re: RegExp) => airlines.some((a) => re.test(a));

function programFees(source: string, o: Place, airlines: string[], fx: Fx): { lines: FeeLine[]; surcharge: Surcharge } {
  const europe = EU_EEA_CH.has(o.country) || o.country === "GB";
  switch (source) {
    case "aeroplan": {
      const partner = !airlines.length || has(airlines, /^(?!air canada)/i);
      const fee = fx(39, "CAD");
      return {
        lines: partner ? [{ label: "Aeroplan partner booking fee", low: fee, high: fee, note: "CA$39 when a partner airline flies any part" }] : [],
        surcharge: { level: "none", text: "Aeroplan doesn't add fuel surcharges." },
      };
    }
    case "united":
      return { lines: [], surcharge: { level: "none", text: "United doesn't add fuel surcharges on any award." } };
    case "jetblue":
      return { lines: [], surcharge: { level: "none", text: "JetBlue doesn't add fuel surcharges." } };
    case "lifemiles":
      return { lines: [], surcharge: { level: "none", text: "LifeMiles doesn't add fuel surcharges." } };
    case "american":
      return airlines.length && !has(airlines, /british airways|iberia/i)
        ? { lines: [], surcharge: { level: "none", text: "No fuel surcharges on this airline with AAdvantage." } }
        : { lines: [], surcharge: { level: "some", text: "AAdvantage adds fuel surcharges on British Airways and Iberia flights." } };
    case "alaska":
      return has(airlines, /british airways|icelandair/i) || !airlines.length
        ? { lines: [], surcharge: { level: "some", text: "Alaska adds fuel surcharges on British Airways and Icelandair flights." } }
        : { lines: [], surcharge: { level: "none", text: "No fuel surcharges on this airline with Alaska." } };
    case "delta":
      return europe
        ? { lines: [], surcharge: { level: "some", text: "Delta adds carrier surcharges on Delta, Air France-KLM and Virgin Atlantic flights leaving Europe." } }
        : { lines: [], surcharge: { level: "some", text: "Delta adds carrier surcharges on some SkyTeam partners." } };
    case "british":
      return { lines: [], surcharge: { level: "high", text: "British Airways adds carrier surcharges on its own flights, often hundreds of dollars. Paying more Avios can lower them." } };
    case "flyingblue":
      return { lines: [], surcharge: { level: "high", text: "Flying Blue adds carrier surcharges on most flights (not Delta or Aeroméxico), highest leaving Europe." } };
    case "virginatlantic":
      return { lines: [], surcharge: { level: "high", text: "Virgin Atlantic adds large surcharges on Virgin Atlantic and Delta flights; smaller on Air France-KLM." } };
    case "emirates":
      return { lines: [], surcharge: { level: "high", text: "Emirates adds large surcharges in every cabin." } };
    case "singapore":
      return { lines: [], surcharge: { level: "some", text: "KrisFlyer adds surcharges on partner airlines, not on Singapore Airlines." } };
    default:
      return { lines: [], surcharge: { level: "unknown", text: "This program may add carrier surcharges. Check the total before you book." } };
  }
}

/** Estimated cash for one award, one way, one adult, in USD. */
export function estimateFees(input: {
  origin: Place;
  destination: Place;
  /** Connection, if any: its departure taxes apply too (U.S. security fee per U.S. departure). */
  via?: Place | null;
  cabin: Cabin;
  source: string;
  airlines?: string[];
  fx: Fx;
}): FeeEstimate {
  const { origin: o, destination: d, via, cabin, fx } = input;
  const lines = [...departureTaxes(o, d, cabin, fx)];
  if (via && (via.country === "US" || via.country === "PR") && via.code !== o.code) {
    lines.push({ label: `U.S. September 11th Security Fee (${via.code})`, low: US.sept11, high: US.sept11 });
  }
  lines.push(airportCharges(o));
  const p = programFees(input.source, o, input.airlines ?? [], fx);
  lines.push(...p.lines);
  const round = (n: number) => Math.round(n);
  const low = round(lines.reduce((s, l) => s + l.low, 0));
  const high = round(lines.reduce((s, l) => s + l.high, 0));
  return { low, high, lines: lines.map((l) => ({ ...l, low: round(l.low), high: round(l.high) })), surcharge: p.surcharge, plusSurcharges: p.surcharge.level !== "none" };
}

/** "$58–$95", "$41". */
export function feeRange(low: number, high: number) {
  return low === high ? `$${low}` : `$${low}–$${high}`;
}
