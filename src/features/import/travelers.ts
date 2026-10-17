/**
 * Who is on a reservation: names from structured data (underName) or the
 * passenger/guest lists airlines, rail, bus and hotel confirmations print,
 * plus a head count ("2 adults", "Party of 4") when names aren't listed.
 */
export type Travelers = { names: string[]; count: number | null };

const TITLE = /^(mr|mrs|ms|miss|mstr|master|dr|prof|mx|sir|lady)\.?$/i;
const NOT_NAME =
  /\b(flight|seat|class|economy|business|premium|first|cabin|ticket|number|frequent|flyer|skymiles|mileageplus|aadvantage|status|member|loyalty|confirmation|booking|reservation|total|price|fare|tax|baggage|bag|carry|meal|terminal|gate|departs?|departure|departing|arrives?|arrival|arriving|leaves|adult|child|infant|passenger|traveler|traveller|guest|name|room|airline|airlines|airways|train|coach|bus|car|known|redress|ktn|tsa|precheck|e-?ticket|eticket|operated|included|none|n\/a|summary|details|information|info|contact|email|phone|mobile|address|date|birth)\b/i;

const tidyName = (raw: string): string | null => {
  let s = raw
    .replace(/\s{2,}.*$/, "") // drop columns after a wide gap ("KONNER PETZ    Ticket 006...")
    .replace(/\s*[|(•·].*$/, "")
    // App rows end in a link: "SHANEA ROMERO   View" (OCR: "VIE", "Vie w")
    .replace(/\s+(?:view|vie\s?w?|edit|details|change|manage|>)\s*$/i, "")
    .replace(/[,;:]+$/, "")
    .trim();
  // Airline style "PETZ/KONNER MR" → "KONNER PETZ"
  const slash = /^([A-Za-zÀ-ÿ'’ -]+)\/([A-Za-zÀ-ÿ'’ -]+)$/.exec(s);
  if (slash) s = `${slash[2]} ${slash[1]}`;
  let words = s.split(/\s+/).filter((w) => !TITLE.test(w));
  // Two columns run together ("Konner Petz You can cancel for free…"): keep the leading capitalized name.
  if (words.length > 4) {
    // Only when the next column clearly starts with a sentence ("You can…", "Please…").
    const stop = words.findIndex((w) => /^(You|Your|The|For|If|We|This|Please|Free|Cancel|Check|Arrival)$/.test(w));
    words = stop >= 2 && stop <= 4 && words.slice(0, stop).every((w) => /^[A-ZÀ-Þ]/.test(w)) ? words.slice(0, stop) : [];
  }
  if (words.length < 2 || words.length > 4) return null;
  if (!words.every((w) => /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’.-]*$/.test(w))) return null;
  const joined = words.join(" ");
  if (NOT_NAME.test(joined) || joined.length > 50) return null;
  // ALL CAPS → Title Case
  return words
    .map((w) => (w === w.toUpperCase() || w === w.toLowerCase() ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
};

const unique = (names: (string | null)[]) => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    if (!n) continue;
    const k = n.toLowerCase().replace(/[^a-z]/g, "");
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(n);
  }
  return out.slice(0, 12);
};

/** Names listed under a heading ("Passengers", "Traveler details", "Guests") or labeled lines ("Passenger 1: …", "NAME: …"). */
export function travelersInText(text: string): Travelers {
  const lines = text.split(/\n/).map((l) => l.trim());
  const names: (string | null)[] = [];

  lines.forEach((raw, i) => {
    // OCR leaves stray marks at line starts (": Guest name: …", "© CONFIRMATION…").
    const line = raw.replace(/^[^A-Za-zÀ-ÿ0-9]+/, "");
    // A heading followed by a list of names.
    if (
      /^(?:(?:show|view|hide|all) )?(?:passengers?|travell?ers?|guests?|guest names?|travell?er (?:details|info(?:rmation)?|names?)|passenger (?:details|info(?:rmation)?|names?\(?s?\)?)|who'?s (?:flying|going|travell?ing)|who is (?:booking|travell?ing|staying)\??|booked by|(?:lead|main) (?:guest|traveller|traveler)|names? of travell?ers?)(?:\s*\(\d{1,2}\))?\s*[:>v⌄]?\s*$/i.test(
        line
      )
    ) {
      for (let j = i + 1; j < Math.min(lines.length, i + 12); j++) {
        if (!lines[j]) {
          if (names.length) break;
          continue;
        }
        const n = tidyName(lines[j].replace(/^\d+[.)]\s*/, ""));
        if (n) names.push(n);
        else if (names.length && !/ticket|frequent|seat|known|skymiles|member|#|\d{6,}|-{3,}|\b[A-Z]{3}-[A-Z]{3}\b/i.test(lines[j])) break;
      }
    }
    // "Passenger 1: Konner Petz", "Adult 2 - Shane Smith", "Traveler: Konner Petz", "NAME: KONNER PETZ", "Guest name: …"
    const labeled =
      /^(?:passengers?|travell?ers?|adults?|child(?:ren)?|guests?|lead (?:passenger|guest)|names?)(?:\s*\d+)?(?:\s+names?)?\s*[:\-–]\s*(.+)$/i.exec(
        line
      );
    if (labeled) {
      const parts = labeled[1].split(/\s*(?:,|;|\band\b|&)\s*/);
      for (const p of parts) names.push(tidyName(p));
    }
  });

  // Inline list: "Travelers: Konner Petz, Shane Smith" (handled above for each part).
  // United prints "PETZ/KONNERJOSEPH" (first and middle run together); if the same person appears
  // elsewhere as "Konner Petz", use that.
  const list = unique(
    names.map((n) => {
      const w = n?.split(" ");
      if (!n || !w || w.length !== 2 || w[0].length < 7) return n;
      const last = w[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      for (const m of text.matchAll(new RegExp(`\\b([A-Z][a-zà-ÿ]{1,})[ \\t]+${last}\\b`, "g"))) {
        if (m[1].length < w[0].length && w[0].toLowerCase().startsWith(m[1].toLowerCase())) return `${m[1]} ${w[1]}`;
      }
      return n;
    }),
  );

  // Head counts.
  let count: number | null = null;
  const nums = [
    ...text.matchAll(/\b(\d{1,2})[ \t]+(?:adults?|passengers?|travell?ers?|guests?|people|persons|pax)\b/gi),
    ...text.matchAll(/\b(?:passengers?|travell?ers?|guests?)[ \t]*\((\d{1,2})\)/gi),
    // Not "Total Per Passenger: 44,000 miles".
    ...text.matchAll(/(?<!per[ \t]{1,3})\b(?:party of|guests?[ \t]*:|passengers?[ \t]*:|travell?ers?[ \t]*:|adults?[ \t]*:)[ \t]*(\d{1,2})(?![\d,.])/gi),
  ].map((m) => Number(m[1]));
  const kids = [...text.matchAll(/\b(\d{1,2})[ \t]+(?:children|child|kids?|infants?)\b/gi)].map((m) => Number(m[1]));
  if (nums.length) count = Math.max(...nums) + (kids.length ? Math.max(...kids) : 0);
  if (list.length > (count ?? 0)) count = list.length;
  return {
    names: list,
    count: count && count > 0 && count < 50 ? count : null,
  };
}

/** Names from schema.org reservations (underName on each passenger's reservation), and party sizes. */
export function travelersInJsonLd(blocks: Record<string, unknown>[]): Travelers {
  const names: (string | null)[] = [];
  let count: number | null = null;
  for (const b of blocks) {
    const u = b.underName;
    for (const person of Array.isArray(u) ? u : [u]) {
      const n = person && typeof person === "object" ? (person as { name?: unknown }).name : null;
      if (typeof n === "string") names.push(tidyName(n) ?? n.trim().slice(0, 50));
      const gn = person && typeof person === "object" ? (person as { givenName?: unknown; familyName?: unknown }) : null;
      if (gn && typeof gn.givenName === "string" && typeof gn.familyName === "string")
        names.push(tidyName(`${gn.givenName} ${gn.familyName}`));
    }
    for (const k of ["partySize", "numAdults", "numSeats"]) {
      const v = Number(b[k]);
      if (Number.isFinite(v) && v > 0 && v < 50) count = Math.max(count ?? 0, v + (k === "numAdults" ? Number(b.numChildren) || 0 : 0));
    }
  }
  const list = unique(names);
  if (list.length > (count ?? 0)) count = list.length;
  return { names: list, count };
}

export function mergeTravelers(a: Travelers, b: Travelers): Travelers {
  const names = unique([...a.names, ...b.names]);
  const count = Math.max(a.count ?? 0, b.count ?? 0, names.length) || null;
  return { names, count };
}

const letters = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
/** "Konner Petz" matches "Konner Petz", "Konner J Petz" or a member named just "Konner". */
const samePerson = (a: string, b: string) => {
  const wa = a.toLowerCase().split(/\s+/).map(letters).filter(Boolean);
  const wb = b.toLowerCase().split(/\s+/).map(letters).filter(Boolean);
  if (!wa.length || !wb.length) return false;
  if (letters(a) === letters(b)) return true;
  const [short, long] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
  // Apps run a middle initial into the first name ("KONNERJ PETZ" is Konner J. Petz).
  const same = (x: string, y: string) => x === y || (Math.min(x.length, y.length) >= 4 && Math.abs(x.length - y.length) <= 2 && (x.startsWith(y) || y.startsWith(x)));
  return short.every((w) => long.some((l) => same(w, l)));
};

/** Who on a booking isn't on the trip yet. */
export function partnersOnBooking(people: Travelers | undefined, members: string[]) {
  if (!people) return { others: [] as string[], extra: 0, count: 0 };
  const known = members.filter((m) => m && m !== "Traveler");
  const others = people.names.filter((n) => !known.some((m) => samePerson(n, m)));
  const count = Math.max(people.count ?? 0, people.names.length);
  // Unnamed seats beyond the listed names and the people already on the trip.
  const matched = people.names.length - others.length;
  const extra = Math.max(0, count - others.length - Math.max(matched, Math.min(1, known.length)));
  return { others, extra, count };
}
