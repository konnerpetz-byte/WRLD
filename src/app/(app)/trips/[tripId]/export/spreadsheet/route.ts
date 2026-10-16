import { loadExport, slug } from "@/features/export/data";
import { buildCsv } from "@/features/export/formats";
import { parseOptions } from "@/features/export/options";

/** Every booking and plan as a spreadsheet (.csv opens in Excel, Numbers and Google Sheets). */
export async function GET(req: Request, ctx: RouteContext<"/trips/[tripId]/export/spreadsheet">) {
  const { tripId } = await ctx.params;
  const data = await loadExport(tripId, { signFiles: false });
  return new Response(buildCsv(data, parseOptions(new URL(req.url).searchParams)), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug(data.trip.title)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
