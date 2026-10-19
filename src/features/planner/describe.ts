/**
 * "8 of us, August, under $6k, lake town, drive" → the planner's search, without an AI service.
 * A small set of plain-English patterns; anything it can't read is left as the form already has it.
 */
export type Described = {
  travelers?: number;
  cash?: number;
  per?: "group" | "person";
  month?: string;
  nights?: number;
  go?: "drive" | "fly";
  vibes?: string[];
  from?: string;
  to?: string;
};

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const SHORT = MONTHS.map((m) => m.slice(0, 3));
const WORD_NUM: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, couple: 2 };

const VIBE_WORDS: [RegExp, string][] = [
  [/\b(lakes?|beach(es)?|water|coast|ocean|shore|island|swim)/, "water"],
  [/\b(hik(e|es|ing)|outdoors?|nature|national parks?|camping|trails?|mountains?|kayak)/, "outdoors"],
  [/\b(histor(y|ic)|old town|charming)/, "historic"],
  [/\b(food|foodie|wine(ry|ries)?|brewer(y|ies)|eat(ing)?|restaurants?)/, "food"],
  [/\b(nightlife|bars?|party|partying|clubs?|music|bachelor(ette)?)/, "nightlife"],
  [/\b(museums?|art|culture|theat(er|re)s?)/, "culture"],
  [/\b(quiet|relax(ing)?|chill|small town|cozy|peaceful|cabin)/, "quiet"],
  [/\b(kids?|family|families|theme parks?|children)/, "family"],
  [/\b(ski(ing)?|snow(board(ing)?)?)/, "snow"],
  [/\b(big city|city break|downtown)/, "city"],
];

/** The next time that month comes around (this month counts), as "YYYY-MM". */
function nextMonth(index: number, now: Date, year?: number) {
  const y = year ?? (index < now.getUTCMonth() ? now.getUTCFullYear() + 1 : now.getUTCFullYear());
  return `${y}-${String(index + 1).padStart(2, "0")}`;
}

const amount = (n: string, k: string | undefined) => {
  const v = Number(n.replace(/,/g, ""));
  return Math.round(k ? v * 1000 : v);
};

export function describeTrip(text: string, now = new Date()): Described {
  const raw = text.trim();
  const t = raw.toLowerCase();
  const out: Described = {};

  // People: "8 of us", "6 friends", "a couple", "family of 5", "just me"
  const people =
    t.match(/\b(\d{1,2})\s*(?:of us|people|persons|friends|adults|travell?ers|guys|girls|ppl|pax|of my friends)\b/) ??
    t.match(/\b(?:group|family|party) of (\d{1,2})\b/) ??
    t.match(/\b(two|three|four|five|six|seven|eight|nine|ten)\s+(?:of us|people|friends|adults)\b/);
  if (people) out.travelers = Number(people[1]) || WORD_NUM[people[1]];
  else if (/\b(a couple|my (wife|husband|partner|girlfriend|boyfriend)|the two of us|both of us)\b/.test(t)) out.travelers = 2;
  else if (/\b(solo|just me|by myself|alone)\b/.test(t)) out.travelers = 1;
  if (out.travelers) out.travelers = Math.min(Math.max(out.travelers, 1), 8);

  // Budget: "$6,000", "6k", "$1.5k each", "under 900 per person"
  const money =
    t.match(/\$\s?(\d[\d,]*(?:\.\d+)?)\s*(k)?\b/) ??
    t.match(/\b(\d+(?:\.\d+)?)\s*(k)\b/) ??
    t.match(/\b(?:under|budget(?: of)?|max(?:imum)?|up to|around|about)\s+(\d[\d,]{2,})\b()/);
  if (money) {
    const v = amount(money[1], money[2] || undefined);
    if (v >= 50 && v <= 500000) out.cash = v;
  }
  if (out.cash) out.per = /\b(each|per person|a person|a head|per head|pp|apiece)\b/.test(t) ? "person" : "group";

  // When: "August", "aug 2027", "this weekend"
  const year = t.match(/\b(20\d\d)\b/);
  const m = MONTHS.findIndex((name, i) => new RegExp(`\\b(${name}|${SHORT[i]})\\b`).test(t));
  if (m >= 0) out.month = nextMonth(m, now, year ? Number(year[1]) : undefined);
  else if (/\bthis (weekend|month)\b/.test(t)) out.month = nextMonth(now.getUTCMonth(), now);
  else if (/\bnext month\b/.test(t)) out.month = nextMonth((now.getUTCMonth() + 1) % 12, now);

  // How long: "3 nights", "4 days", "long weekend", "a week"
  const nights = t.match(/\b(\d{1,2})\s*nights?\b/);
  const days = t.match(/\b(\d{1,2})\s*days?\b/);
  if (nights) out.nights = Number(nights[1]);
  else if (days) out.nights = Math.max(1, Number(days[1]) - 1);
  else if (/\blong weekend\b/.test(t)) out.nights = 3;
  else if (/\bweekend\b/.test(t)) out.nights = 2;
  else if (/\b(a|one) week\b/.test(t)) out.nights = 7;
  if (out.nights) out.nights = Math.min(Math.max(out.nights, 1), 30);

  // Getting there
  if (/\b(drive|driving|road ?trip|by car|drivable|within \d+ hours?)\b/.test(t)) out.go = "drive";
  else if (/\b(fly|flying|flight|flights|plane)\b/.test(t)) out.go = "fly";

  // Places: "from Detroit", "to Torch Lake" (capitalized place names)
  const from = raw.match(/\bfrom\s+([A-Z][\w'.-]*(?:\s+[A-Z][\w'.-]*)*(?:,\s*[A-Z]{2})?)/);
  if (from) out.from = from[1];
  const to = raw.match(/\b(?:to|in|visit|visiting)\s+([A-Z][\w'.-]*(?:\s+[A-Z][\w'.-]*)*(?:,\s*[A-Z]{2})?)/g);
  const place = (to ?? [])
    .map((s) => s.replace(/^(to|in|visit|visiting)\s+/i, ""))
    .find((s) => !MONTHS.includes(s.toLowerCase().split(/\s/)[0]));
  if (place && !MONTHS.some((mo) => place.toLowerCase().startsWith(mo))) out.to = place;

  // Vibes, from the words around the places ("Torch Lake" alone doesn't make it a lake trip)
  let rest = t;
  for (const p of [out.from, out.to]) if (p) rest = rest.replace(p.toLowerCase(), " ");
  const vibes = VIBE_WORDS.filter(([re]) => re.test(rest)).map(([, v]) => v);
  if (vibes.length) out.vibes = [...new Set(vibes)];

  return out;
}

/** Plain words for what was understood, so people can check it: "8 people · $6,000 total · Aug 2027 · drive". */
export function describedSummary(d: Described) {
  const parts: string[] = [];
  if (d.travelers) parts.push(`${d.travelers} ${d.travelers === 1 ? "person" : "people"}`);
  if (d.cash) parts.push(`$${d.cash.toLocaleString("en-US")} ${d.per === "person" ? "each" : "total"}`);
  if (d.month) parts.push(new Date(`${d.month}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }));
  if (d.nights) parts.push(`${d.nights} night${d.nights === 1 ? "" : "s"}`);
  if (d.go) parts.push(d.go === "drive" ? "drive" : "fly");
  if (d.from) parts.push(`from ${d.from}`);
  if (d.to) parts.push(`to ${d.to}`);
  if (d.vibes?.length) parts.push(d.vibes.join(", "));
  return parts.join(" · ");
}
