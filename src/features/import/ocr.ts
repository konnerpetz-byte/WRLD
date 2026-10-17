import "server-only";

import path from "node:path";

type Worker = Awaited<ReturnType<(typeof import("tesseract.js"))["createWorker"]>>;

async function withWorker<T>(run: (worker: Worker) => Promise<T>): Promise<T | null> {
  const { createWorker } = await import("tesseract.js");
  let worker: Worker | null = null;
  try {
    worker = await createWorker("eng", 1, {
      langPath: path.join(process.cwd(), "node_modules/@tesseract.js-data/eng/4.0.0"),
      cacheMethod: "none",
      gzip: true,
    });
    // Tesseract.js defaults to "single block", which drops the big headings and scattered boxes of an
    // app screen (airport codes, booking codes). Automatic page layout reads them.
    const { PSM } = await import("tesseract.js");
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
    return await run(worker);
  } catch {
    return null;
  } finally {
    await worker?.terminate().catch(() => undefined);
  }
}

const tidy = (pages: string[]) => {
  const text = pages.join("\n").trim();
  return text ? text.slice(0, 200_000) : null;
};

/**
 * Text from a PDF that has none: "Print to PDF" and some booking sites draw
 * text as shapes, or the PDF is a scan. Renders up to 3 pages and reads them
 * with Tesseract (English). Takes a few seconds; only used when the PDF has no
 * text layer.
 */
export async function ocrPdf(bytes: Uint8Array): Promise<string | null> {
  const { getDocumentProxy, renderPageAsImage } = await import("unpdf");
  return withWorker(async (worker) => {
    const pdf = await getDocumentProxy(bytes.slice());
    const pages: string[] = [];
    for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
      const png = await renderPageAsImage(pdf, i, { canvasImport: () => import("@napi-rs/canvas"), scale: 2.5 });
      const { data } = await worker.recognize(Buffer.from(png));
      pages.push(data.text);
    }
    return tidy(pages);
  });
}

/** HEIC/HEIF (iPhone camera format) can't be decoded here; the upload form converts it when the browser can. */
export const isHeic = (bytes: Uint8Array) => /^ftyp(heic|heix|hevc|heim|heis|mif1|msf1)/.test(new TextDecoder().decode(bytes.slice(4, 12)));

/**
 * Screenshots and photos of confirmations (JPEG, PNG, WebP, GIF, AVIF), read in order
 * as one text. Each image is turned grayscale, inverted when it's dark mode (light text
 * on dark reads poorly), and scaled so text is large enough for Tesseract.
 */
export async function ocrImages(images: Uint8Array[]): Promise<string | null> {
  const { createCanvas, loadImage } = await import("@napi-rs/canvas");
  return withWorker(async (worker) => {
    const pages: string[] = [];
    for (const bytes of images.slice(0, 6)) {
      try {
        const img = await loadImage(Buffer.from(bytes));
        // Phone screenshots are ~1100–1300 px wide; small images get scaled up, huge photos down.
        const scale = Math.min(img.width < 1000 ? 2 : 1, 2600 / img.width, 9000 / img.height);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = createCanvas(w, h);
        const g = canvas.getContext("2d");
        g.drawImage(img, 0, 0, w, h);
        const pixels = g.getImageData(0, 0, w, h);
        const d = pixels.data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) {
          const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          d[i] = d[i + 1] = d[i + 2] = y;
          sum += y;
        }
        if (sum / (d.length / 4) < 110) for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = 255 - d[i];
        g.putImageData(pixels, 0, 0);
        const { data } = await worker.recognize(canvas.toBuffer("image/png"));
        pages.push(data.text);
      } catch {
        // An image that won't decode is skipped; the others still count.
      }
    }
    return tidy(pages);
  });
}
