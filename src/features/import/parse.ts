import "server-only";

import { airportByCode } from "@/features/places/airports";
import { timezoneFor } from "@/features/places/timezone";
import type { TransitMode } from "@/types/database";

/**
 * Reads bookings out of what travelers already have: confirmation emails
 * (pasted text or HTML), calendar files (.ics), ticket PDFs and links.
 *
 * Order of trust:
 *   1. schema.org reservations (JSON-LD) that airlines, hotels and ticket
 *      sites embed in confirmation emails and pages: exact fields
 *   2. calendar events (.ics): exact times, classified by their wording
 *   3. plain text: flight numbers, airport pairs, dates and times found near
 *      each other; check-in / check-out dates for stays
 * Everything found is shown for review before anything is saved.
 */

export type ImportLeg = {
  kind: "transit";
  mode: TransitMode;
  carrier: string | null;
  number: string | null;
  /** Airport codes for flights; place names otherwise */
  from: string;
  to: string;
  departLocal: string; // "2026-11-02T08:30"
  departTz: string;
  arriveLocal: string;
  arriveTz: string;
};
export type ImportStay = { kind: "stay"; name: string; address: string | null; checkInLocal: string; checkOutLocal: string };
export type ImportActivity = { kind: "activity"; title: string; date: string; time: string | null; address: string | null; url: string | null };
export type ImportCandidate = (ImportLeg | ImportStay | ImportActivity) & {
  id: string;
  confirmation: string | null;
  /** How it was found: "Email (structured)", "Calendar file", "Text" */
  found: string;
  /** Things to double-check before saving */
  warnings: string[];
};

type Ctx = { defaultTz: string; year: number };

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
export function parseBookings(input: { text?: string | null; html?: string | null; ics?: string | null }, ctx: Ctx): ImportCandidate[] {
  const out: ImportCandidate[] = [];
  if (input.ics) out.push(...fromIcs(input.ics, ctx));
  const html = input.html ?? (input.text && /<\/?[a-z][\s\S]*>/i.test(input.text) ? input.text : null);
  if (html) out.push(...fromJsonLd(html, ctx));
  // Plain text only when nothing structured was found (avoids double entries).
  if (!out.length) {
    const text = html ? htmlToText(html) : (input.text ?? "");
    if (text.trim()) out.push(...fromText(text, ctx));
  }
  return dedupe(out);
}

function dedupe(list: ImportCandidate[]) {
  const seen = new Set<string>();
  return list.filter((c) => {
    const key =
      c.kind === "transit" ? `t|${c.from}|${c.to}|${c.departLocal.slice(0, 13)}` : c.kind === "stay" ? `s|${c.name.toLowerCase()}|${c.checkInLocal.slice(0, 10)}` : `a|${c.title.toLowerCase()}|${c.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

let counter = 0;
const nextId = () => `imp-${Date.now().toString(36)}-${(counter++).toString(36)}`;

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------
export function airportTz(code: string, onDate: string): string | null {
  const a = airportByCode(code);
  if (!a) return null;
  return timezoneFor({ latitude: a.latitude, longitude: a.longitude, countryCode: a.country, onDate });
}

/** A UTC instant as local wall time in a zone: "2026-11-02T08:30". */
function utcToLocal(date: Date, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/**
 * An ISO time from structured data. "2026-11-02T08:30:00-05:00" is already
 * local wall time at the place; "…Z" is converted into the place's zone.
 */
function isoToLocal(iso: string | undefined | null, tz: string): string | null {
  if (!iso) return null;
  const m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(iso);
  if (!m) return null;
  if (/Z$|[+-]00:?00$/.test(iso) && m[2]) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : utcToLocal(d, tz);
  }
  return `${m[1]}T${m[2] ?? "12"}:${m[3] ?? "00"}`;
}

function addMinutes(local: string, minutes: number) {
  const d = new Date(`${local}:00Z`);
  d.setUTCMinutes(d.getUTCMinutes() + minutes);
  return d.toISOString().slice(0, 16);
}

// ---------------------------------------------------------------------------
// 1. schema.org JSON-LD
// ---------------------------------------------------------------------------
type Json = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null);
const obj = (v: unknown): Json | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null);
const typeOf = (o: Json) => {
  const t = o["@type"];
  return (Array.isArray(t) ? t.join(" ") : String(t ?? "")).toLowerCase();
};
function addressText(v: unknown): string | null {
  const a = obj(v);
  if (!a) return str(v);
  return [a.streetAddress, a.addressLocality, a.postalCode, a.addressCountry].map((x) => str(typeof x === "object" ? obj(x)?.name : x)).filter(Boolean).join(", ") || null;
}

function jsonLdBlocks(html: string): Json[] {
  const blocks: Json[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    try {
      const parsed = JSON.parse(m[1].trim()) as unknown;
      const walk = (v: unknown) => {
        if (Array.isArray(v)) v.forEach(walk);
        else if (obj(v)) {
          const o = v as Json;
          if (Array.isArray(o["@graph"])) (o["@graph"] as unknown[]).forEach(walk);
          blocks.push(o);
        }
      };
      walk(parsed);
    } catch {
      // ignore malformed blocks
    }
  }
  return blocks;
}

export function fromJsonLd(html: string, ctx: Ctx): ImportCandidate[] {
  const out: ImportCandidate[] = [];
  for (const r of jsonLdBlocks(html)) {
    const t = typeOf(r);
    const conf = str(r.reservationNumber) ?? str(r.confirmationNumber);
    const item = obj(r.reservationFor);
    if (!item && !t.includes("event")) continue;

    if (t.includes("flightreservation") && item) {
      const from = str(obj(item.departureAirport)?.iataCode)?.toUpperCase();
      const to = str(obj(item.arrivalAirport)?.iataCode)?.toUpperCase();
      if (!from || !to) continue;
      const day = str(item.departureTime)?.slice(0, 10) ?? `${ctx.year}-01-01`;
      const departTz = airportTz(from, day) ?? ctx.defaultTz;
      const arriveTz = airportTz(to, day) ?? ctx.defaultTz;
      const departLocal = isoToLocal(str(item.departureTime), departTz);
      if (!departLocal) continue;
      const arriveLocal = isoToLocal(str(item.arrivalTime), arriveTz);
      const airline = obj(item.airline);
      out.push({
        id: nextId(),
        kind: "transit",
        mode: "flight",
        carrier: str(airline?.name) ?? str(airline?.iataCode),
        number: flightLabel(str(airline?.iataCode), str(item.flightNumber)),
        from,
        to,
        departLocal,
        departTz,
        arriveLocal: arriveLocal ?? addMinutes(departLocal, 120),
        arriveTz,
        confirmation: conf,
        found: "Confirmation (structured data)",
        warnings: arriveLocal ? [] : ["Arrival time wasn't included. Check it."],
      });
    } else if ((t.includes("trainreservation") || t.includes("busreservation") || t.includes("boatreservation")) && item) {
      const mode: TransitMode = t.includes("train") ? "train" : t.includes("bus") ? "bus" : "ferry";
      const fromStop = obj(item.departureStation) ?? obj(item.departureBusStop) ?? obj(item.departureBoatTerminal);
      const toStop = obj(item.arrivalStation) ?? obj(item.arrivalBusStop) ?? obj(item.arrivalBoatTerminal);
      const from = str(fromStop?.name);
      const to = str(toStop?.name);
      const departLocal = isoToLocal(str(item.departureTime), ctx.defaultTz);
      if (!from || !to || !departLocal) continue;
      const arriveLocal = isoToLocal(str(item.arrivalTime), ctx.defaultTz);
      out.push({
        id: nextId(),
        kind: "transit",
        mode,
        carrier: str(obj(item.provider)?.name),
        number: str(item.trainNumber) ?? str(item.busNumber) ?? null,
        from,
        to,
        departLocal,
        departTz: ctx.defaultTz,
        arriveLocal: arriveLocal ?? addMinutes(departLocal, 60),
        arriveTz: ctx.defaultTz,
        confirmation: conf,
        found: "Confirmation (structured data)",
        warnings: ["Check the time zones.", ...(arriveLocal ? [] : ["Arrival time wasn't included."])],
      });
    } else if (t.includes("lodgingreservation") && item) {
      const name = str(item.name);
      const checkIn = isoToLocal(str(r.checkinTime) ?? str(r.checkinDate), ctx.defaultTz);
      const checkOut = isoToLocal(str(r.checkoutTime) ?? str(r.checkoutDate), ctx.defaultTz);
      if (!name || !checkIn || !checkOut) continue;
      out.push({
        id: nextId(),
        kind: "stay",
        name,
        address: addressText(item.address),
        checkInLocal: /T12:00$/.test(checkIn) && !str(r.checkinTime) ? `${checkIn.slice(0, 10)}T15:00` : checkIn,
        checkOutLocal: /T12:00$/.test(checkOut) && !str(r.checkoutTime) ? `${checkOut.slice(0, 10)}T11:00` : checkOut,
        confirmation: conf,
        found: "Confirmation (structured data)",
        warnings: [],
      });
    } else if (t.includes("eventreservation") || t.includes("foodestablishmentreservation") || t.includes("rentalcarreservation") || t.includes("reservation") || t.includes("event")) {
      const ev = item ?? r;
      const title = str(ev.name);
      const start = isoToLocal(str(r.startTime) ?? str(ev.startDate) ?? str(r.startDate), ctx.defaultTz);
      if (!title || !start) continue;
      const loc = obj(ev.location) ?? obj(ev.address) ?? ev;
      const hasTime = /T\d{2}:\d{2}/.test(str(r.startTime) ?? str(ev.startDate) ?? "");
      out.push({
        id: nextId(),
        kind: "activity",
        title: title.slice(0, 200),
        date: start.slice(0, 10),
        time: hasTime ? start.slice(11, 16) : null,
        address: addressText(loc?.address) ?? str(loc?.name),
        url: str(r.url) ?? str(ev.url),
        confirmation: conf,
        found: "Confirmation (structured data)",
        warnings: [],
      });
    }
  }
  return out;
}

/** "UA" + "958" → "UA 958"; "UA958" stays "UA 958"; a bare "958" without a code stays "958". */
function flightLabel(code: string | null, number: string | null) {
  if (!number) return code;
  const n = number.replace(/\s+/g, "");
  if (code && n.toUpperCase().startsWith(code.toUpperCase()) && /\d/.test(n.slice(code.length))) return `${code.toUpperCase()} ${n.slice(code.length)}`;
  return code && /^\d+$/.test(n) ? `${code.toUpperCase()} ${n}` : number;
}

// ---------------------------------------------------------------------------
// 2. Calendar files (.ics)
// ---------------------------------------------------------------------------
type IcsEvent = Record<string, { value: string; params: Record<string, string> }>;

function icsEvents(ics: string): IcsEvent[] {
  // Unfold continuation lines, then read each VEVENT.
  const lines = ics.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
  const events: IcsEvent[] = [];
  let cur: IcsEvent | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT") {
      if (cur) events.push(cur);
      cur = null;
    } else if (cur) {
      const i = line.indexOf(":");
      if (i < 1) continue;
      const [name, ...paramParts] = line.slice(0, i).split(";");
      const params = Object.fromEntries(paramParts.map((p) => p.split("=") as [string, string]).filter((p) => p.length === 2));
      const value = line
        .slice(i + 1)
        .replace(/\\n/gi, "\n")
        .replace(/\\([,;\\])/g, "$1");
      cur[name.toUpperCase()] = { value, params };
    }
    if (events.length > 200) break;
  }
  return events;
}

/** ICS date-time → local wall time in a zone (TZID honored, UTC converted). */
function icsTime(p: { value: string; params: Record<string, string> } | undefined, tz: string): { local: string; dateOnly: boolean; tz: string } | null {
  if (!p) return null;
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(p.value.trim());
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  if (!m[4]) return { local: `${date}T12:00`, dateOnly: true, tz };
  if (m[7]) return { local: utcToLocal(new Date(`${date}T${m[4]}:${m[5]}:00Z`), tz), dateOnly: false, tz };
  const zone = p.params.TZID && isZone(p.params.TZID) ? p.params.TZID : tz;
  return { local: `${date}T${m[4]}:${m[5]}`, dateOnly: false, tz: zone };
}

function isZone(z: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: z });
    return true;
  } catch {
    return false;
  }
}

export function fromIcs(ics: string, ctx: Ctx): ImportCandidate[] {
  const out: ImportCandidate[] = [];
  for (const ev of icsEvents(ics)) {
    const summary = ev.SUMMARY?.value?.trim() ?? "";
    const description = ev.DESCRIPTION?.value ?? "";
    const location = ev.LOCATION?.value?.trim() || null;
    const both = squeeze(`${summary}\n${location ?? ""}\n${description}`).slice(0, 20_000);
    const conf = confirmationIn(both);

    // A flight: two airport codes plus a flight number or the word "flight".
    const pair = airportPair(both);
    if (pair && (flightNumberIn(both) || /\bflight\b|\bflug\b|\bvol\b|\bvuelo\b/i.test(both))) {
      const dayGuess = /^(\d{4})(\d{2})(\d{2})/.exec(ev.DTSTART?.value ?? "");
      const day = dayGuess ? `${dayGuess[1]}-${dayGuess[2]}-${dayGuess[3]}` : `${ctx.year}-01-01`;
      const departTz = airportTz(pair.from, day) ?? ctx.defaultTz;
      const arriveTz = airportTz(pair.to, day) ?? ctx.defaultTz;
      const start = icsTime(ev.DTSTART, departTz);
      const end = icsTime(ev.DTEND, arriveTz);
      if (!start) continue;
      const fn = flightNumberIn(both);
      out.push({
        id: nextId(),
        kind: "transit",
        mode: "flight",
        carrier: null,
        number: fn,
        from: pair.from,
        to: pair.to,
        departLocal: start.local,
        departTz: start.tz,
        arriveLocal: end?.local ?? addMinutes(start.local, 120),
        arriveTz: end?.tz ?? arriveTz,
        confirmation: conf,
        found: "Calendar file",
        warnings: start.dateOnly ? ["The calendar entry had no times. Add them."] : [],
      });
      continue;
    }

    const start = icsTime(ev.DTSTART, ctx.defaultTz);
    if (!start) continue;
    const end = icsTime(ev.DTEND, ctx.defaultTz);
    const multiDay = end && end.local.slice(0, 10) > start.local.slice(0, 10);
    // A stay: lodging words, or an all-day event over several nights (Airbnb, hotel calendars).
    if (/hotel|check[- ]?in|stay|airbnb|reservation at|resort|hostel|apartment|lodging|accommodation|vrbo|booking\.com/i.test(summary) || (start.dateOnly && multiDay)) {
      if (!end || !multiDay) {
        // A single check-in reminder isn't a whole stay; offer it as an item instead.
      } else {
        out.push({
          id: nextId(),
          kind: "stay",
          name: cleanStayName(summary) || location || "Stay",
          address: location,
          checkInLocal: start.dateOnly ? `${start.local.slice(0, 10)}T15:00` : start.local,
          checkOutLocal: end.dateOnly ? `${end.local.slice(0, 10)}T11:00` : end.local,
          confirmation: conf,
          found: "Calendar file",
          warnings: start.dateOnly ? ["Check-in and check-out times are typical ones (3 PM / 11 AM). Adjust if needed."] : [],
        });
        continue;
      }
    }

    out.push({
      id: nextId(),
      kind: "activity",
      title: (summary || location || "Booking").slice(0, 200),
      date: start.local.slice(0, 10),
      time: start.dateOnly ? null : start.local.slice(11, 16),
      address: location,
      url: ev.URL?.value && /^https?:\/\//.test(ev.URL.value) ? ev.URL.value : null,
      confirmation: conf,
      found: "Calendar file",
      warnings: [],
    });
  }
  return out;
}

function cleanStayName(s: string) {
  return s
    .replace(/^(reserved|reservation|booking|stay|check[- ]?in)\s*(at|:|-)?\s*/i, "")
    .replace(/\s*\((not available|blocked)\)\s*$/i, "")
    .trim()
    .slice(0, 200);
}

// ---------------------------------------------------------------------------
// 3. Plain text (emails, PDFs)
// ---------------------------------------------------------------------------
/** Non-breaking spaces become spaces; runs of spaces and blank lines are capped. */
function squeeze(s: string) {
  return s.replace(/\u00a0/g, " ").replace(/\r\n?/g, "\n").replace(/[ \t]{4,}/g, "   ").replace(/\n[ \t\n]*\n/g, "\n\n");
}

/** "DTW → LIS", "DTW - LIS", "DTW to LIS", "DTW  LIS", or the two codes on consecutive lines. */
const PAIR_RE = () => /\b([A-Z]{3})\b(?:[ \t]*(?:→|->|–|—|-|to|›|>|\/)[ \t]*|[ \t]{2,3}|[ \t]*\n[ \t]*)\b([A-Z]{3})\b/g;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};
const NOT_AIRPORTS = new Set(["THE", "AND", "FOR", "YOU", "ARE", "PNR", "USD", "EUR", "GBP", "CAD", "GMT", "UTC", "EST", "PST", "CST", "MST", "EDT", "PDT", "CET", "TAX", "FEE", "VAT", "NEW", "ALL", "ONE", "TWO", "OUT", "NOT", "PER", "VIA", "AIR", "BAG", "MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN", "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]);

type Hit = { index: number; value: string };

export function datesIn(text: string, year: number): Hit[] {
  const hits: Hit[] = [];
  const pad = (n: number) => String(n).padStart(2, "0");
  const ok = (y: number, m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2000 && y < 2100;
  for (const m of text.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)) {
    if (ok(+m[1], +m[2], +m[3])) hits.push({ index: m.index!, value: `${m[1]}-${m[2]}-${m[3]}` });
  }
  for (const m of text.matchAll(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d{2}))?\b/g)) {
    const mo = MONTHS[m[1].toLowerCase()];
    if (mo && ok(+(m[3] ?? year), mo, +m[2])) hits.push({ index: m.index!, value: `${m[3] ?? year}-${pad(mo)}-${pad(+m[2])}` });
  }
  for (const m of text.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?(?:\s+(20\d{2}))?\b/g)) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (mo && ok(+(m[3] ?? year), mo, +m[1])) hits.push({ index: m.index!, value: `${m[3] ?? year}-${pad(mo)}-${pad(+m[1])}` });
  }
  for (const m of text.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2}|\d{2})\b/g)) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    if (ok(y, +m[1], +m[2])) hits.push({ index: m.index!, value: `${y}-${pad(+m[1])}-${pad(+m[2])}` });
  }
  return hits.sort((a, b) => a.index - b.index);
}

function timesIn(text: string): Hit[] {
  const hits: Hit[] = [];
  for (const m of text.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s?m\.?\b|\b([01]?\d|2[0-3]):([0-5]\d)\b(?!\s*[ap]\.?m)/gi)) {
    let h: number;
    let min: number;
    if (m[3]) {
      h = +m[1] % 12 + (m[3].toLowerCase() === "p" ? 12 : 0);
      min = +(m[2] ?? 0);
      if (+m[1] > 12) continue;
    } else {
      h = +m[4];
      min = +m[5];
    }
    hits.push({ index: m.index!, value: `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}` });
  }
  return hits;
}

function flightNumberIn(text: string): string | null {
  // A labeled number first ("Flight# DL0022", "Flight: UA 958"), then any airline-code-plus-digits.
  const m =
    /\bflight\s*(?:#|no\.?|number)?\s*:?\s*([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{1,4})\b/i.exec(text) ??
    /\b(?!AM\b|PM\b)([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{1,4})\b/.exec(text);
  if (!m) return null;
  const n = String(Number(m[2]));
  return n === "0" ? null : `${m[1].toUpperCase()} ${n}`;
}

/** Airline names for the most common codes, so imported legs read "Delta DL 22". */
const AIRLINES: Record<string, string> = {
  AA: "American", AC: "Air Canada", AF: "Air France", AS: "Alaska", AY: "Finnair", AZ: "ITA Airways", B6: "JetBlue", BA: "British Airways",
  CX: "Cathay Pacific", DL: "Delta", EI: "Aer Lingus", EK: "Emirates", EY: "Etihad", F9: "Frontier", FR: "Ryanair", IB: "Iberia",
  JL: "Japan Airlines", KL: "KLM", LH: "Lufthansa", LX: "SWISS", NH: "ANA", NK: "Spirit", OS: "Austrian", QF: "Qantas", QR: "Qatar Airways",
  SK: "SAS", SN: "Brussels Airlines", SQ: "Singapore Airlines", TK: "Turkish Airlines", TP: "TAP Air Portugal", U2: "easyJet",
  UA: "United", VS: "Virgin Atlantic", WN: "Southwest", WS: "WestJet", AM: "Aeroméxico", LA: "LATAM", AV: "Avianca", CM: "Copa",
};
const airlineOf = (flight: string | null) => (flight ? (AIRLINES[flight.slice(0, 2)] ?? null) : null);

function confirmationIn(text: string): string | null {
  const re = /\b(?:confirmation|booking|reservation|record locator|pnr|reference|ref\.?)(?:\s+(?:reference|number|code|no\.?|#))?\s*[:#]?\s*([A-Za-z0-9]{5,10})\b/gi;
  for (const m of text.matchAll(re)) {
    const code = m[1];
    // Real codes are capitals and/or digits ("K4ZP9Q", "4521889"), not words ("reference").
    if (code === code.toUpperCase() && (/\d/.test(code) || /^[A-Z]{5,}$/.test(code)) && !/^(NUMBER|CODE)$/.test(code)) return code;
  }
  return null;
}

function airportPair(text: string): { from: string; to: string; index: number } | null {
  const re = PAIR_RE();
  for (const m of text.matchAll(re)) {
    const [a, b] = [m[1], m[2]];
    if (a === b || NOT_AIRPORTS.has(a) || NOT_AIRPORTS.has(b)) continue;
    if (airportByCode(a) && airportByCode(b)) return { from: a, to: b, index: m.index! };
  }
  return null;
}

function nearest(hits: Hit[], index: number, maxDistance: number, after = false) {
  let best: Hit | null = null;
  for (const h of hits) {
    const d = after ? h.index - index : Math.abs(h.index - index);
    if (d < 0 || d > maxDistance) continue;
    if (!best || Math.abs(h.index - index) < Math.abs(best.index - index)) best = h;
  }
  return best;
}

export function fromText(raw: string, ctx: Ctx): ImportCandidate[] {
  // Whitespace runs are squeezed (max 3) so every pattern below stays linear on any input.
  const text = squeeze(raw).slice(0, 200_000);
  const out: ImportCandidate[] = [];
  const dates = datesIn(text, ctx.year);
  const times = timesIn(text);
  const conf = confirmationIn(text);

  // Flights: each airport pair, with the date, flight number and times that
  // belong to it (between the previous pair and the next one).
  const re = PAIR_RE();
  const pairs = [...text.matchAll(re)]
    .map((m) => ({ from: m[1], to: m[2], index: m.index!, end: m.index! + m[0].length }))
    .filter((p) => p.from !== p.to && !NOT_AIRPORTS.has(p.from) && !NOT_AIRPORTS.has(p.to) && airportByCode(p.from) && airportByCode(p.to));
  const seen = new Set<string>();
  pairs.forEach((p, i) => {
    const lineStart = text.lastIndexOf("\n", p.index) + 1;
    const lineEndRaw = text.indexOf("\n", p.end);
    const lineEnd = lineEndRaw === -1 ? text.length : lineEndRaw;
    const segStart = Math.max(i ? pairs[i - 1].end : 0, lineStart - 200);
    const segEnd = Math.min(pairs[i + 1]?.index ?? text.length, p.end + 350);
    const inSeg = (h: Hit) => h.index >= segStart && h.index < segEnd;

    // Date: on the pair's line, else the closest before it in this segment, else the closest after.
    const segDates = dates.filter(inSeg);
    const date =
      segDates.filter((d) => d.index >= lineStart && d.index < lineEnd).at(0) ??
      segDates.filter((d) => d.index < p.index).at(-1) ??
      segDates.find((d) => d.index > p.end) ??
      nearest(dates, p.index, 400);
    if (!date) return;
    const key = `${p.from}${p.to}${date.value}`;
    if (seen.has(key)) return;
    seen.add(key);

    // Flight number: on the same line first, then anywhere in the segment.
    const strip = (s: string) => s.replace(new RegExp(`\\b(${p.from}|${p.to})\\b`, "g"), "");
    const fn = flightNumberIn(strip(text.slice(lineStart, lineEnd))) ?? flightNumberIn(strip(text.slice(segStart, segEnd)));

    // Times: the ones after the pair first (depart, then arrive); else the ones before it.
    const after = times.filter((t) => t.index >= p.end && t.index < segEnd);
    const before = times.filter((t) => t.index >= segStart && t.index < p.index);
    const near = after.length >= 2 ? after : [...before.slice(-(2 - after.length)), ...after];
    const departTz = airportTz(p.from, date.value) ?? ctx.defaultTz;
    const arriveTz = airportTz(p.to, date.value) ?? ctx.defaultTz;
    const departTime = near[0]?.value ?? null;
    const arriveTime = near[1]?.value ?? null;
    const departLocal = `${date.value}T${departTime ?? "09:00"}`;
    let arriveLocal = arriveTime ? `${date.value}T${arriveTime}` : addMinutes(departLocal, 120);
    // Overnight flights: "+1" after the arrival time, or arrival earlier than departure.
    if (arriveTime && (arriveTime < (departTime ?? "00:00") || /^\s*(?:[ap]\.?m\.?)?\s*\+\s?1\b/i.test(text.slice(near[1].index + 4, near[1].index + 16)))) {
      arriveLocal = addMinutes(arriveLocal, 24 * 60);
    }
    const warnings: string[] = [];
    if (!departTime || !arriveTime) warnings.push("Couldn't read both times. Check them.");
    if (!fn) warnings.push("No flight number found.");
    out.push({
      id: nextId(),
      kind: "transit",
      mode: "flight",
      carrier: airlineOf(fn),
      number: fn,
      from: p.from,
      to: p.to,
      departLocal,
      departTz,
      arriveLocal,
      arriveTz,
      confirmation: conf,
      found: "Text",
      warnings,
    });
  });

  // Flights written as labeled lines (Delta, many apps):
  //   Departs DTW / on Sunday, May 16, 2027 at 4:40 PM
  //   Arrives MUC / on Monday, May 17, 2027 at 6:55 AM
  // Each label carries its own airport, date and time.
  const labelRe = /\b(depart(?:s|ure|ing)?|leav(?:es|ing)|from|arriv(?:es|al|ing)?|to)\b[ \t]*(?:from|at|in)?[ \t]*:?[ \t]*(?:[^\n(]{0,40}\()?\b([A-Z]{3})\b/gi;
  const labels = [...text.matchAll(labelRe)]
    .map((m) => ({ dep: /^(dep|leav|from)/i.test(m[1]), code: m[2], index: m.index!, end: m.index! + m[0].length }))
    .filter((l) => l.code === l.code.toUpperCase() && !NOT_AIRPORTS.has(l.code) && airportByCode(l.code));
  for (let i = 0; i < labels.length; i++) {
    const dep = labels[i];
    const arr = labels[i + 1];
    if (!dep.dep || !arr || arr.dep || arr.code === dep.code) continue;
    i++;
    const afterLabel = (index: number, limit: number, hits: Hit[]) => hits.find((h) => h.index >= index && h.index < limit);
    const nextLabel = labels[i + 1]?.index ?? text.length;
    const depDate = afterLabel(dep.end, arr.index, dates) ?? [...dates].reverse().find((d) => d.index < dep.index);
    if (!depDate) continue;
    const arrDate = afterLabel(arr.end, Math.min(nextLabel, arr.end + 200), dates) ?? depDate;
    const depTime = afterLabel(dep.end, arr.index, times);
    const arrTime = afterLabel(arr.end, Math.min(nextLabel, arr.end + 200), times);
    const key = `${dep.code}${arr.code}${depDate.value}`;
    if (out.some((c) => c.kind === "transit" && `${c.from}${c.to}${c.departLocal.slice(0, 10)}` === key)) continue;
    const prevEnd = i >= 2 ? labels[i - 2].end : 0;
    const fn = flightNumberIn(text.slice(prevEnd, arr.index)) ?? flightNumberIn(text);
    const departLocal = `${depDate.value}T${depTime?.value ?? "09:00"}`;
    let arriveLocal = `${arrDate.value}T${arrTime?.value ?? (depTime ? addMinutes(departLocal, 120).slice(11) : "11:00")}`;
    if (arriveLocal < departLocal) arriveLocal = addMinutes(arriveLocal, 24 * 60);
    const warnings: string[] = [];
    if (!depTime || !arrTime) warnings.push("Couldn't read both times. Check them.");
    if (!fn) warnings.push("No flight number found.");
    out.push({
      id: nextId(),
      kind: "transit",
      mode: "flight",
      carrier: airlineOf(fn),
      number: fn,
      from: dep.code,
      to: arr.code,
      departLocal,
      departTz: airportTz(dep.code, depDate.value) ?? ctx.defaultTz,
      arriveLocal,
      arriveTz: airportTz(arr.code, arrDate.value) ?? ctx.defaultTz,
      confirmation: conf,
      found: "Text",
      warnings,
    });
  }

  // Stays: a check-in date and a check-out date.
  const cin = /check[- ]?in\b[^\n]{0,60}/i.exec(text);
  const cout = /check[- ]?out\b[^\n]{0,60}/i.exec(text);
  if (cin && cout) {
    const inDate = nearest(dates, cin.index, 120, true) ?? nearest(dates, cin.index, 80);
    const outDate = nearest(dates, cout.index, 120, true) ?? nearest(dates, cout.index, 80);
    if (inDate && outDate && outDate.value > inDate.value) {
      const inTime = nearest(times, cin.index, 120, true);
      const outTime = nearest(times, cout.index, 120, true);
      const name =
        text
          .split(/\n/)
          .map((l) => l.trim())
          .find((l) => l.length > 3 && l.length < 90 && /hotel|inn\b|resort|suites|hostel|lodge|apartment|airbnb|b&b|guest ?house|palace|residence|villa|pousada|ryokan/i.test(l) && !/check[- ]?(in|out)/i.test(l)) ?? "Stay";
      out.push({
        id: nextId(),
        kind: "stay",
        name: name.replace(/^(your (stay|reservation|booking) at|reservation at|welcome to)\s*/i, "").slice(0, 200),
        address: null,
        checkInLocal: `${inDate.value}T${inTime?.value ?? "15:00"}`,
        checkOutLocal: `${outDate.value}T${outTime?.value ?? "11:00"}`,
        confirmation: conf,
        found: "Text",
        warnings: name === "Stay" ? ["Couldn't find the property name. Add it."] : [],
      });
    }
  }

  // Anything else with a date: a ticket or reservation.
  if (!out.length && dates.length) {
    const title =
      text
        .split(/\n/)
        .map((l) => l.trim())
        .find(
          (l) =>
            l.length > 3 &&
            l.length < 120 &&
            !/^(from|to|subject|date|sent|hi|hello|dear|confirmation|booking|reservation|record locator|pnr|reference|ticket (no|number)|flight\s*#|-{3,})/i.test(l) &&
            /[a-z]/i.test(l),
        ) ?? "Booking";
    const time = nearest(times, dates[0].index, 200);
    out.push({
      id: nextId(),
      kind: "activity",
      title: title.replace(/^(subject:|fw:|fwd:|re:)\s*/i, "").slice(0, 200),
      date: dates[0].value,
      time: time?.value ?? null,
      address: null,
      url: null,
      confirmation: conf,
      found: "Text",
      warnings: ["Check the name and time."],
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// HTML → text, keeping line breaks
// ---------------------------------------------------------------------------
export function htmlToText(html: string) {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h\d|table|section)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n");
}
