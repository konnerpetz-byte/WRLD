import { strToU8, zipSync } from "fflate";

import { type ExportFile, loadExport, slug } from "@/features/export/data";
import { buildCsv, buildIcs } from "@/features/export/formats";
import { parseOptions } from "@/features/export/options";
import { renderTripHtml } from "@/features/export/render-html";
import { formatDay } from "@/lib/format";
import { requireUserId } from "@/lib/supabase/server";

export const maxDuration = 60;

/**
 * Everything in one .zip: the trip document (open in any browser, works
 * offline), the calendar file, the spreadsheet, a JSON copy, and every ticket
 * and file in a tickets folder organized the way the traveler chose.
 */
export async function GET(req: Request, ctx: RouteContext<"/trips/[tripId]/export/bundle">) {
  const { tripId } = await ctx.params;
  const opts = parseOptions(new URL(req.url).searchParams);
  const data = await loadExport(tripId, { signFiles: false });
  const { supabase } = await requireUserId();

  const timeline = [...data.transit, ...data.stays.filter((e) => e.type === "stay_in"), ...data.items];
  const folderFor = (f: ExportFile) => {
    const e = timeline.find((x) => x.bookingId === f.bookingId);
    if (!e) return "tickets/Whole trip";
    if (opts.group === "type") {
      const kind = e.type === "transit" ? "Flights and transit" : e.type === "stay_in" ? "Stays" : "Plans";
      return `tickets/${kind}/${slug(`${e.date} ${e.title}`)}`;
    }
    return `tickets/${slug(`${e.date} ${formatDay(e.date)}`)}/${slug(e.title)}`;
  };

  const files: Record<string, Uint8Array> = {};
  const used = new Set<string>();
  const pathOf = new Map<string, string>();
  for (const f of data.files) {
    let p = `${folderFor(f)}/${slug(f.name)}`;
    for (let n = 2; used.has(p); n++) p = `${folderFor(f)}/${n}-${slug(f.name)}`;
    used.add(p);
    pathOf.set(f.id, p);
  }
  // Download each file with the traveler's own access (storage RLS applies).
  await Promise.all(
    data.files.map(async (f) => {
      const { data: blob } = await supabase.storage.from("trip-files").download(f.path);
      if (blob) files[pathOf.get(f.id)!] = new Uint8Array(await blob.arrayBuffer());
      else pathOf.delete(f.id);
    }),
  );

  const name = slug(data.trip.title);
  files[`${name}.html`] = strToU8(renderTripHtml(data, opts, { print: false, fileHref: (f) => pathOf.get(f.id) ?? null }));
  files[`${name}.ics`] = strToU8(buildIcs(data, data.raw));
  files[`${name}.csv`] = strToU8(buildCsv(data, opts));
  files[`${name}.json`] = strToU8(
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        trip: { title: data.trip.title, start: data.trip.start_date, end: data.trip.end_date, travelers: data.trip.party_size, notes: data.trip.notes },
        stops: data.stops.map((s) => ({ city: s.city, country: s.country_code, arrive: s.arrive_date, leave: s.leave_date })),
        days: data.days,
        flightsAndTransit: data.transit,
        stays: data.stays.filter((e) => e.type === "stay_in"),
        plans: data.items,
        checklist: data.checklist.map((c) => ({ list: c.list, title: c.title, done: c.done, due: c.due_on })),
        files: data.files.map((f) => ({ name: f.name, inZip: pathOf.get(f.id) ?? null, booking: f.bookingId })),
      },
      null,
      2,
    ),
  );
  files["README.txt"] = strToU8(
    [
      `${data.trip.title}: exported from WRLD`,
      "",
      `${name}.html  Open in any browser. The whole trip, with links to your tickets. Works offline.`,
      `${name}.ics   Import into Apple, Google or Outlook calendar: flights, stays and timed plans.`,
      `${name}.csv   Open in Excel, Numbers or Google Sheets.`,
      `${name}.json  A complete copy of the trip data.`,
      `tickets/      Your uploaded tickets and files, ${opts.group === "type" ? "grouped by type" : "grouped by day"}.`,
      "",
    ].join("\r\n"),
  );

  const zip = zipSync(files, { level: 6 });
  return new Response(new Blob([zip as BlobPart], { type: "application/zip" }), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${name}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
