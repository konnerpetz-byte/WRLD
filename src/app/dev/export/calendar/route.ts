import { notFound } from "next/navigation";

import { buildCsv, buildIcs } from "@/features/export/formats";
import { parseOptions } from "@/features/export/options";

import { SAMPLE } from "../sample";

/** Development-only: the calendar and spreadsheet text for the sample trip. */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = new URL(req.url).searchParams;
  return new Response(`${buildIcs(SAMPLE, SAMPLE.raw)}\n\n-----\n\n${buildCsv(SAMPLE, parseOptions(sp))}`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
