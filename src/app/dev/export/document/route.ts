import { notFound } from "next/navigation";

import { parseOptions } from "@/features/export/options";
import { renderTripHtml } from "@/features/export/render-html";

import { SAMPLE } from "../sample";

/** Development-only: the export document with a sample trip. */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = new URL(req.url).searchParams;
  return new Response(renderTripHtml(SAMPLE, parseOptions(sp), { print: false, fileHref: (f) => `tickets/${f.name}` }), { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
