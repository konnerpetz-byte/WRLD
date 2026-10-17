"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { importActivity } from "@/features/itinerary/place-actions";
import { safeFetch } from "@/features/spots/unfurl";
import { addExpense, addLodging, addTransit } from "@/features/trips/actions";
import { requireUserId } from "@/lib/supabase/server";
import { TRANSIT_MODES } from "@/types/database";

import { type ImportCandidate, parseBookings, travelersIn } from "./parse";
import { isHeic } from "./ocr";
import { mergeTravelers, type Travelers } from "./travelers";

export type ReadState = {
  candidates?: ImportCandidate[];
  error?: string;
  note?: string;
  inboxId?: string;
  people?: Travelers;
  /** Prices in the trip's currency at today's rate, by candidate id (preview only; the budget converts on its own). */
  converted?: Record<string, number>;
};

/** What each found price is in the trip's currency, so the review shows "€291 ≈ $327". */
async function convertPrices(supabase: Supabase, candidates: ImportCandidate[], tripCurrency: string) {
  const out: Record<string, number> = {};
  await Promise.all(
    candidates
      .filter((c) => c.cost != null && c.currency && c.currency !== tripCurrency)
      .map(async (c) => {
        const { data } = await supabase.rpc("convert_currency", { p_amount: c.cost!, p_from: c.currency!, p_to: tripCurrency });
        if (data != null) out[c.id] = Number(data);
      }),
  );
  return out;
}

/** Everyone named on the reservation(s), across every pasted email, file or page. */
const peopleIn = (inputs: { text?: string; html?: string; ics?: string }[]): Travelers =>
  inputs.reduce<Travelers>((acc, i) => mergeTravelers(acc, i.ics ? { names: [], count: null } : travelersIn(i)), { names: [], count: null });
export type SaveState = { ok?: boolean; error?: string; note?: string; failed?: string[] };

// Vercel rejects request bodies over 4.5 MB; the form shrinks photos before sending.
const MAX_FILE = 4 * 1024 * 1024;
const MAX_TOTAL = 4.3 * 1024 * 1024;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|heic|heif)$/;
const isImage = (name: string, type: string, bytes: Uint8Array) =>
  /^image\//.test(type) || IMAGE_EXT.test(name) || (bytes[0] === 0xff && bytes[1] === 0xd8) || (bytes[0] === 0x89 && bytes[1] === 0x50);

/** Step 1: read whatever was pasted, uploaded or linked, and return what was found (nothing is saved). */
export async function readImport(tripId: string, _: ReadState, formData: FormData): Promise<ReadState> {
  const { supabase } = await requireUserId();
  const { data: trip } = await supabase.from("trips").select("timezone, start_date, currency").eq("id", tripId).maybeSingle();
  if (!trip) return { error: "Trip not found." };
  const ctx = { defaultTz: trip.timezone ?? "UTC", year: Number(trip.start_date.slice(0, 4)), currency: trip.currency };

  // A forwarded email from the traveler's import inbox.
  const inboxId = String(formData.get("inbox") ?? "");
  if (/^[0-9a-f-]{36}$/i.test(inboxId)) return readInbox(supabase, inboxId, ctx);

  const text = String(formData.get("text") ?? "").slice(0, 200_000);
  const url = String(formData.get("url") ?? "").trim().slice(0, 2000);
  const files = formData.getAll("file").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 6);

  const inputs: { text?: string; html?: string; ics?: string }[] = [];
  if (text.trim()) {
    if (/BEGIN:VCALENDAR/.test(text)) inputs.push({ ics: text });
    else inputs.push({ text });
  }

  // Screenshots of one confirmation are read together, in the order they were picked.
  const images: Uint8Array[] = [];
  let heic = false;
  if (files.reduce((n, f) => n + f.size, 0) > MAX_TOTAL) return { error: "Those files are over 4 MB together. Try fewer at a time." };
  for (const file of files) {
    if (file.size > MAX_FILE) return { error: `${file.name} is over 4 MB.` };
    const name = file.name.toLowerCase();
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (isImage(name, file.type, bytes)) {
      if (isHeic(bytes)) heic = true;
      else images.push(bytes);
    } else if (name.endsWith(".pdf") || file.type === "application/pdf") {
      const pdfText = await readPdf(bytes);
      if (!pdfText) return { error: "Couldn't read that PDF, even as an image. Paste the confirmation details instead." };
      inputs.push({ text: pdfText });
    } else {
      const content = new TextDecoder().decode(bytes);
      if (/BEGIN:VCALENDAR/.test(content)) inputs.push({ ics: content });
      else if (name.endsWith(".eml") || /^(received|from|mime-version|return-path):/im.test(content.slice(0, 2000))) inputs.push(readEmail(content));
      else if (/<html|<body|<div|<table|<script/i.test(content)) inputs.push({ html: content });
      else inputs.push({ text: content });
    }
  }
  if (heic && !images.length && !inputs.length) {
    return { error: "That photo is in iPhone's HEIC format, which can't be read here. Take a screenshot of it instead, or upload it from Safari." };
  }
  // Screenshots: the AI reader when it's set up (any app layout), else OCR and the text rules.
  let fromImages: { candidates: ImportCandidate[]; people: Travelers } | null = null;
  if (images.length) {
    const { readImagesWithAI } = await import("./vision");
    fromImages = await readImagesWithAI(images, ctx);
    if (!fromImages?.candidates.length) {
      fromImages = null;
      const { ocrImages } = await import("./ocr");
      const seen = await ocrImages(images);
      if (seen) inputs.push({ text: seen });
      else if (!inputs.length) return { error: "Couldn't read any text in that image. Try a sharper screenshot, or paste the details instead." };
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

  const candidates = [...(fromImages?.candidates ?? []), ...inputs.flatMap((i) => parseBookings(i, ctx))];
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
  // Counts only (no names, codes or places), so a failed screenshot import can be diagnosed from the logs.
  const kinds = (k: string) => candidates.filter((c) => c.kind === k).length;
  console.info(
    `[import] files=${files.length} images=${images.length} reader=${fromImages ? "ai" : images.length ? "ocr" : "text"} chars=${inputs.reduce((n, i) => n + (i.text?.length ?? 0), 0)} flights=${kinds("transit")} stays=${kinds("stay")} other=${kinds("activity")}`,
  );
  if (!candidates.length) {
    return { error: "No flights, stays or tickets found. Try pasting the whole confirmation email, including the dates and times." };
  }
  const people = fromImages ? mergeTravelers(peopleIn(inputs), fromImages.people) : peopleIn(inputs);
  return { candidates, people, converted: await convertPrices(supabase, candidates, trip.currency), note: `Found ${candidates.length}. Check the details, then add them.` };
}

type Supabase = Awaited<ReturnType<typeof requireUserId>>["supabase"];

/** A forwarded email: its HTML or text, plus any calendar file or PDF attached. */
async function readInbox(supabase: Supabase, inboxId: string, ctx: { defaultTz: string; year: number; currency: string }): Promise<ReadState> {
  const { data: item } = await supabase.from("import_inbox").select("*").eq("id", inboxId).maybeSingle();
  if (!item) return { error: "That email isn't in your inbox anymore." };
  const inputs: { text?: string; html?: string; ics?: string }[] = [];
  if (item.html_body) inputs.push({ html: item.html_body });
  else if (item.text_body) inputs.push({ text: item.text_body });
  const images: Uint8Array[] = [];
  for (const a of item.attachments ?? []) {
    if (!/calendar|ics|pdf|^image\//i.test(a.mime)) continue;
    const { data: blob } = await supabase.storage.from("import-inbox").download(a.path);
    if (!blob) continue;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (/^image\//i.test(a.mime)) {
      if (!isHeic(bytes)) images.push(bytes);
    } else if (/pdf/i.test(a.mime)) {
      const t = await readPdf(bytes);
      if (t) inputs.push({ text: t });
    } else inputs.push({ ics: new TextDecoder().decode(bytes) });
  }
  // Images are only read when the email itself had nothing (a forwarded screenshot), since logos and banners aren't bookings.
  if (images.length && !inputs.flatMap((i) => parseBookings(i, ctx)).length) {
    const { ocrImages } = await import("./ocr");
    const seen = await ocrImages(images);
    if (seen) inputs.push({ text: seen });
  }
  const candidates = inputs.flatMap((i) => parseBookings(i, ctx));
  if (!candidates.length) {
    return { error: `No flights, stays or tickets found in "${item.subject ?? "that email"}". Open it and paste the details instead.`, inboxId };
  }
  return { candidates, inboxId, people: peopleIn(inputs), converted: await convertPrices(supabase, candidates, ctx.currency), note: `Found ${candidates.length} in "${item.subject ?? "your email"}". Check the details, then add them.` };
}

/** Hide a forwarded email without importing it. */
export async function dismissInbox(inboxId: string) {
  const { supabase } = await requireUserId();
  const { data: item } = await supabase.from("import_inbox").select("attachments").eq("id", inboxId).maybeSingle();
  if (!item) return;
  const paths = (item.attachments ?? []).map((a) => a.path);
  if (paths.length) await supabase.storage.from("import-inbox").remove(paths);
  await supabase.from("import_inbox").update({ status: "dismissed" }).eq("id", inboxId);
  revalidatePath("/trips", "layout");
}

/** After import: the email is marked done and its attachments (tickets, boarding passes) move into the trip's files. */
async function finishInbox(supabase: Supabase, inboxId: string, tripId: string) {
  const { data: item } = await supabase.from("import_inbox").select("attachments").eq("id", inboxId).maybeSingle();
  if (!item) return 0;
  let moved = 0;
  for (const a of item.attachments ?? []) {
    const { data: blob } = await supabase.storage.from("import-inbox").download(a.path);
    if (!blob) continue;
    const name = a.name.replace(/[^a-zA-Z0-9.\-_ ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 100) || "file";
    const path = `${tripId}/${crypto.randomUUID()}-${name}`;
    const { error } = await supabase.storage.from("trip-files").upload(path, blob, { contentType: a.mime, upsert: false });
    if (error) continue;
    const { error: rowErr } = await supabase.from("trip_files").insert({ trip_id: tripId, name: a.name.slice(0, 200), path, size_bytes: a.size, mime: a.mime.slice(0, 100) });
    if (rowErr) await supabase.storage.from("trip-files").remove([path]);
    else moved++;
  }
  const paths = (item.attachments ?? []).map((a) => a.path);
  if (paths.length) await supabase.storage.from("import-inbox").remove(paths);
  await supabase.from("import_inbox").update({ status: "imported", trip_id: tripId }).eq("id", inboxId);
  return moved;
}

/** PDF tickets and itineraries: their text layer. */
async function readPdf(bytes: Uint8Array): Promise<string | null> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    // pdf.js may take over the buffer it's given; keep the original for the image fallback.
    const pdf = await getDocumentProxy(bytes.slice());
    const { text } = await extractText(pdf, { mergePages: true });
    const out = Array.isArray(text) ? text.join("\n") : text;
    if (out.trim().length > 40) return out.slice(0, 200_000);
  } catch {
    // fall through to reading the page images
  }
  // No text layer ("Print to PDF", scans): read the pages as images.
  const { ocrPdf } = await import("./ocr");
  return ocrPdf(bytes);
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
// Price as the file shows it (any currency; the budget converts it to the trip's), and who paid.
const priced = {
  cost: z.number().min(0).max(1_000_000).nullable().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable().optional(),
  points: z.number().int().min(0).max(10_000_000).nullable().optional(),
  paidBy: z.uuid().nullable().optional(),
  split: z.array(z.uuid()).max(50).optional(),
};

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
    ...priced,
  }),
  z.object({
    kind: z.literal("stay"),
    name: z.string().trim().min(1).max(200),
    address: nullableText(300),
    checkInLocal: local,
    checkOutLocal: local,
    confirmation: nullableText(40),
    ...priced,
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
        cost: item.cost != null ? String(item.cost) : "",
        currency: item.cost != null ? (item.currency ?? trip.currency) : trip.currency,
        points_used: item.points != null ? String(item.points) : "",
        confirmation_code: item.confirmation ?? "",
      };
      for (const [k, v] of Object.entries(entries)) fd.set(k, v);
      const r = await addTransit(tripId, {}, fd);
      if (r.error) failed.push(`${item.from} → ${item.to}: ${r.error}`);
      else {
        added.transit++;
        await paidFor(tripId, item, { transit_segment_id: r.id }, `${item.number ?? "Flight"} ${item.from} → ${item.to}`, "transit", item.departLocal, trip.currency, failed);
      }
    } else if (item.kind === "stay") {
      const fd = new FormData();
      const entries: Record<string, string> = {
        name: item.name,
        address: item.address ?? "",
        check_in_local: item.checkInLocal,
        check_out_local: item.checkOutLocal,
        booking_status: "booked",
        confirmation_code: item.confirmation ?? "",
        cost: item.cost != null ? String(item.cost) : "",
        currency: item.cost != null ? (item.currency ?? trip.currency) : trip.currency,
      };
      for (const [k, v] of Object.entries(entries)) fd.set(k, v);
      const r = await addLodging(tripId, {}, fd);
      if (r.error) failed.push(`${item.name}: ${r.error}`);
      else {
        added.stay++;
        await paidFor(tripId, item, { lodging_id: r.id }, item.name, "lodging", item.checkInLocal, trip.currency, failed);
      }
    } else {
      const r = await importActivity(tripId, item);
      if (r.error) failed.push(r.error.startsWith(item.title) ? r.error : `${item.title}: ${r.error}`);
      else added.activity++;
    }
  }

  const inboxId = String(formData.get("inbox") ?? "");
  const moved = /^[0-9a-f-]{36}$/i.test(inboxId) ? await finishInbox(supabase, inboxId, tripId) : 0;

  revalidatePath(`/trips/${tripId}`, "layout");
  const parts = [
    added.transit && `${added.transit} ${added.transit === 1 ? "trip leg" : "trip legs"}`,
    added.stay && `${added.stay} ${added.stay === 1 ? "stay" : "stays"}`,
    added.activity && `${added.activity} ${added.activity === 1 ? "ticket" : "tickets"}`,
  ].filter(Boolean);
  if (!parts.length) return { error: "Nothing could be added.", failed };
  return {
    ok: true,
    note: `Added ${parts.join(", ")}.${moved ? ` ${moved} attached file${moved === 1 ? " is" : "s are"} now under Export, Tickets & files.` : ""} Your days have been updated.`,
    failed,
  };
}

/**
 * "Paid by Konner, split with Shane": records the booking's price as an expense linked to it, so the
 * group balances (who owes whom) include it. The budget counts the booking once, not twice.
 */
async function paidFor(
  tripId: string,
  item: { cost?: number | null; currency?: string | null; paidBy?: string | null; split?: string[] },
  link: { lodging_id?: string; transit_segment_id?: string },
  description: string,
  category: "lodging" | "transit",
  when: string,
  tripCurrency: string,
  failed: string[],
) {
  if (!item.paidBy || item.cost == null || item.cost <= 0) return;
  const id = link.lodging_id ?? link.transit_segment_id;
  if (!id) return;
  const fd = new FormData();
  fd.set("description", description.slice(0, 200));
  fd.set("amount", String(item.cost));
  fd.set("currency", item.currency ?? tripCurrency);
  fd.set("category", category);
  fd.set("incurred_on", when.slice(0, 10));
  fd.set("paid_by", item.paidBy);
  fd.set(link.lodging_id ? "lodging_id" : "transit_segment_id", id);
  if (item.split?.length) {
    fd.set("split_shown", "1");
    for (const u of item.split) fd.append("split", u);
  }
  const r = await addExpense(tripId, {}, fd);
  if (r.error) failed.push(`${description}: saved, but the split wasn't (${r.error})`);
}

/** "This reservation is for 3": match the trip's head count to the booking. */
export async function setTravelers(tripId: string, count: number) {
  const n = Math.round(count);
  if (!(n >= 1 && n <= 50)) return;
  const { supabase } = await requireUserId();
  await supabase.from("trips").update({ party_size: n }).eq("id", tripId);
  revalidatePath(`/trips/${tripId}`, "layout");
}
