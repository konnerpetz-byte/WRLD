import "server-only";

import { airportByCode } from "@/features/places/airports";
import { timezoneFor } from "@/features/places/timezone";
import type { TransitMode } from "@/types/database";

import { AIRLINES, GROUND, namedFlightIn } from "./carriers";
import { type Price, priceIn } from "./price";
import { mergeTravelers, type Travelers, travelersInJsonLd, travelersInText } from "./travelers";

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
  /** Price the file shows for this booking (cash part; points for award tickets). */
  cost?: number | null;
  currency?: string | null;
  points?: number | null;
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
  const text = html ? htmlToText(html) : (input.text ?? "");
  if (!out.length && text.trim()) out.push(...fromText(text, ctx));
  const list = dropSummaries(dedupe(out));
  // The booking's total, from structured data or a labeled total in the text.
  const ld = html ? jsonLdBlocks(html).find((b) => Number(b.totalPrice) > 0) : undefined;
  const price = ld ? { amount: Number(ld.totalPrice), currency: typeof ld.priceCurrency === "string" ? ld.priceCurrency : null, points: null } : text.trim() ? priceIn(text.slice(0, 200_000)) : null;
  return price ? withPrice(list, price) : list;
}

/**
 * Puts the booking's total on the booking. A confirmation's total covers everything in it, so it
 * goes on the first flight of an itinerary (the budget then counts it once) or on the one stay.
 * Files that mix flights and stays are left for the traveler to price.
 */
export function withPrice(list: ImportCandidate[], price: Price): ImportCandidate[] {
  if (price.amount == null && price.points == null) return list;
  const legs = list.filter((c) => c.kind === "transit");
  const stays = list.filter((c) => c.kind === "stay");
  const target = legs.length && !stays.length ? legs[0] : stays.length === 1 && !legs.length ? stays[0] : null;
  if (!target) return list;
  return list.map((c) =>
    c !== target
      ? c
      : {
          ...c,
          cost: price.amount,
          currency: price.currency,
          points: price.points,
          warnings: legs.length > 1 ? [...c.warnings, "The price shown covers the whole booking (every flight and traveler)."] : c.warnings,
        },
  );
}

/** Who's on the reservation: names and a head count, from structured data and the text. */
export function travelersIn(input: { text?: string | null; html?: string | null }): Travelers {
  const html = input.html ?? (input.text && /<\/?[a-z][\s\S]*>/i.test(input.text) ? input.text : null);
  const fromLd = html ? travelersInJsonLd(jsonLdBlocks(html)) : { names: [], count: null };
  const text = html ? htmlToText(html) : (input.text ?? "");
  return mergeTravelers(fromLd, travelersInText(squeeze(text).slice(0, 200_000)));
}

/**
 * Connecting itineraries often repeat the whole journey as a summary
 * ("DTW → LIS") above the real legs (DTW → EWR, EWR → LIS). Drop a leg when
 * two other legs chain from its origin to its destination around the same day
 * and it has no flight number of its own.
 */
function dropSummaries(list: ImportCandidate[]) {
  const legs = list.filter((c): c is ImportCandidate & ImportLeg => c.kind === "transit");
  const day = (c: ImportLeg) => Date.parse(c.departLocal.slice(0, 10));
  return list.filter((c) => {
    if (c.kind !== "transit") return true;
    const chained = legs.some(
      (a) =>
        a !== c &&
        a.from === c.from &&
        Math.abs(day(a) - day(c)) <= 86_400_000 &&
        legs.some((b) => b !== c && b !== a && b.from === a.to && b.to === c.to && day(b) >= day(a) && day(b) - day(a) <= 2 * 86_400_000),
    );
    return !(chained && (!c.number || legs.some((a) => a !== c && a.number === c.number)));
  });
}

function dedupe(list: ImportCandidate[]) {
  // One per leg (route + day), stay or ticket; when two readings disagree, keep the one with fewer things to check.
  const best = new Map<string, ImportCandidate>();
  const order: string[] = [];
  for (const c of list) {
    const key =
      c.kind === "transit"
        ? `t|${c.from.toLowerCase()}|${c.to.toLowerCase()}|${c.departLocal.slice(0, 10)}`
        : c.kind === "stay"
          ? `s|${c.name.toLowerCase()}|${c.checkInLocal.slice(0, 10)}`
          : `a|${c.title.toLowerCase()}|${c.date}`;
    const prev = best.get(key);
    if (!prev) {
      best.set(key, c);
      order.push(key);
    } else if (c.warnings.length < prev.warnings.length) best.set(key, c);
  }
  return order.map((k) => best.get(k)!);
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
          // Packages of reservations (a trip with several flights, or a flight per passenger).
          for (const k of ["subReservation", "reservations", "itemListElement"]) if (o[k]) walk(o[k]);
          // One reservation listing several flights: split into one reservation per flight.
          if (Array.isArray(o.reservationFor)) {
            for (const leg of o.reservationFor as unknown[]) if (obj(leg)) blocks.push({ ...o, reservationFor: leg });
            return;
          }
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
// Also "DTW 8h 15m MUC" (airline apps print the flight time between the codes).
const PAIR_RE = () =>
  /\b([A-Z]{3})\b(?:[ \t]*(?:→|->|–|—|-|to|›|>|\/)[ \t]*|[ \t]{2,3}|[ \t]*\n[ \t]*|[ \t]+\d{1,2}[ \t]?h(?:[ \t]?\d{1,2}[ \t]?m)?[ \t]+)\b([A-Z]{3})\b/g;
// Codes in parentheses after city names: "Zürich, CH (ZRH) Montreal, QC, CA (YUL)", "(ZRH - Kloten)\nto Detroit, MI, US (DTW)".
const PAREN_PAIR_RE = () => /\(([A-Z]{3})(?:[ \t]*[-–][^)\n]{0,25})?\)([^()\n]{0,50}\n?[^()\n]{0,50}?)\(([A-Z]{3})(?:[ \t]*[-–][^)\n]{0,25})?\)/g;

/** Every from/to airport pair written in the text, in order. */
function pairMatches(text: string) {
  const plain = [...text.matchAll(PAIR_RE())].map((m) => ({ from: m[1], to: m[2], index: m.index!, end: m.index! + m[0].length }));
  const paren = [...text.matchAll(PAREN_PAIR_RE())]
    // Two parenthesized codes separated by place names, not by a sentence.
    .filter((m) => !/[.!?:;]|\b(?:and|or|via|flight|operated)\b/i.test(m[2]))
    .map((m) => ({ from: m[1], to: m[3], index: m.index!, end: m.index! + m[0].length }));
  const chains = chainLines(text);
  return [...plain, ...paren.filter((q) => !plain.some((p) => p.index < q.end && q.index < p.end))]
    .filter((p) => !chains.some(([a, b]) => p.index >= a && p.index < b))
    .sort((a, b) => a.index - b.index);
}

const isAirport = (c: string) => !NOT_AIRPORTS.has(c) && !!airportByCode(c);

/**
 * Lines naming three or more airports ("ZRH > YUL > DTW") are a whole itinerary
 * (an app's route banner), not one flight, so no leg is read from them.
 */
function chainLines(text: string): [number, number][] {
  const out: [number, number][] = [];
  let at = 0;
  for (const line of text.split("\n")) {
    const codes = new Set([...line.matchAll(/\b[A-Z]{3}\b/g)].map((m) => m[0]).filter(isAirport));
    if (codes.size >= 3 && line.replace(/\b[A-Z]{3}\b|[\s>›→\-–—|/•·]/g, "").length <= 6) out.push([at, at + line.length]);
    at += line.length + 1;
  }
  return out;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  // French, Spanish, Portuguese, Italian, German (rail and European airline confirmations)
  janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, août: 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12, decembre: 12,
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  janeiro: 1, fevereiro: 2, março: 3, marco: 3, maio: 5, junho: 6, julho: 7, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
  gennaio: 1, febbraio: 2, aprile: 4, maggio: 5, giugno: 6, luglio: 7, settembre: 9, ottobre: 10,
  januar: 1, februar: 2, märz: 3, maerz: 3, juni: 6, juli: 7, oktober: 10, dezember: 12,
};
const NOT_AIRPORTS = new Set(["THE", "AND", "FOR", "YOU", "ARE", "PNR", "USD", "EUR", "GBP", "CAD", "GMT", "UTC", "EST", "PST", "CST", "MST", "EDT", "PDT", "CET", "TAX", "FEE", "VAT", "NEW", "ALL", "ONE", "TWO", "OUT", "NOT", "PER", "VIA", "AIR", "BAG", "MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN", "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC", "CAN", "BUT", "HAS", "HER", "HIS", "ITS", "OUR", "ADD", "GET", "SEE", "AGE", "ANY", "BOX", "DAY", "END", "FEW", "OFF", "OLD", "OWN", "RUN", "SET", "TOP", "USE", "WAY", "WHO", "WHY", "YES", "ROW", "ARR", "DEP", "SEC", "MIN", "HRS", "HOW", "NOW", "LOG", "APP", "WEB", "MAP", "FAQ", "BIZ", "ECO", "CAB", "SKY", "KEY", "PIN", "QTY", "REF", "ETA", "ETD", "STD", "STA", "LHS", "RHS", "ADT", "CHD", "INF", "TKT"]);

type Hit = { index: number; value: string };

export function datesIn(text: string, year: number): Hit[] {
  const hits: Hit[] = [];
  const pad = (n: number) => String(n).padStart(2, "0");
  const ok = (y: number, m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2000 && y < 2100;
  for (const m of text.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)) {
    if (ok(+m[1], +m[2], +m[3])) hits.push({ index: m.index!, value: `${m[1]}-${m[2]}-${m[3]}` });
  }
  for (const m of text.matchAll(/\b([A-Za-zÀ-ÿ]{3,10})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d{2}))?\b/g)) {
    const mo = MONTHS[m[1].toLowerCase()];
    if (mo && ok(+(m[3] ?? year), mo, +m[2])) hits.push({ index: m.index!, value: `${m[3] ?? year}-${pad(mo)}-${pad(+m[2])}` });
  }
  for (const m of text.matchAll(/\b(\d{1,2})(?:st|nd|rd|th|er|º|°)?\.?\s+(?:de\s+)?([A-Za-zÀ-ÿ]{3,10})\.?,?(?:\s+(?:de\s+)?(20\d{2}))?(?![A-Za-zÀ-ÿ])/g)) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (mo && ok(+(m[3] ?? year), mo, +m[1])) hits.push({ index: m.index!, value: `${m[3] ?? year}-${pad(mo)}-${pad(+m[1])}` });
  }
  // European day.month.year: "14.05.2027"
  for (const m of text.matchAll(/\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\b/g)) {
    if (ok(+m[3], +m[2], +m[1])) hits.push({ index: m.index!, value: `${m[3]}-${pad(+m[2])}-${pad(+m[1])}` });
  }
  for (const m of text.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2}|\d{2})\b/g)) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    if (ok(y, +m[1], +m[2])) hits.push({ index: m.index!, value: `${y}-${pad(+m[1])}-${pad(+m[2])}` });
  }
  return hits.sort((a, b) => a.index - b.index);
}

function timesIn(text: string): Hit[] {
  const hits: Hit[] = [];
  // "6:05 PM", "6 p.m.", "6:00a" (JetBlue), "18:30", "08h01" (French). "18:30 Amsterdam" is 24-hour, not "a.m.".
  for (const m of text.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s?m\.?(?![a-z])|\b(\d{1,2}):(\d{2})([ap])(?![a-z])|\b([01]?\d|2[0-3])[:h]([0-5]\d)\b(?!\s*[ap]\.?m(?![a-z]))/gi)) {
    let h: number;
    let min: number;
    if (m[3] || m[6]) {
      const hour = +(m[1] ?? m[4]);
      h = (hour % 12) + ((m[3] ?? m[6]).toLowerCase() === "p" ? 12 : 0);
      min = +(m[2] ?? m[5] ?? 0);
      if (hour > 12) continue;
    } else {
      h = +m[7];
      min = +m[8];
    }
    hits.push({ index: m.index!, value: `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}` });
  }
  return hits;
}

/** Airlines that print their ICAO prefix instead ("EZY8915" is easyJet U2 8915). */
const ICAO_PREFIX: Record<string, string> = { EZY: "U2", EJU: "U2", EZS: "U2", RYR: "FR", BAW: "BA", DLH: "LH", AFR: "AF", KLM: "KL", UAL: "UA", AAL: "AA", DAL: "DL", WZZ: "W6", VLG: "VY" };

const PNR_WORDS = new Set(["CHANGE", "CANCEL", "MANAGE", "DETAIL", "SELECT", "REVIEW", "UPDATE", "TRAVEL", "FLIGHT", "BOOKED", "ACTIVE", "STATUS", "TICKET", "RETURN", "UNITED", "ALASKA", "QANTAS", "CHECKS", "BOARDS", "ONTIME", "DELAYS", "DIRECT", "NONSTOP", "PRIORITY", "SKYMIL", "MEMBER", "GROUPS", "ZONE", "ARRIVE", "DEPART", "EXPLORE", "ACCOUNT", "TRIPS"]);

type FlightHit = { number: string; index: number; end: number };

/**
 * Flight numbers in the text, in order. Labeled ones ("Flight# DL0022", "Flight: UA 958") may use any
 * code; unlabeled ones must be a known airline's (so "XY 2" from an app's menu bar isn't a flight).
 * Screenshots read zeros as the letter O ("DLO022"), so O counts as a digit after a known code.
 */
function flightHits(text: string): FlightHit[] {
  const out: FlightHit[] = [];
  const icao = /\b(EZY|EJU|EZS|RYR|BAW|DLH|AFR|KLM|UAL|AAL|DAL|WZZ|VLG)\s?(\d{1,4})\b/g;
  for (const m of text.matchAll(icao)) out.push({ number: `${ICAO_PREFIX[m[1]]} ${Number(m[2])}`, index: m.index!, end: m.index! + m[0].length });
  const found = [
    ...[...text.matchAll(/\bflight\s*(?:#|no\.?|number)?\s*:?\s*([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?([\dO]{1,4})\b/gi)].map((m) => ({ m, labeled: true })),
    ...[...text.matchAll(/\b(?!AM\b|PM\b)([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?([\dO]{1,4})\b/g)].map((m) => ({ m, labeled: false })),
    // An app's airline logo read as a character stuck to the number ("1LX086"); known two-letter codes only.
    ...[...text.matchAll(/(?<![A-Za-z0-9])[0-9|!l]([A-Z]{2})([\dO]{2,4})\b/g)].map((m) => ({ m, labeled: false })),
  ];
  for (const { m, labeled } of found) {
    const code = m[1].toUpperCase();
    const raw = m[2].toUpperCase();
    if (!labeled && !AIRLINES[code]) continue;
    if (raw.includes("O") && (!AIRLINES[code] || !/\d/.test(raw))) continue;
    // Aircraft, not flights: "Airbus A330-200", "Boeing 787", "A321neo".
    const before = text.slice(Math.max(0, m.index! - 12), m.index!);
    const after = text.slice(m.index! + m[0].length, m.index! + m[0].length + 4);
    if (/(airbus|boeing|embraer|bombardier|aircraft|airplane|plane)\s*$/i.test(before) || /^(-\d|neo|ceo|max)/i.test(after)) continue;
    const n = String(Number(raw.replace(/O/g, "0")));
    if (n === "0") continue;
    const index = m.index! + m[0].length - m[1].length - m[2].length - (/\s/.test(m[0].slice(-m[2].length - 1, -m[2].length)) ? 1 : 0);
    if (!out.some((h) => h.index <= index && index < h.end)) out.push({ number: `${code} ${n}`, index, end: m.index! + m[0].length });
  }
  return out.sort((a, b) => a.index - b.index);
}

function flightNumberIn(text: string): string | null {
  // A labeled number wins over an unlabeled one earlier in the text.
  const hits = flightHits(text);
  const labeled = /\bflight\s*(?:#|no\.?|number)?\s*:?\s*/i.exec(text);
  const pick = (labeled && hits.find((h) => h.index >= labeled.index && h.index <= labeled.index + labeled[0].length + 1)) || hits[0];
  return pick?.number ?? namedFlightIn(text);
}

/** Airline name for a flight number, so imported legs read "Delta DL 22" (see carriers.ts). */
const airlineOf = (flight: string | null) => (flight ? (AIRLINES[flight.split(" ")[0]] ?? null) : null);

/** OCR reads "ü" as "ii" ("Miinchen", "Ziirich", "Diisseldorf"). */
const fixUmlauts = (s: string) => s.replace(/\b([A-Z])ii(?=[a-z]{2})/g, "$1ü").replace(/([a-z])B(e\b|en\b)/g, "$1ß$2");

// Generic words, plus chain names that often stand alone ("Hilton Zurich Airport", "Courtyard Munich City Center").
const STAY_WORDS =
  /hotel|inn\b|resort|suites|hostel|lodge|apartment|airbnb|b&b|guest ?house|palace|residence|villa|pousada|ryokan|\b(hilton|hampton|doubletree|conrad|waldorf|marriott|courtyard|sheraton|westin|renaissance|ritz-carlton|st\. regis|aloft|moxy|hyatt|andaz|kimpton|holiday inn|crowne plaza|intercontinental|indigo|novotel|ibis|sofitel|mercure|pullman|fairmont|radisson|best western|wyndham|ramada|four seasons|mandarin oriental|shangri-la|motel one|premier inn|travelodge|nh collection|melia|meliá|accor|mövenpick|movenpick|steigenberger|scandic|citizenm|ace hotel|the standard)\b/i;
// App buttons and menu rows that name the hotel generically.
const NOT_STAY_NAME = /check[- ]?(in|out)|booking|reservation|room\b|details|guide|policies|information|info\b|benefits|amenities|directions|contact|>|floor ?plan|honors|bonvoy|rewards|points/i;

/** The property's name: the line under "Where?" / "Property:" first, else the first line naming a hotel (not a lone logo word like "HOTELS"). */
function stayName(text: string): string | null {
  const lines = text.split(/\n/).map((l) => l.trim());
  const clean = (l: string) => fixUmlauts(l.replace(/^(your (stay|reservation|booking) at|reservation at|welcome to)\s*/i, "")).slice(0, 200);
  for (let i = 0; i < lines.length; i++) {
    // A heading on its own ("Where?") or with a colon ("Property: Hotel X"); not "property's local time".
    const head = /^(where\??|property|hotel|accommodation|your hotel|your stay|unterkunft)\s*(?::\s*(.*))?$/i.exec(lines[i]);
    if (!head) continue;
    const next = head[2]?.trim() || lines.slice(i + 1, i + 3).find(Boolean) || "";
    if (next.length > 3 && next.length < 90 && /[a-z]/i.test(next) && !/\d{3,}|:/.test(next)) return clean(next);
  }
  const line = lines.find(
    (l) => l.length > 3 && l.length < 90 && STAY_WORDS.test(l) && /\S+\s+\S+/.test(l) && !NOT_STAY_NAME.test(l),
  );
  return line ? clean(line) : null;
}

/**
 * An address line without an "Address:" label: a street number and a postal code with a comma
 * ("Landshuter Allee 174, 80637 München, Germany", "350 5th Ave, New York, NY 10118").
 * Prefers the line right after the property name.
 */
function streetLine(text: string, name: string | null): string | null {
  const lines = text.split(/\n/).map((l) => l.trim());
  const looks = (l: string) =>
    l.length > 8 &&
    l.length < 120 &&
    l.includes(",") &&
    /\b\d{1,5}[a-z]?\b/i.test(l) &&
    (/\b\d{4,5}\b/.test(l) || /\b[A-Z]{2}\s+\d{5}\b/.test(l) || /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/.test(l)) &&
    /[A-Za-zÀ-ÿ]{3,}/.test(l) &&
    !/\b(eur|usd|gbp|chf|total|price|tel|phone|booking|confirmation|guests?|adults?|room)\b|[€$£]|\d{1,2}[:.]\d{2}\s*(?:am|pm|[ap]\.m\.)|\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/i.test(l) &&
    // Not a date line ("Sat, May 29, 2027 Sun, May 30, 2027"): the year looks like a postal code.
    !/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b|\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b|\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*,/i.test(l);
  const at = name ? lines.findIndex((l) => fixUmlauts(l).includes(name)) : -1;
  const pick = (at >= 0 ? lines.slice(at + 1, at + 4).find(looks) : undefined) ?? lines.find(looks);
  return pick ? fixUmlauts(pick).replace(/[.\s]+$/, "").slice(0, 300) : null;
}

/**
 * "Address: Line-Eid-Str. 2, 78467" with the city on the next line ("Konstanz, Germany").
 * The next line joins only when it reads like more address, not a new label ("Phone: …").
 */
export function addressIn(text: string): string | null {
  const m = /^[^\S\n]*(?:address|property address|hotel address|adresse|anschrift|direcci[oó]n|indirizzo|endere[cç]o)[^\S\n]*:[^\S\n]*([^\n]*)(?:\n([^\n]*))?/im.exec(text);
  if (!m) return null;
  // Booking.com grids put the check-in/out day numbers at the end of the line ("… 5020 20 2 3 1 3").
  let addr = m[1].replace(/(?:\s+(?:\d{1,2}\s+){2,7}\d{1,2})\s*$/, "").trim();
  // …and the month and weekday columns at the end of the next one ("Salzburg, Austria MAY MAY").
  const next = (m[2] ?? "")
    .replace(/(?:\s+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEPT?|OCT|NOV|DEC|\d{1,2}|(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day))+\s*$/, "")
    .trim();
  if (next && next.length <= 80 && !/:/.test(next) && /[A-Za-zÀ-ÿ]/.test(next) && !/^(?:phone|tel|gps|email|check|www\.|http)/i.test(next)) {
    addr = addr ? `${addr.replace(/,\s*$/, "")}, ${next}` : next;
  }
  return addr ? fixUmlauts(addr).slice(0, 300) : null;
}

/**
 * Flight cards in airline apps (Swiss, Air Canada, Delta, United…): a flight number, then the two
 * airports as big codes and/or city names (often split into columns by OCR), then "Scheduled" times.
 * Each flight number starts a card; places are matched to the airport codes seen anywhere in the text,
 * so "Montreal … Detroit" reads as YUL → DTW. Only adds flights the other readers missed.
 */
function cardLegs(text: string, ctx: Ctx, dates: Hit[], times: Hit[], conf: string | null, summary: Map<string, Hit>, found: ImportCandidate[]): ImportCandidate[] {
  const hits = flightHits(text);
  if (!hits.length) return [];
  const chains = chainLines(text);
  const inChain = (i: number) => chains.some(([a, b]) => i >= a && i < b);
  const fold = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const folded = fold(text);
  const seenCount = new Map<string, number>();
  for (const m of text.matchAll(/\b[A-Z]{3}\b/g)) if (isAirport(m[0])) seenCount.set(m[0], (seenCount.get(m[0]) ?? 0) + 1);
  const names: { re: RegExp; code: string }[] = [];
  const named = new Set<string>();
  for (const code of seenCount.keys()) {
    const a = airportByCode(code)!;
    const words = [a.city.split(/\s*[(,/]/)[0], a.name.replace(/\b(international|intl|airport|aeroporto|aeropuerto|flughafen|a[ée]roport)\b.*$/i, "").split(/\s*[/,(-]/)[0]];
    for (const w of new Set(words.map((x) => fold(x).trim()).filter((x) => x.length >= 4))) {
      const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
      names.push({ re, code });
      if (re.test(folded)) named.add(code);
      re.lastIndex = 0;
    }
  }
  // A code counts on a card only if something backs it up: its city is named, or it appears twice
  // (OCR noise like "LTT" is a real airport code, but nothing else on screen points to it).
  const codes = [...seenCount.keys()].filter((c) => named.has(c) || seenCount.get(c)! >= 2);
  const out: ImportCandidate[] = [];
  hits.forEach((h, i) => {
    if (out.some((c) => c.kind === "transit" && c.number === h.number)) return;
    const end = Math.min(hits[i + 1]?.index ?? text.length, h.index + 1500);
    const places: { code: string; index: number }[] = [];
    for (const m of text.slice(h.end, end).matchAll(/\b[A-Z]{3}\b/g)) {
      const at = h.end + m.index!;
      if (codes.includes(m[0]) && !inChain(at)) places.push({ code: m[0], index: at });
    }
    for (const { re, code } of names) {
      for (const m of folded.slice(h.end, end).matchAll(re)) if (!inChain(h.end + m.index!)) places.push({ code, index: h.end + m.index! });
    }
    places.sort((a, b) => a.index - b.index);
    const from = places[0]?.code;
    const to = places.find((p) => p.code !== from)?.code;
    if (!from || !to) return;
    const ts = times.filter((t) => t.index > h.end && t.index < end);
    const departTime = ts[0]?.value ?? null;
    let arriveTime = ts[1]?.value ?? null;
    // Flight length on the card ("1h 55m"; OCR may read the 1 as T, l or I).
    // Not a connection or layover ("Connection: 2h 42m").
    const dur = /(?:^|[^\w])(\d{1,2}|[TlI])\s?h(?:rs?)?\s?(\d{1,2})\s?m(?:in)?\b/.exec(
      text.slice(h.end, end).replace(/^.*\b(connection|connecting|layover|lay-over|stopover|change planes|transfer)\b.*$/gim, ""),
    );
    const minutes = dur ? (/\d/.test(dur[1]) ? +dur[1] : 1) * 60 + +dur[2] : null;
    // A date on the flight number's own line ("BA0238  Sun 15 Nov 2026"), else the one above the card.
    const lineStart = text.lastIndexOf("\n", h.index) + 1;
    const lineEnd = text.indexOf("\n", h.end) === -1 ? text.length : text.indexOf("\n", h.end);
    const sameLine = dates.find((d) => d.index >= lineStart && d.index < lineEnd);
    const inCard = dates.find((d) => d.index > h.end && d.index < end);
    // A date row between the number and the times belongs to this flight ("LX86 / Sun, May 30, 2027 / 12:40 PM").
    const dateRow = inCard && ts[0] && inCard.index < ts[0].index ? inCard : undefined;
    const before = sameLine ?? dateRow ?? dates.filter((d) => d.index < h.index && h.index - d.index < 400).at(-1);
    let date = before ?? inCard;
    if (!date) return;
    let day = date.value;
    const s = departTime && arriveTime ? summary.get(`${departTime}-${arriveTime}`) : undefined;
    if (s) day = s.value;
    else if (!before && inCard && ts[1] && inCard.index > ts[1].index && arriveTime! < departTime!) day = addMinutes(`${day}T00:00`, -24 * 60).slice(0, 10);
    date = { ...date, value: day };
    const departLocal = `${day}T${departTime ?? "09:00"}`;
    const warnings: string[] = [];
    // When the arrival is missing or doesn't fit the flight length (a dropped "PM"), work it out
    // from the departure, the length and the two airports' time zones.
    if (departTime && minutes) {
      const fromTz = airportTz(from, day);
      const toTz = airportTz(to, day);
      if (fromTz && toTz) {
        const offset = (tz: string) => {
          const probe = new Date(`${day}T12:00:00Z`);
          return (Date.parse(`${utcToLocal(probe, tz)}:00Z`) - probe.getTime()) / 60_000;
        };
        const expected = addMinutes(departLocal, minutes - offset(fromTz) + offset(toTz));
        const read = arriveTime ? (arriveTime < departTime ? addMinutes(`${day}T${arriveTime}`, 24 * 60) : `${day}T${arriveTime}`) : null;
        const gap = (x: string, shift: number) => Math.abs(Date.parse(`${x}:00Z`) + shift * 3_600_000 - Date.parse(`${expected}:00Z`)) / 60_000;
        // Only fill a missing arrival, or fix one exactly 12 hours off (a dropped "PM").
        if (!read || (gap(read, 0) > 30 && (gap(read, 12) <= 30 || gap(read, -12) <= 30))) {
          arriveTime = expected.slice(11);
          warnings.push("Arrival time worked out from the flight length. Check it.");
        }
      }
    }
    const arriveDay = departTime && arriveTime && arriveTime < departTime ? addMinutes(`${day}T00:00`, 24 * 60).slice(0, 10) : day;
    const arriveLocal = arriveTime ? `${arriveDay}T${arriveTime}` : addMinutes(departLocal, 120);
    if (!departTime || !arriveTime) warnings.push("Couldn't read both times. Check them.");
    out.push({
      id: nextId(),
      kind: "transit",
      mode: "flight",
      carrier: airlineOf(h.number),
      number: h.number,
      from,
      to,
      departLocal,
      departTz: airportTz(from, day) ?? ctx.defaultTz,
      arriveLocal,
      arriveTz: airportTz(to, day) ?? ctx.defaultTz,
      confirmation: conf,
      found: "Text",
      warnings,
    });
  });
  // Reconcile with what the other readers found. A card shows its own number, route and times
  // together, so it is trusted over a reader that attached a number from a neighboring card.
  const legs = (xs: ImportCandidate[]) => xs.filter((c): c is ImportCandidate & ImportLeg => c.kind === "transit");
  const cards = legs(out);
  // 1. A number another reader put on a different route than its card shows: that leg is misattributed.
  for (const c of cards) {
    for (let i = found.length - 1; i >= 0; i--) {
      const o = found[i];
      if (o.kind === "transit" && o.number === c.number && (o.from !== c.from || o.to !== c.to)) found.splice(i, 1);
    }
  }
  const day = (x: string) => Date.parse(`${x.slice(0, 10)}T00:00Z`);
  const kept: ImportCandidate[] = [];
  for (const c of cards) {
    // 2. Already read with this number on this route: keep the other reader's (it has more context, like dates in an email).
    if (legs(found).some((o) => o.number === c.number && o.from === c.from && o.to === c.to)) continue;
    // 3. Same route within a day under no number or another number: the card's reading replaces it.
    const i = found.findIndex((o) => o.kind === "transit" && o.from === c.from && o.to === c.to && o.number !== c.number && Math.abs(day(o.departLocal) - day(c.departLocal)) <= 86_400_000);
    if (i >= 0) found.splice(i, 1);
    kept.push(c);
  }
  return kept;
}

function confirmationIn(text: string): string | null {
  // Booking.com and some hotels group digits: "CONFIRMATION NUMBER: 6697.906.063"
  const grouped = /\b(?:confirmation|booking|reservation)\s*(?:number|no\.?|#)\s*[:#]?\s*(\d{3,4}(?:[. ]\d{3}){2,3})\b/i.exec(text);
  if (grouped) return grouped[1].replace(/[. ]/g, "");
  // "Confirmation # | HQRTPB" (Delta app), "Booking code: X7K2PQ", "Record locator ABC123"
  const re = /\b(?:confirmation|booking|reservation|record locator|pnr|reference|ref\.?|buchungs(?:code|nummer)|code de r[ée]servation|r[ée]f[ée]rence(?: de r[ée]servation)?|c[óo]digo de reserva|localizador|codice (?:di )?prenotazione)(?:\s+(?:reference|number|code|no\.?|n[°º]|nr\.?|#))?[\s:#|]{0,6}([A-Za-z0-9]{5,12})\b/gi;
  for (const m of text.matchAll(re)) {
    const code = m[1];
    // Real codes are capitals and/or digits ("K4ZP9Q", "4521889"), not words ("reference").
    if (code === code.toUpperCase() && (/\d/.test(code) || /^[A-Z]{5,}$/.test(code)) && !/^(NUMBER|CODE)$/.test(code)) return code;
  }
  // Apps that show the booking code alone beside the route (Swiss, Lufthansa, Air Canada: "BRNUBA ⧉"):
  // a line that is just a six-character code. Only for flights, and never a word or airline name.
  if (/\b[A-Z]{3}\b[^\n]{0,40}\b[A-Z]{3}\b/.test(text)) {
    for (const m of text.matchAll(/^[^A-Za-z0-9\n]{0,3}([A-Z][A-Z0-9]{5})(?:[ \t]+\S{1,2})?[ \t]*$/gm)) {
      const code = m[1];
      if (PNR_WORDS.has(code) || Object.values(AIRLINES).some((n) => n.toUpperCase() === code)) continue;
      // Not a flight number ("AC8583", "DLO022").
      const fl = /^([A-Z]{2}|[A-Z]\d|\d[A-Z])([\dO]{1,4})$/.exec(code);
      if (fl && AIRLINES[fl[1]] && /\d/.test(fl[2])) continue;
      return code;
    }
  }
  return null;
}

function airportPair(text: string): { from: string; to: string; index: number } | null {
  for (const { from: a, to: b, index } of pairMatches(text)) {
    if (a === b || NOT_AIRPORTS.has(a) || NOT_AIRPORTS.has(b)) continue;
    if (airportByCode(a) && airportByCode(b)) return { from: a, to: b, index };
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
  const pairs = pairMatches(text).filter((p) => p.from !== p.to && !NOT_AIRPORTS.has(p.from) && !NOT_AIRPORTS.has(p.to) && airportByCode(p.from) && airportByCode(p.to));
  const seen = new Set<string>();
  // Screenshots split one flight across images, so its number can be far from the route. When the
  // whole text names exactly one flight number, it belongs to every leg missing one.
  const numbers = new Set(text.split("\n").map((l) => flightNumberIn(l.replace(/\b[A-Z]{3}\b/g, ""))).filter(Boolean));
  const onlyFlightNumber = numbers.size === 1 ? [...numbers][0] : null;
  // Summary lines give the departure date with both times: "Sun, May 16 | 4:40pm - 6:55am".
  const summary = new Map<string, Hit>();
  for (const d of dates) {
    const ls = text.lastIndexOf("\n", d.index) + 1;
    const le = text.indexOf("\n", d.index) === -1 ? text.length : text.indexOf("\n", d.index);
    const ts = times.filter((t) => t.index > d.index && t.index < le && t.index >= ls);
    if (ts.length >= 2 && !summary.has(`${ts[0].value}-${ts[1].value}`)) summary.set(`${ts[0].value}-${ts[1].value}`, d);
  }
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
      // A date heading above several legs ("Depart: Thursday, December 17") applies to all of them.
      dates.filter((d) => d.index < p.index && p.index - d.index < 1500).at(-1) ??
      segDates.find((d) => d.index > p.end) ??
      nearest(dates, p.index, 400);
    if (!date) return;
    const key = `${p.from}${p.to}${date.value}`;
    if (seen.has(key)) return;
    seen.add(key);

    // Flight number: on the same line first, then anywhere in the segment.
    const strip = (s: string) => s.replace(new RegExp(`\\b(${p.from}|${p.to})\\b`, "g"), "");
    const fn = flightNumberIn(strip(text.slice(lineStart, lineEnd))) ?? flightNumberIn(strip(text.slice(segStart, segEnd))) ?? onlyFlightNumber;

    // Times: the ones after the pair first (depart, then arrive); else the ones before it.
    // Column layouts (United receipts) put a row of two times directly above the airports row.
    const after = times.filter((t) => t.index >= p.end && t.index < segEnd);
    const before = times.filter((t) => t.index >= segStart && t.index < p.index);
    const prevLineStart = text.lastIndexOf("\n", lineStart - 2) + 1;
    const rowAbove = before.filter((t) => t.index >= prevLineStart && t.index < lineStart);
    const onLine = times.filter((t) => t.index >= lineStart && t.index < lineEnd);
    const near =
      rowAbove.length === 2 && !onLine.length ? rowAbove : after.length >= 2 ? after : [...before.slice(-(2 - after.length)), ...after];
    const departTime = near[0]?.value ?? null;
    const arriveTime = near[1]?.value ?? null;
    let day = date.value;
    const fromSummary = departTime && arriveTime ? summary.get(`${departTime}-${arriveTime}`) : undefined;
    if (fromSummary) day = fromSummary.value;
    // App cards print the arrival date under the arrival time, between the times and the airports
    // ("4:40pm  6:55am / Mon, May 17 / DTW 8h 15m MUC"): that date is the arrival, so overnight flights left the day before.
    else if (near[1] && date.index > near[1].index && date.index < p.index && arriveTime && departTime && arriveTime < departTime) day = addMinutes(`${date.value}T00:00`, -24 * 60).slice(0, 10);
    const dayKey = `${p.from}${p.to}${day}`;
    if (day !== date.value) {
      if (seen.has(dayKey)) return;
      seen.add(dayKey);
    }
    const departTz = airportTz(p.from, day) ?? ctx.defaultTz;
    const arriveTz = airportTz(p.to, day) ?? ctx.defaultTz;
    const departLocal = `${day}T${departTime ?? "09:00"}`;
    let arriveLocal = arriveTime ? `${day}T${arriveTime}` : addMinutes(departLocal, 120);
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

  // Itineraries that list each stop on its own (or each leg on one line):
  //   5:05pm Detroit (DTW) - 7:20am Newark (EWR)   United 1022
  //   DTW 6:05 AM / ORD 6:58 AM, with connections and layovers between.
  // Airline-app flight cards: everything about a flight sits between its number and the next one.
  out.push(...cardLegs(text, ctx, dates, times, conf, summary, out));

  // Skip legs already read above at the same clock times within a day (an app card read twice,
  // once with its arrival date).
  const near1Day = (a: string, b: string) => Math.abs(Date.parse(`${a.slice(0, 10)}T00:00Z`) - Date.parse(`${b.slice(0, 10)}T00:00Z`)) <= 86_400_000;
  out.push(
    ...fromStopEvents(text, ctx, dates, times, conf).filter(
      (s) =>
        s.kind !== "transit" ||
        !out.some((o) => o.kind === "transit" && o.from === s.from && o.to === s.to && o.departLocal.slice(11) === s.departLocal.slice(11) && near1Day(o.departLocal, s.departLocal)),
    ),
  );

  // Trains, buses and ferries written as text (when no flights were found).
  if (!out.some((c) => c.kind === "transit")) out.push(...fromGroundText(text, ctx, dates, times, conf));

  // Stays: a check-in date and a check-out date.
  const grid = bookingGridStay(text, ctx, times, conf);
  if (grid) out.push(grid);
  const cin = /check[- ]?in\b[^\n]{0,60}/i.exec(text);
  const cout = /check[- ]?out\b[^\n]{0,60}/i.exec(text);
  // Hotels that write "Arrival: 17.5.2027 / Departure: 20.5.2027" (Meininger, many direct bookings).
  // Only when no flight or train was found, since those use the same words.
  const hotelish = !out.some((c) => c.kind === "transit") && /\b(hotel|hostel|room|guests?|check[- ]?in|stay|night)\b/i.test(text);
  const labeled = (re: RegExp) => {
    for (const m of text.matchAll(re)) {
      const end = m.index! + m[0].length;
      const lineEnd = text.indexOf("\n", end) === -1 ? text.length : text.indexOf("\n", end);
      const d = dates.find((h) => h.index >= end && h.index < Math.min(lineEnd, end + 40));
      if (d) return d;
    }
    return null;
  };
  const inLabel = /\b(?:check[- ]?in|arrival|arriving|arrive|anreise|ankunft|llegada|arriv[ée]e)(?:[ \t]+date)?[ \t]*:?[ \t]*/gi;
  const outLabel = /\b(?:check[- ]?out|departure|departing|depart|abreise|salida|d[ée]part)(?:[ \t]+date)?[ \t]*:?[ \t]*/gi;
  const inLabeled = hotelish ? labeled(inLabel) : labeled(/\bcheck[- ]?in(?:[ \t]+date)?[ \t]*:?[ \t]*/gi);
  const outLabeled = hotelish ? labeled(outLabel) : labeled(/\bcheck[- ]?out(?:[ \t]+date)?[ \t]*:?[ \t]*/gi);
  if (!grid && ((cin && cout) || (inLabeled && outLabeled))) {
    // Side-by-side columns (Hilton, Marriott, IHG apps): "Check In   Check Out" on one line, then
    // both dates on the next line and both times on the one after. Left is check-in, right is check-out.
    const sideBySide = cin && cout && cout.index > cin.index && !text.slice(cin.index, cout.index).includes("\n");
    const colDates = sideBySide ? dates.filter((d) => d.index > cout.index && d.index < cout.index + 300).slice(0, 2) : [];
    const columns = colDates.length === 2 ? colDates : null;
    const colTimes = columns ? times.filter((t) => t.index > columns[1].index && t.index < columns[1].index + 120).slice(0, 2) : [];
    const inDate = columns?.[0] ?? inLabeled ?? (cin ? (nearest(dates, cin.index, 120, true) ?? nearest(dates, cin.index, 80)) : null);
    const outDate = columns?.[1] ?? outLabeled ?? (cout ? (nearest(dates, cout.index, 120, true) ?? nearest(dates, cout.index, 80)) : null);
    if (inDate && outDate && outDate.value > inDate.value) {
      // Times on the check-in/out lines ("Check-in: From 3 p.m."), else right after the dates.
      const onLine = (m: RegExpExecArray | null) => (m ? times.find((t) => t.index >= m.index && t.index < m.index + m[0].length) : undefined);
      const inTime = (colTimes.length === 2 ? colTimes[0] : undefined) ?? onLine(cin) ?? (cin ? nearest(times, cin.index, 120, true) : null);
      const outTime = (colTimes.length === 2 ? colTimes[1] : undefined) ?? onLine(cout) ?? (cout ? nearest(times, cout.index, 120, true) : null);
      const name = stayName(text);
      out.push({
        id: nextId(),
        kind: "stay",
        name: name ?? "Stay",
        address: addressIn(text) ?? streetLine(text, name),
        checkInLocal: `${inDate.value}T${inTime?.value ?? "15:00"}`,
        checkOutLocal: `${outDate.value}T${outTime?.value ?? "11:00"}`,
        confirmation: conf,
        found: "Text",
        warnings: name ? [] : ["Couldn't find the property name. Add it."],
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

// ---------------------------------------------------------------------------
// 3b. Stops with times: connections and layovers
// ---------------------------------------------------------------------------
type StopEvent = { code: string; time: string; index: number; lineEnd: number; date: string | null; plus1: boolean; explicitDate: boolean };

/**
 * Reads every airport that has a time beside it (same line, or the line just
 * below), in order, and pairs them up: departure, arrival, departure, arrival.
 * Handles connections (DTW → EWR, EWR → LIS), layover lines in between, both
 * stops on one line or on separate lines, and "+1" next-day arrivals.
 */
function fromStopEvents(text: string, ctx: Ctx, dates: Hit[], times: Hit[], conf: string | null): ImportCandidate[] {
  const parenCodes = [...text.matchAll(/\(([A-Z]{3})\)/g)].filter((m) => airportByCode(m[1]));
  const codeRe = parenCodes.length >= 2 ? /\(([A-Z]{3})\)/g : /\b([A-Z]{3})\b/g;
  const events: StopEvent[] = [];
  let offset = 0;
  const lines = text.split("\n");
  lines.forEach((line, li) => {
    const start = offset;
    offset += line.length + 1;
    if (/layover|connection time|stopover|change planes|total (?:travel|duration)|duration/i.test(line) && !/\d{1,2}:\d{2}\s*[ap]?/i.test(line.replace(/\b\d+\s*h(?:r|ours?)?\s*\d*\s*m(?:in)?\b/gi, ""))) return;
    const codes = [...line.matchAll(codeRe)]
      .map((m) => ({ code: m[1], index: start + m.index! }))
      .filter((c) => !NOT_AIRPORTS.has(c.code) && airportByCode(c.code));
    if (!codes.length) return;
    let lineTimes = times.filter((t) => t.index >= start && t.index < start + line.length);
    // A stop on its own line with its time on the next line ("DTW" / "6:05 AM").
    if (!lineTimes.length && codes.length === 1 && lines[li + 1] !== undefined && ![...lines[li + 1].matchAll(codeRe)].some((m) => airportByCode(m[1]))) {
      lineTimes = times.filter((t) => t.index >= offset && t.index < offset + lines[li + 1].length).slice(0, 1);
    }
    // Both places on one line, both times on the next ("Dublin (DUB) → Barcelona (BCN)" / "06:30 – 10:05").
    if (!lineTimes.length && codes.length === 2 && lines[li + 1] !== undefined && ![...lines[li + 1].matchAll(codeRe)].some((m) => airportByCode(m[1]))) {
      const next = times.filter((t) => t.index >= offset && t.index < offset + lines[li + 1].length);
      if (next.length === 2) lineTimes = next;
    }
    if (!lineTimes.length) return;
    const pick: { code: string; index: number; time: Hit }[] = [];
    if (codes.length === lineTimes.length) codes.forEach((c, k) => pick.push({ ...c, time: lineTimes[k] }));
    else if (codes.length === 1) pick.push({ ...codes[0], time: lineTimes.reduce((a, b) => (Math.abs(b.index - codes[0].index) < Math.abs(a.index - codes[0].index) ? b : a)) });
    else return; // two places, one time: can't tell which it belongs to
    for (const p of pick) {
      const onLine = dates.find((d) => d.index >= start && d.index < start + line.length);
      const before = [...dates].reverse().find((d) => d.index < p.index && p.index - d.index < 1500);
      events.push({
        code: p.code,
        time: p.time.value,
        index: p.index,
        lineEnd: start + line.length,
        date: (onLine ?? before)?.value ?? null,
        explicitDate: Boolean(onLine),
        plus1: /^\s*(?:[ap]\.?m\.?)?\s*(?:\(?\+\s?1\)?|next day)/i.test(text.slice(p.time.index + p.time.value.length - 1, p.time.index + 24).replace(/^\d/, "")),
      });
    }
  });

  const out: ImportCandidate[] = [];
  let prevEnd = 0;
  for (let i = 0; i + 1 < events.length; ) {
    const dep = events[i];
    const arr = events[i + 1];
    if (dep.code === arr.code) {
      i++;
      continue;
    }
    i += 2;
    const depDate = dep.date ?? dates[0]?.value;
    if (!depDate) continue;
    let arrDate = arr.explicitDate && arr.date ? arr.date : depDate;
    if (arr.plus1 && arrDate === depDate) arrDate = addMinutes(`${depDate}T00:00`, 24 * 60).slice(0, 10);
    const departLocal = `${depDate}T${dep.time}`;
    let arriveLocal = `${arrDate}T${arr.time}`;
    if (arriveLocal <= departLocal) arriveLocal = addMinutes(arriveLocal, 24 * 60);
    const strip = (s: string) => s.replace(new RegExp(`\\b(${dep.code}|${arr.code})\\b`, "g"), "");
    const fn =
      flightNumberIn(strip(text.slice(text.lastIndexOf("\n", dep.index) + 1, arr.lineEnd))) ??
      flightNumberIn(strip(text.slice(Math.max(prevEnd, dep.index - 300), Math.min(text.length, arr.lineEnd + 120))));
    prevEnd = arr.lineEnd;
    out.push({
      id: nextId(),
      kind: "transit",
      mode: "flight",
      carrier: airlineOf(fn),
      number: fn,
      from: dep.code,
      to: arr.code,
      departLocal,
      departTz: airportTz(dep.code, depDate) ?? ctx.defaultTz,
      arriveLocal,
      arriveTz: airportTz(arr.code, arrDate) ?? ctx.defaultTz,
      confirmation: conf,
      found: "Text",
      warnings: fn ? [] : ["No flight number found."],
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 3c. Trains, buses and ferries in text
// ---------------------------------------------------------------------------
const TIME_TOKEN = /\b\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?\b|\b(?:[01]?\d|2[0-3])[:.h][0-5]\d\b/gi;
const placeOf = (s: string) =>
  s
    .replace(TIME_TOKEN, " ")
    .replace(/\b(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?/gi, " ")
    .replace(/\b\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?\b|\b20\d{2}-\d{2}-\d{2}\b/g, " ")
    .replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:,?\s+20\d{2})?/gi, " ")
    .replace(/\b\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?(?:\s+20\d{2})?/gi, " ")
    .replace(/\b(?:platform|track|gleis|voie|coach|car|seat|wagon)\b.*$/i, " ")
    .replace(/\b(?:train|bus|ICE|IC|EC|ECE|RJX?|TGV|INOUI|OUIGO|AVE|Frecciarossa|Italo|Eurostar|Nightjet|KTX|Acela)\s*#?\s*\d{2,5}\b.*$/i, " ")
    .replace(/^[\s:\-–—|,]+|[\s:\-–—|,]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 120);

function fromGroundText(text: string, ctx: Ctx, dates: Hit[], times: Hit[], conf: string | null): ImportCandidate[] {
  const op = GROUND.find((g) => g.re.test(text));
  const keyword = /\b(train|rail|railway|station|bahnhof|gare|stazione|bus|coach|ferry|terminal|zob)\b/i.exec(text)?.[1]?.toLowerCase();
  if (!op && !keyword) return [];
  const mode: TransitMode = op?.mode ?? (/bus|coach|zob/.test(keyword ?? "") ? "bus" : /ferry/.test(keyword ?? "") ? "ferry" : "train");
  const numberRe = /\b(?:train|bus|coach|service|ICE|IC|EC|ECE|RJX?|TGV|INOUI|OUIGO|AVE|Avlo|Alvia|Frecciarossa|FR|Italo|Eurostar|Nightjet|NJ|KTX|Shinkansen|Acela|Northeast Regional|Amtrak)\s*(?:no\.?|#|number)?\s*:?\s*(\d{2,5})\b/i;

  type Stop = { place: string; time: string | null; index: number; dep: boolean; date: string | null };
  const stops: Stop[] = [];
  let offset = 0;
  for (const line of text.split("\n")) {
    const start = offset;
    offset += line.length + 1;
    // "08:01 Paris Gare du Nord → 09:30 London St Pancras" or "London Kings Cross 08:00 – Edinburgh 12:20"
    const arrow = /^(.*?\S)\s*(?:→|->|⟶|–|—|>|\bto\b)\s*(\S.*)$/i.exec(line);
    const lineTimes = times.filter((t) => t.index >= start && t.index < start + line.length);
    const date = (dates.find((d) => d.index >= start && d.index < start + line.length) ?? [...dates].reverse().find((d) => d.index < start))?.value ?? null;
    if (arrow && lineTimes.length >= 2 && !/^\s*(?:dep|arr)/i.test(line)) {
      const a = placeOf(arrow[1]);
      const b = placeOf(arrow[2]);
      if (a.length >= 3 && b.length >= 3) {
        stops.push({ place: a, time: lineTimes[0].value, index: start, dep: true, date });
        stops.push({ place: b, time: lineTimes[1].value, index: start + 1, dep: false, date });
        continue;
      }
    }
    // "Departs: London St Pancras 08:01" / "Arrival 12:40 Hamburg ZOB" / "From: … To: …"
    const lab = /^\s*(dep(?:art(?:s|ure|ing)?)?|abfahrt|départ|partenza|salida|from|origin|outbound from|arr(?:ive|ives|ival|iving)?|ankunft|arrivée|arrivo|llegada|to|destination)\b\.?\s*:?\s*(.+)$/i.exec(line);
    if (lab) {
      const place = placeOf(lab[2]);
      if (place.length < 3) continue;
      const dep = /^(dep|abf|dép|part|sal|from|orig|outb)/i.test(lab[1]);
      const time = lineTimes[0]?.value ?? times.find((t) => t.index >= start + line.length && t.index < start + line.length + 60)?.value ?? null;
      stops.push({ place, time, index: start, dep, date });
    }
  }

  const out: ImportCandidate[] = [];
  for (let i = 0; i + 1 < stops.length; i++) {
    const d = stops[i];
    const a = stops[i + 1];
    if (!d.dep || a.dep || d.place.toLowerCase() === a.place.toLowerCase()) continue;
    i++;
    const day = d.date ?? dates[0]?.value;
    if (!day || !d.time) continue;
    const departLocal = `${day}T${d.time}`;
    let arriveLocal = `${a.date && a.date !== d.date ? a.date : day}T${a.time ?? addMinutes(departLocal, 120).slice(11)}`;
    if (arriveLocal <= departLocal) arriveLocal = addMinutes(arriveLocal, 24 * 60);
    const seg = text.slice(Math.max(0, d.index - 300), a.index + 300);
    const num = numberRe.exec(seg);
    out.push({
      id: nextId(),
      kind: "transit",
      mode,
      carrier: op?.name ?? null,
      number: num ? num[0].replace(/\s*(?:no\.?|#|number)\s*:?\s*/i, " ").replace(/\s+/g, " ").trim().slice(0, 30) : null,
      from: d.place,
      to: a.place,
      departLocal,
      departTz: ctx.defaultTz,
      arriveLocal,
      arriveTz: ctx.defaultTz,
      confirmation: conf,
      found: "Text",
      warnings: ["Check the station names and the time zone.", ...(a.time ? [] : ["Couldn't read the arrival time."])],
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 3d. Booking.com-style date grid (often from a PDF read as an image)
// ---------------------------------------------------------------------------
/**
 *   Hotel Scherer        CHECK-IN  CHECK-OUT  ROOMS  NIGHTS
 *   Address: …           20        23         1      3
 *   Salzburg, Austria    MAY       MAY
 *                        Thursday  Sunday
 *                        from 14:00  00:30 - 11:00
 * The day numbers, months and times sit in columns under the headings, often
 * on the same lines as the address. Day numbers may come through split ("2 0").
 */
function bookingGridStay(text: string, ctx: Ctx, times: Hit[], conf: string | null): ImportCandidate | null {
  const head = /check[- ]?in\W{0,4}check[- ]?out(\W{0,4}rooms?)?(\W{0,4}nights?)?/i.exec(text);
  if (!head) return null;
  const after = text.slice(head.index, head.index + 600);
  const lines = after.split("\n").slice(1, 6);
  // Digits at the end of a line: "… 5020 20 2 3 1 3" → "202313"
  let digits: string | null = null;
  for (const l of lines) {
    const m = /((?:\b\d{1,2}\s+){2,7}\d{1,2})\s*$/.exec(l);
    if (m) {
      digits = m[1].replace(/\s+/g, "");
      break;
    }
  }
  const monthLine = lines.map((l) => [...l.matchAll(/\b([A-Za-z]{3,9})\b/g)].map((m) => MONTHS[m[1].toLowerCase()]).filter(Boolean)).find((ms) => ms.length >= 1);
  if (!digits || !monthLine) return null;
  const m1 = monthLine[0];
  const m2 = monthLine[1] ?? m1;
  // The year isn't in the grid: use the one the confirmation mentions most (refund dates, footers), else the trip's.
  const year = (() => {
    const counts = new Map<number, number>();
    for (const m of text.matchAll(/\b(20\d{2})\b/g)) if (+m[1] >= ctx.year - 1 && +m[1] <= ctx.year + 3) counts.set(+m[1], (counts.get(+m[1]) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? ctx.year;
  })();
  const days = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  // Split the digits into check-in day, check-out day, rooms and nights so the nights add up.
  for (let a = 1; a <= 2; a++) {
    for (let b = 1; b <= 2; b++) {
      const din = +digits.slice(0, a);
      const dout = +digits.slice(a, a + b);
      const rest = digits.slice(a + b);
      if (din < 1 || din > 31 || dout < 1 || dout > 31) continue;
      const nights = m1 === m2 ? dout - din : days(year, m1) - din + dout;
      if (nights < 1 || nights > 60) continue;
      if (rest && !rest.endsWith(String(nights))) continue;
      const pad = (n: number) => String(n).padStart(2, "0");
      const yOut = m2 < m1 ? year + 1 : year;
      const zone = head.index + head[0].length;
      const near = times.filter((t) => t.index > zone && t.index < zone + 600);
      const fromTime = /\bfrom\s+(\d{1,2}:\d{2})/i.exec(after)?.[1];
      const untilTime = /(?:-|–|until|to)\s*(\d{1,2}:\d{2})\b/i.exec(after.slice(after.search(/\bfrom\s+\d/i) + 1 || 0))?.[1];
      const name =
        text
          .split(/\n/)
          .map((l) => l.trim())
          .find((l) => /hotel|inn\b|resort|suites|hostel|lodge|apartment|b&b|guest ?house|palace|residence|villa|pension|gasthof|pousada|ryokan/i.test(l) && !/booking(\.com)? confirmation/i.test(l))
          ?.replace(/\s*check[- ]?in.*$/i, "")
          .trim() ?? "Stay";
      const address = addressIn(text);
      return {
        id: nextId(),
        kind: "stay",
        name: name.slice(0, 200),
        address: address ? address.slice(0, 300) : null,
        checkInLocal: `${year}-${pad(m1)}-${pad(din)}T${(fromTime ?? near[0]?.value ?? "15:00").padStart(5, "0")}`,
        checkOutLocal: `${yOut}-${pad(m2)}-${pad(dout)}T${(untilTime ?? "11:00").padStart(5, "0")}`,
        confirmation: conf,
        found: "Text",
        warnings: ["Read from a layout with dates in columns. Check the dates and times."],
      };
    }
  }
  return null;
}
