import "server-only";

import { datesIn } from "@/features/import/parse";

/** "date … points" pairs from text copied off an airline's results calendar or list. */
export function seatsFromText(text: string, now = new Date()): { date: string; miles: number }[] {
  const year = now.getUTCFullYear();
  const today = now.toISOString().slice(0, 10);
  // Dates without a year: assume the next occurrence.
  const dates = datesIn(text, year).map((d) => (d.value < today ? { ...d, value: `${Number(d.value.slice(0, 4)) + 1}${d.value.slice(4)}` } : d));
  const amounts: { index: number; miles: number }[] = [];
  const re = /(\d{1,3}(?:[,.  ]\d{3})+|\d+(?:\.\d+)?\s?[kK])\s*(?:miles|mi\b|pts|points|avios)?/g;
  for (const m of text.matchAll(re)) {
    // Cash prices ("$1,234", "€ 120") aren't points.
    if (/[$€£¥]\s*$/.test(text.slice(Math.max(0, m.index! - 3), m.index!))) continue;
    const raw = m[1].replace(/[,  ]/g, "");
    const hasUnit = /[kK]$/.test(raw) || /miles|mi\b|pts|points|avios/i.test(m[0]);
    if (!hasUnit && !/[,.  ]\d{3}$/.test(m[1])) continue;
    const miles = /[kK]$/.test(raw) ? Math.round(parseFloat(raw) * 1000) : Number(raw.replace(/\./g, ""));
    if (miles >= 1000 && miles <= 1000000) amounts.push({ index: m.index!, miles });
  }
  // Each date takes the cheapest amount between it and the next date.
  const rows: { date: string; miles: number }[] = [];
  dates.forEach((d, i) => {
    const end = dates[i + 1]?.index ?? text.length;
    const inRange = amounts.filter((a) => a.index > d.index && a.index < end);
    if (!inRange.length) return;
    const miles = Math.min(...inRange.map((a) => a.miles));
    if (!rows.some((r) => r.date === d.value)) rows.push({ date: d.value, miles });
  });
  return rows.filter((r) => r.date >= today).slice(0, 31);
}
