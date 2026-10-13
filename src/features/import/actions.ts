"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { importActivity } from "@/features/itinerary/place-actions";
import { safeFetch } from "@/features/spots/unfurl";
import { addLodging, addTransit } from "@/features/trips/actions";
import { requireUserId } from "@/lib/supabase/server";
import { TRANSIT_MODES } from "@/types/database";

import { type ImportCandidate, parseBookings } from "./parse";

export type ReadState = { candidates?: ImportCandidate[]; error?: string; note?: string };
export type SaveState = { ok?: boolean; error?: string; note?: string; failed?: string[] };

const MAX_FILE = 5 * 1024 * 1024;

/** Step 1: read whatever was pasted, uploaded or linked, and return what was found (nothing is saved). */
export async function readImport(tripId: string, _: ReadState, formData: FormData): Promise<ReadState> {
  const { supabase } = await requireUserId();
  const { data: trip } = await supabase.from("trips").select("timezone, start_date").eq("id", tripId).maybeSingle();
  if (!trip) return { error: "Trip not found." };
  const ctx = { defaultTz: trip.timezone ?? "UTC", year: Number(trip.start_date.slice(0, 4)) };

  const text = String(formData.get("text") ?? "").slice(0, 200_000);
  const url = String(formData.get("url") ?? "").trim().slice(0, 2000);
  const file = formData.get("file");

  const inputs: { text?: string; html?: string; ics?: string }[] = [];
  if (text.trim()) {
    if (/BEGIN:VCALENDAR/.test(text)) inputs.push({ ics: text });
    else inputs.push({ text });
  }

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE) return { error: "That file is over 5 MB." };
    const name = file.name.toLowerCase();
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (name.endsWith(".pdf") || file.type === "application/pdf") {
      const pdfText = await readPdf(bytes);
      if (!pdfText) return { error: "Couldn't read text from that PDF. If it's a scanned image, paste the details instead." };
      inputs.push({ text: pdfText });
    } else {
      const content = new TextDecoder().decode(bytes);
      if (/BEGIN:VCALENDAR/.test(content)) inputs.push({ ics: content });
      else if (name.endsWith(".eml") || /^(received|from|mime-version|return-path):/im.test(content.slice(0, 2000))) inputs.push(readEmail(content));
      else if (/<html|<body|<div|<table|<script/i.test(content)) inputs.push({ html: content });
      else inputs.push({ text: content });
    }
  }

  let linkPage: { html: string; finalUrl: string } | null = null;
  if (url) {
    const fixed = url.replace(/^webcal:\/\//i, "https://");
    if (!/^https?:\/\//i.test(fixed)) return { error: "Links need to start with https://" };
    const page = await safeFetch(fixed);
    linkPage = page;
    if (!page) return { error: "Couldn't open that link. Pages behind a sign-in (like most booking confirmations) can't be read. Paste the confirmation email instead." };
    if (/BEGIN:VCALENDAR/.test(page.html)) inputs.push({ ics: page.html });
    else {
      inputs.push({ html: page.html });
    }
  }

  if (!inputs.length) return { error: "Paste a confirmation, choose a file, or add a link." };

  const candidates = inputs.flatMap((i) => parseBookings(i, ctx));
  if (!candidates.length && url) {
    // A public page with no booking details (a tour or event page): offer it as an item to schedule.
    const page = linkPage;
    const title = page?.html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)/i)?.[1] ?? page?.html.match(/<title[^>]*>([^<]+)/i)?.[1];
    if (title) {
      candidates.push({
        id: `imp-link-${Date.now().toString(36)}`,
        kind: "activity",
        title: title.trim().slice(0, 200),
        date: trip.start_date,
        time: null,
        address: null,
        url: url.replace(/^webcal:\/\//i, "https://"),
        confirmation: null,
        found: "Link",
        warnings: ["The page didn't say when. Pick the date and time."],
      });
    }
  }
  if (!candidates.length) {
    return { error: "No flights, stays or tickets found. Try pasting the whole confirmation email, including the dates and times." };
  }
  return { candidates, note: `Found ${candidates.length}. Check the details, then add them.` };
}

/** PDF tickets and itineraries: their text layer. */
async function readPdf(bytes: Uint8Array): Promise<string | null> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    const out = Array.isArray(text) ? text.join("\n") : text;
    return out.trim() ? out.slice(0, 200_000) : null;
  } catch {
    return null;
  }
}

/** A saved email (.eml): use its HTML part (structured data lives there), else its text part. */
function readEmail(raw: string): { html?: string; text?: string } {
  const decode = (body: string, encoding: string) => {
    if (/base64/i.test(encoding)) {
      try {
        return Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8");
      } catch {
        return body;
      }
    }
    if (/quoted-printable/i.test(encoding)) {
      const bytes = body.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
      return Buffer.from(bytes, "latin1").toString("utf8");
    }
    return body;
  };
  const parts = raw.split(/\r?\n--[^\r\n]+\r?\n/);
  let html: string | undefined;
  let text: string | undefined;
  for (const part of parts) {
    const split = part.search(/\r?\n\r?\n/);
    if (split < 0) continue;
    const headers = part.slice(0, split);
    const body = part.slice(split).trim();
    const type = /content-type:\s*([^;\s]+)/i.exec(headers)?.[1]?.toLowerCase() ?? "";
    const encoding = /content-transfer-encoding:\s*([^\s;]+)/i.exec(headers)?.[1] ?? "";
    if (type === "text/html" && !html) html = decode(body, encoding);
    else if (type === "text/plain" && !text) text = decode(body, encoding);
  }
  if (html) return { html };
  if (text) return { text };
  const split = raw.search(/\r?\n\r?\n/);
  return { text: split > 0 ? raw.slice(split) : raw };
}

// ---------------------------------------------------------------------------
// Step 2: save the reviewed items into the trip
// ---------------------------------------------------------------------------
const local = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
const zone = z.string().min(1).max(64).refine((z) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: z });
    return true;
  } catch {
    return false;
  }
});
const nullableText = (max: number) => z.string().trim().max(max).nullable().transform((v) => (v ? v : null));

const itemSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("transit"),
    mode: z.enum(TRANSIT_MODES),
    carrier: nullableText(80),
    number: nullableText(20),
    from: z.string().trim().min(2).max(120),
    to: z.string().trim().min(2).max(120),
    departLocal: local,
    departTz: zone,
    arriveLocal: local,
    arriveTz: zone,
    confirmation: nullableText(40),
  }),
  z.object({
    kind: z.literal("stay"),
    name: z.string().trim().min(1).max(200),
    address: nullableText(300),
    checkInLocal: local,
    checkOutLocal: local,
    confirmation: nullableText(40),
  }),
  z.object({
    kind: z.literal("activity"),
    title: z.string().trim().min(1).max(200),
    date: z.iso.date(),
    time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
    address: nullableText(300),
    url: z.string().trim().max(2000).regex(/^https?:\/\/\S+$/).nullable(),
    confirmation: nullableText(40),
  }),
]);

export async function saveImport(tripId: string, _: SaveState, formData: FormData): Promise<SaveState> {
  let items: z.infer<typeof itemSchema>[];
  try {
    const raw = JSON.parse(String(formData.get("payload") ?? "[]")) as unknown;
    const parsed = z.array(itemSchema).max(50).safeParse(raw);
    if (!parsed.success) return { error: "Some details aren't valid. Check the dates and times." };
    items = parsed.data;
  } catch {
    return { error: "Something went wrong reading the list. Try again." };
  }
  if (!items.length) return { error: "Choose at least one item to add." };

  const { supabase } = await requireUserId();
  const { data: trip } = await supabase.from("trips").select("start_date, end_date, currency").eq("id", tripId).maybeSingle();
  if (!trip) return { error: "Trip not found." };

  const added = { transit: 0, stay: 0, activity: 0 };
  const failed: string[] = [];
  // Travel and stays first, so tickets land in days whose times are already right.
  const order = { transit: 0, stay: 1, activity: 2 } as const;
  for (const item of [...items].sort((a, b) => order[a.kind] - order[b.kind])) {
    if (item.kind === "transit") {
      const day = item.departLocal.slice(0, 10);
      const direction = day <= trip.start_date ? "outbound" : day >= trip.end_date ? "return" : "within";
      const fd = new FormData();
      const codes = item.mode === "flight";
      const entries: Record<string, string> = {
        mode: item.mode,
        direction,
        carrier: item.carrier ?? "",
        service_number: item.number ?? "",
        [codes ? "origin_code" : "origin_name"]: codes ? item.from.toUpperCase() : item.from,
        [codes ? "destination_code" : "destination_name"]: codes ? item.to.toUpperCase() : item.to,
        depart_local: item.departLocal,
        origin_timezone: item.departTz,
        arrive_local: item.arriveLocal,
        destination_timezone: item.arriveTz,
        booking_status: "booked",
        currency: trip.currency,
        confirmation_code: item.confirmation ?? "",
      };
      for (const [k, v] of Object.entries(entries)) fd.set(k, v);
      const r = await addTransit(tripId, {}, fd);
      if (r.error) failed.push(`${item.from} → ${item.to}: ${r.error}`);
      else added.transit++;
    } else if (item.kind === "stay") {
      const fd = new FormData();
      const entries: Record<string, string> = {
        name: item.name,
        address: item.address ?? "",
        check_in_local: item.checkInLocal,
        check_out_local: item.checkOutLocal,
        booking_status: "booked",
        confirmation_code: item.confirmation ?? "",
        currency: trip.currency,
      };
      for (const [k, v] of Object.entries(entries)) fd.set(k, v);
      const r = await addLodging(tripId, {}, fd);
      if (r.error) failed.push(`${item.name}: ${r.error}`);
      else added.stay++;
    } else {
      const r = await importActivity(tripId, item);
      if (r.error) failed.push(r.error.startsWith(item.title) ? r.error : `${item.title}: ${r.error}`);
      else added.activity++;
    }
  }

  revalidatePath(`/trips/${tripId}`, "layout");
  const parts = [
    added.transit && `${added.transit} ${added.transit === 1 ? "trip leg" : "trip legs"}`,
    added.stay && `${added.stay} ${added.stay === 1 ? "stay" : "stays"}`,
    added.activity && `${added.activity} ${added.activity === 1 ? "ticket" : "tickets"}`,
  ].filter(Boolean);
  if (!parts.length) return { error: "Nothing could be added.", failed };
  return { ok: true, note: `Added ${parts.join(", ")}. Your days have been updated.`, failed };
}
