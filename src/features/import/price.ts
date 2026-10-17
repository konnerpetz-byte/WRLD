/**
 * The total a confirmation says was paid: "Total: 291,00 EUR", "Grand total $1,234.56",
 * "Price (for 2 guests) … € 260.98", or an award booking's "88,000 miles + 129.46 USD".
 * Only labeled totals count (never "per passenger", "per night" or a subtotal), and an
 * "approx." conversion is skipped when the real amount is printed too.
 */
export type Price = { amount: number | null; currency: string | null; points: number | null };

const CODES =
  "USD|EUR|GBP|CAD|AUD|NZD|CHF|JPY|CNY|HKD|SGD|KRW|INR|THB|MXN|BRL|ARS|CLP|COP|PEN|SEK|NOK|DKK|ISK|PLN|CZK|HUF|RON|BGN|TRY|AED|SAR|QAR|ILS|EGP|MAD|ZAR|IDR|MYR|PHP|VND|TWD";
const SYMBOL: [RegExp, string][] = [
  [/^(?:US\$|U\.S\.\s?\$)$/i, "USD"],
  [/^(?:C\$|CA\$|CAN\$)$/i, "CAD"],
  [/^(?:A\$|AU\$)$/i, "AUD"],
  [/^NZ\$$/i, "NZD"],
  [/^\$$/, "USD"],
  [/^€$/, "EUR"],
  [/^£$/, "GBP"],
  [/^[¥￥]$/, "JPY"],
  [/^₹$/, "INR"],
  [/^₩$/, "KRW"],
  [/^Fr\.?$|^SFr\.?$/i, "CHF"],
];
const CUR = `(?:${CODES}|US\\$|U\\.S\\.\\s?\\$|C\\$|CA\\$|CAN\\$|A\\$|AU\\$|NZ\\$|\\$|€|£|¥|￥|₹|₩)`;
const NUM = `\\d{1,3}(?:[.,\\s ]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?`;
const MONEY = new RegExp(`(${CUR})\\s?(${NUM})(?!\\d)|(?<![\\d.,])(${NUM})\\s?(${CUR})(?![A-Za-z])`, "g");

const currencyOf = (token: string) => {
  const t = token.trim();
  if (new RegExp(`^(?:${CODES})$`).test(t)) return t;
  return SYMBOL.find(([re]) => re.test(t))?.[1] ?? null;
};

/** "1.234,56" → 1234.56; "291,00" → 291; "1,234" → 1234; "129.46" → 129.46. */
export function parseAmount(raw: string): number | null {
  const s = raw.replace(/[\s ]/g, "");
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let n: string;
  if (lastComma >= 0 && lastDot >= 0) n = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (lastComma >= 0) n = /,\d{1,2}$/.test(s) ? s.replace(/,(?=\d{3}\b)/g, "").replace(/,(\d{1,2})$/, ".$1") : s.replace(/,/g, "");
  // "1.234" (European thousands) vs "260.98" (decimals)
  else if (lastDot >= 0) n = /\.\d{3}$/.test(s) ? s.replace(/\./g, "") : s;
  else n = s;
  const v = Number(n);
  return Number.isFinite(v) && v > 0 && v < 1_000_000 ? Math.round(v * 100) / 100 : null;
}

/** PDFs that repeat text ("Total:Total:Total:", "129.4688,000 miles + 129.46…") collapse to one copy. */
// Only repeats with letters in them, so digits ("100000") are never touched.
const collapse = (line: string) => line.replace(/(.{3,}?)\1+/g, (all, unit: string) => (/[A-Za-z]/.test(unit) ? unit : all));

const TOTAL = /\b(grand total|total (?:price|cost|paid|amount|due|charged|for (?:the |your )?(?:stay|trip|booking))|booking total|amount (?:paid|charged|due)|you paid|total)\b/i;
const PRICE = /^\s*(price|prix|preis|precio|prezzo)\b/i;
const NOT_TOTAL = /\b(per (?:passenger|person|traveller|traveler|adult|night|room|day)|sub-?total|before tax|deposit|per pax|each)\b/i;
const APPROX = /\b(approx\.?|approximately|about|ca\.)\s*$|~\s*$/i;

function moneyIn(chunk: string): { amount: number; currency: string | null; approx: boolean }[] {
  const out: { amount: number; currency: string | null; approx: boolean }[] = [];
  for (const m of chunk.matchAll(MONEY)) {
    const amount = parseAmount(m[2] ?? m[3]);
    if (amount == null) continue;
    out.push({ amount, currency: currencyOf(m[1] ?? m[4]), approx: APPROX.test(chunk.slice(Math.max(0, m.index! - 14), m.index!)) });
  }
  return out;
}

export function priceIn(text: string): Price | null {
  const lines = text.split(/\n/).map((l) => collapse(l.trim()));
  type Found = { price: Price; rank: number; at: number };
  const found: Found[] = [];
  lines.forEach((line, i) => {
    const total = TOTAL.exec(line);
    const price = PRICE.test(line);
    if ((!total && !price) || NOT_TOTAL.test(line)) return;
    // The amount after the label, on its line or within the next three (a heading over its value).
    const after = total ? line.slice(total.index + total[0].length) : line;
    const look = [after, ...lines.slice(i + 1, i + 4).filter((l) => !TOTAL.test(l) && !NOT_TOTAL.test(l))].join("\n");
    const points = /(\d{1,3}(?:,\d{3})+|\d{4,7})\s*(?:miles|points|pts|avios|meilen)\b/i.exec(look);
    const money = moneyIn(look);
    // A cash amount with its currency on the next line ("129.46\nUSD").
    if (!money.length) {
      const m = new RegExp(`(?<![\\d.,])(${NUM})\\s*\\n\\s*(${CODES})\\b`).exec(look);
      const amount = m ? parseAmount(m[1]) : null;
      if (m && amount) money.push({ amount, currency: m[2], approx: false });
    }
    // A miles-only amount isn't cash: "88,000 miles + 129.46 USD" → cash 129.46, points 88,000.
    const pick = money.filter((x) => !x.approx).at(points ? -1 : 0) ?? money.at(-1);
    if (!pick && !points) return;
    found.push({
      price: { amount: pick?.amount ?? null, currency: pick?.currency ?? null, points: points ? Number(points[1].replace(/,/g, "")) : null },
      rank: total ? (/grand|amount paid|you paid|booking total/i.test(total[0]) ? 3 : 2) : 1,
      at: i,
    });
  });
  if (!found.length) return null;
  // The strongest label wins; among equals, the last one (totals come after line items).
  found.sort((a, b) => b.rank - a.rank || b.at - a.at);
  return found[0].price;
}
