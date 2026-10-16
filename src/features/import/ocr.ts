import "server-only";

import path from "node:path";

/**
 * Text from a PDF that has none: "Print to PDF" and some booking sites draw
 * text as shapes, or the PDF is a scan. Renders up to 3 pages and reads them
 * with Tesseract (English). Takes a few seconds; only used when the PDF has no
 * text layer.
 */
export async function ocrPdf(bytes: Uint8Array): Promise<string | null> {
  const { getDocumentProxy, renderPageAsImage } = await import("unpdf");
  const { createWorker } = await import("tesseract.js");
  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
  try {
    const pdf = await getDocumentProxy(bytes.slice());
    worker = await createWorker("eng", 1, {
      langPath: path.join(process.cwd(), "node_modules/@tesseract.js-data/eng/4.0.0"),
      cacheMethod: "none",
      gzip: true,
    });
    const pages: string[] = [];
    for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
      const png = await renderPageAsImage(pdf, i, { canvasImport: () => import("@napi-rs/canvas"), scale: 2.5 });
      const { data } = await worker.recognize(Buffer.from(png));
      pages.push(data.text);
    }
    const text = pages.join("\n").trim();
    return text ? text.slice(0, 200_000) : null;
  } catch {
    return null;
  } finally {
    await worker?.terminate().catch(() => undefined);
  }
}
