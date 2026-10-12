import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A calendar file for one document reminder: 9:00 AM on the reminder day, with an alert. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse("Not found", { status: 404 });
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("checklist_items")
    .select("id, title, remind_on, info_url, trip_id")
    .eq("id", id)
    .maybeSingle();
  if (!item?.remind_on) return new NextResponse("Not found", { status: 404 });
  const { data: trip } = await supabase.from("trips").select("title").eq("id", item.trip_id).maybeSingle();

  const day = item.remind_on.replaceAll("-", "");
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/[,;]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wrldtrips.com";
  const description = [`For ${trip?.title ?? "your trip"}.`, item.info_url ? `Official site: ${item.info_url}` : null, `Checklist: ${site}/trips/${item.trip_id}/checklist`]
    .filter(Boolean)
    .join("\n");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WRLD//Trip reminders//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${item.id}@wrldtrips.com`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${day}T090000`,
    `DTEND:${day}T091500`,
    `SUMMARY:${esc(`WRLD: ${item.title}`)}`,
    `DESCRIPTION:${esc(description)}`,
    ...(item.info_url ? [`URL:${item.info_url}`] : []),
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(item.title)}`,
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="wrld-reminder-${item.remind_on}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
