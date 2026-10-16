import { loadExport } from "@/features/export/data";
import { parseOptions } from "@/features/export/options";
import { renderTripHtml } from "@/features/export/render-html";

/** The trip as a printable page: opens the print window so it can be saved as a PDF. */
export async function GET(req: Request, ctx: RouteContext<"/trips/[tripId]/export/document">) {
  const { tripId } = await ctx.params;
  const url = new URL(req.url);
  const opts = parseOptions(url.searchParams);
  const data = await loadExport(tripId, { signFiles: true });
  const html = renderTripHtml(data, opts, { print: url.searchParams.get("print") !== "0", fileHref: (f) => f.url });
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
}
