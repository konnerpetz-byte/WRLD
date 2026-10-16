import { loadExport, slug } from "@/features/export/data";
import { buildIcs } from "@/features/export/formats";

/** Flights, stays and timed plans as a calendar file (.ics). */
export async function GET(_req: Request, ctx: RouteContext<"/trips/[tripId]/export/calendar">) {
  const { tripId } = await ctx.params;
  const data = await loadExport(tripId, { signFiles: false });
  return new Response(buildIcs(data, data.raw), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug(data.trip.title)}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
