import "server-only";

import { datesIn } from "@/features/import/parse";

export type PastedSeat = { date: string; miles: number; taxes?: number; taxCurrency?: string };

const CASH_RE = /(US\$|USD|CA\$|C\$|CAD|A\$|AUD|€|EUR|£|GBP|\$)\s?(\d{1,3}(?:,\d{3}){0,2}(?:\.\d{1,2})?|\d{1,6}(?:\.\d{1,2})?)(?!\d)/g;
const CASH_CODE: Record<string, string> = { US$: "USD", USD: "USD", $: "USD", CA$: "CAD", C$: "CAD", CAD: "CAD", A$: "AUD", AUD: "AUD", "€": "EUR", EUR: "EUR", "£": "GBP", GBP: "GBP" };

/**
 * "date … points (+ taxes)" from text copied off an airline's results calendar
 * or list. The cash amount right after a points price is its taxes and fees.
 */
export function seatsFromText(text: string, now = new Date(), fallbackDate?: string | null): PastedSeat[] {
  const year = now.getUTCFullYear();
  const today = now.toISOString().slice(0, 10);
  // Dates without a year: assume the next occurrence.
  const dates = datesIn(text, year).map((d) => (d.value < today ? { ...d, value: `${Number(d.value.slice(0, 4)) + 1}${d.value.slice(4)}` } : d));
  const amounts: { index: number; miles: number }[] = [];
  // Starts only at the beginning of a number, with bounded digit runs, so long digit strings stay fast.
  const re = /(?<![\d.,])(\d{1,3}(?:[,.  ]\d{3}){1,3}|\d{1,4}(?:\.\d{1,2})?\s?[kK])(?!\d)\s*(?:miles|mi\b|pts|points|avios)?/g;
  for (const m of text.matchAll(re)) {
    // Cash prices ("$1,234", "€ 120") aren't points.
    if (/[$€£¥]\s*$/.test(text.slice(Math.max(0, m.index! - 3), m.index!))) continue;
    const raw = m[1].replace(/[,  ]/g, "");
    const hasUnit = /[kK]$/.test(raw) || /miles|mi\b|pts|points|avios/i.test(m[0]);
    if (!hasUnit && !/[,.  ]\d{3}$/.test(m[1])) continue;
    const miles = /[kK]$/.test(raw) ? Math.round(parseFloat(raw) * 1000) : Number(raw.replace(/\./g, ""));
    if (miles >= 1000 && miles <= 1000000) amounts.push({ index: m.index!, miles });
  }
  const cash = [...text.matchAll(CASH_RE)].map((m) => ({ index: m.index!, amount: Number(m[2].replace(/,/g, "")), currency: CASH_CODE[m[1]] }));
  const rows: PastedSeat[] = [];
  const feeAfter = (index: number, limit: number) => cash.find((c) => c.index > index && c.index < limit && c.index - index < 60);
  // Calendar strips (Delta, Air France and others): a row of dates, then a row
  // of prices in the same order. Pair them by position.
  const used = new Set<number>();
  for (let i = 0; i < dates.length; ) {
    let j = i;
    while (j + 1 < dates.length && !amounts.some((a) => a.index > dates[j].index && a.index < dates[j + 1].index)) j++;
    const run = dates.slice(i, j + 1);
    if (run.length >= 3) {
      const after = amounts.filter((a) => a.index > run[run.length - 1].index && a.index < (dates[j + 1]?.index ?? text.length)).slice(0, run.length);
      if (after.length === run.length) {
        run.forEach((d, k) => {
          used.add(i + k);
          if (rows.some((r) => r.date === d.value)) return;
          const fee = feeAfter(after[k].index, after[k + 1]?.index ?? text.length);
          rows.push(fee && fee.amount <= 5000 ? { date: d.value, miles: after[k].miles, taxes: fee.amount, taxCurrency: fee.currency } : { date: d.value, miles: after[k].miles });
        });
      }
    }
    i = j + 1;
  }
  // Otherwise each date takes the cheapest amount between it and the next date, with the cash right after it.
  dates.forEach((d, i) => {
    if (used.has(i)) return;
    const end = dates[i + 1]?.index ?? text.length;
    const inRange = amounts.filter((a) => a.index > d.index && a.index < end);
    if (!inRange.length) return;
    const best = inRange.reduce((a, b) => (b.miles < a.miles ? b : a));
    const nextAmount = amounts.find((a) => a.index > best.index)?.index ?? end;
    const fee = cash.find((c) => c.index > best.index && c.index < Math.min(nextAmount, end) && c.index - best.index < 60);
    if (rows.some((r) => r.date === d.value)) return;
    rows.push(fee && fee.amount <= 5000 ? { date: d.value, miles: best.miles, taxes: fee.amount, taxCurrency: fee.currency } : { date: d.value, miles: best.miles });
  });
  // A results list for one day (the date is in the page address, not the text):
  // the cheapest award on the page, with its taxes.
  if (!rows.length && fallbackDate && /^\d{4}-\d{2}-\d{2}$/.test(fallbackDate) && amounts.length) {
    const best = amounts.reduce((a, b) => (b.miles < a.miles ? b : a));
    const nextAmount = amounts.find((a) => a.index > best.index)?.index ?? text.length;
    const fee = cash.find((c) => c.index > best.index && c.index < nextAmount && c.index - best.index < 60);
    rows.push(fee && fee.amount <= 5000 ? { date: fallbackDate, miles: best.miles, taxes: fee.amount, taxCurrency: fee.currency } : { date: fallbackDate, miles: best.miles });
  }
  return rows.filter((r) => r.date >= today).slice(0, 31);
}
