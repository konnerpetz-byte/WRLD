import "server-only";

import { getItinerary, getTrip } from "@/features/trips/queries";
import { formatDay, formatMoney, formatTime, zonedTimeToUtc } from "@/lib/format";
import { requireUserId } from "@/lib/supabase/server";
import type { ChecklistItem, Lodging, TransitSegment } from "@/types/database";

/** One thing on the trip's timeline: a flight, a check-in or check-out, or a planned activity. */
export type Entry = {
  key: string;
  type: "transit" | "stay_in" | "stay_out" | "item";
  bookingType: "transit" | "lodging" | "item";
  bookingId: string;
  date: string; // local date, YYYY-MM-DD
  time: string; // "2:00 PM" local, or ""
  sortAt: string; // ISO, for ordering
  title: string;
  lines: string[];
  confirmation: string | null;
  status: string | null;
  cost: string | null;
  url: string | null;
};

export type ExportFile = { id: string; name: string; path: string; mime: string; size: number; bookingType: string; bookingId: string | null; url: string | null };

const MODE: Record<string, string> = { flight: "Flight", train: "Train", bus: "Bus", car: "Drive", ferry: "Ferry", other: "Transit" };
const dateIn = (iso: string, tz: string) => {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
};

function transitEntry(t: TransitSegment, tripTz: string): Entry {
  const tzFrom = t.origin_timezone ?? tripTz;
  const tzTo = t.destination_timezone ?? tzFrom;
  const route = [t.origin_code ?? t.origin_name, t.destination_code ?? t.destination_name].filter(Boolean).join(" → ");
  const service = [t.carrier, t.service_number].filter(Boolean).join(" ");
  return {
    key: `t-${t.id}`,
    type: "transit",
    bookingType: "transit",
    bookingId: t.id,
    date: dateIn(t.depart_at, tzFrom),
    time: formatTime(t.depart_at, tzFrom),
    sortAt: t.depart_at,
    title: `${MODE[t.mode] ?? "Transit"} ${route}${service ? ` · ${service}` : ""}`,
    lines: [
      `Departs ${formatDay(dateIn(t.depart_at, tzFrom))} ${formatTime(t.depart_at, tzFrom)}${t.origin_name ? ` from ${t.origin_name}` : ""}`,
      `Arrives ${formatDay(dateIn(t.arrive_at, tzTo))} ${formatTime(t.arrive_at, tzTo)}${t.destination_name ? ` at ${t.destination_name}` : ""}`,
      ...(t.cabin_class || t.seat ? [[t.cabin_class, t.seat ? `seat ${t.seat}` : null].filter(Boolean).join(", ")] : []),
      ...(t.notes ? [t.notes] : []),
    ],
    confirmation: t.confirmation_code,
    status: t.booking_status,
    cost: t.cost != null ? formatMoney(t.cost, t.currency ?? "USD") + (t.points_used ? ` + ${t.points_used.toLocaleString("en-US")} points` : "") : null,
    url: t.booking_url,
  };
}

function stayEntries(l: Lodging, tz: string): Entry[] {
  const base = {
    bookingType: "lodging" as const,
    bookingId: l.id,
    confirmation: l.confirmation_code,
    status: l.booking_status,
    url: l.booking_url,
  };
  return [
    {
      ...base,
      key: `in-${l.id}`,
      type: "stay_in",
      date: dateIn(l.check_in_at, tz),
      time: formatTime(l.check_in_at, tz),
      sortAt: l.check_in_at,
      title: `Check in: ${l.name}`,
      lines: [
        ...(l.address ? [l.address] : []),
        `Check out ${formatDay(dateIn(l.check_out_at, tz))} ${formatTime(l.check_out_at, tz)}`,
        ...(l.notes ? [l.notes] : []),
      ],
      cost: l.cost != null ? formatMoney(l.cost, l.currency ?? "USD") + (l.points_used ? ` + ${l.points_used.toLocaleString("en-US")} points` : "") : null,
    },
    {
      ...base,
      key: `out-${l.id}`,
      type: "stay_out",
      date: dateIn(l.check_out_at, tz),
      time: formatTime(l.check_out_at, tz),
      sortAt: l.check_out_at,
      title: `Check out: ${l.name}`,
      lines: [],
      cost: null,
    },
  ];
}

/** Everything an export needs, read with the traveler's own access (RLS applies). */
export async function loadExport(tripId: string, opts: { signFiles: boolean }) {
  const { supabase } = await requireUserId();
  const [{ trip, stops, budget }, plan] = await Promise.all([getTrip(tripId), getItinerary(tripId)]);
  const [{ data: checklist }, { data: members }, { data: files }] = await Promise.all([
    supabase.from("checklist_items").select("*").eq("trip_id", tripId).order("list").order("position"),
    supabase.from("trip_members").select("role, profile:profiles(display_name)").eq("trip_id", tripId).order("created_at"),
    supabase.from("trip_files").select("id, name, path, mime, size_bytes, booking_type, booking_id").eq("trip_id", tripId).order("created_at"),
  ]);

  const transit = plan.transit.filter((t) => t.booking_status !== "cancelled").map((t) => transitEntry(t, trip.timezone));
  const stays = plan.lodging
    .filter((l) => l.booking_status !== "cancelled")
    .flatMap((l) => {
      // The stay's clock: the day it starts on.
      const tz = plan.days.find((d) => d.date === l.check_in_at.slice(0, 10))?.tz ?? trip.timezone;
      return stayEntries(l, tz);
    });
  const items: Entry[] = plan.days.flatMap((d) =>
    d.blocks.flatMap((b) =>
      b.items.map((i) => ({
        key: `i-${i.id}`,
        type: "item" as const,
        bookingType: "item" as const,
        bookingId: i.id,
        date: d.date,
        time: i.start_time ? formatTime(`${d.date}T${i.start_time}Z`, "UTC") : "",
        sortAt: i.start_time ? `${d.date}T${i.start_time}` : b.starts_at,
        title: i.title,
        lines: [
          [b.slot[0].toUpperCase() + b.slot.slice(1), i.location_name].filter(Boolean).join(" · "),
          ...(i.address ? [i.address] : []),
          ...(i.description ? [i.description] : []),
        ],
        confirmation: i.provider_ref,
        status: i.booking_status,
        cost: i.cost != null ? formatMoney(i.cost, i.currency ?? "USD") : null,
        url: i.booking_url ?? i.official_url,
      })),
    ),
  );

  let signed = new Map<string, string>();
  if (opts.signFiles && files?.length) {
    const { data } = await supabase.storage.from("trip-files").createSignedUrls(
      files.map((f) => f.path),
      60 * 60 * 24 * 7,
    );
    signed = new Map((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path!, d.signedUrl as string]));
  }

  // Exact times for the calendar file.
  const raw = {
    transit: plan.transit.filter((t) => t.booking_status !== "cancelled").map((t) => ({ id: t.id, depart_at: t.depart_at, arrive_at: t.arrive_at })),
    lodging: plan.lodging.filter((l) => l.booking_status !== "cancelled").map((l) => ({ id: l.id, check_in_at: l.check_in_at, check_out_at: l.check_out_at })),
    items: plan.days.flatMap((d) =>
      d.blocks.flatMap((b) =>
        b.items.map((i) => {
          const at = (t: string | null) => {
            if (!t) return null;
            try {
              return zonedTimeToUtc(`${d.date}T${t.slice(0, 5)}`, d.tz);
            } catch {
              return null;
            }
          };
          return { id: i.id, startUtc: at(i.start_time), endUtc: at(i.end_time) };
        }),
      ),
    ),
  };

  return {
    raw,
    trip,
    stops,
    budget,
    days: plan.days.map((d) => ({ date: d.date, title: d.title, notes: d.notes, city: d.stop?.city ?? null })),
    transit,
    stays,
    items,
    checklist: (checklist ?? []) as ChecklistItem[],
    members: (members ?? []).map((m) => ({ name: (m.profile as unknown as { display_name: string | null } | null)?.display_name ?? "Traveler", role: m.role })),
    files: (files ?? []).map(
      (f): ExportFile => ({
        id: f.id,
        name: f.name,
        path: f.path,
        mime: f.mime,
        size: f.size_bytes,
        bookingType: f.booking_type,
        bookingId: f.booking_id,
        url: signed.get(f.path) ?? null,
      }),
    ),
  };
}
export type ExportData = Awaited<ReturnType<typeof loadExport>>;

/** Files attached to a booking, for showing them next to it. */
export const filesFor = (data: ExportData, bookingId: string) => data.files.filter((f) => f.bookingId === bookingId);

/** A safe file/folder name. */
export const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9.\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80) || "file";
