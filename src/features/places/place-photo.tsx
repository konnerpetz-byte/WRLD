import "server-only";

import { cacheLife } from "next/cache";

/**
 * A representative photo of a place: the lead photo of its Wikipedia article, the one editors
 * chose to show the place. Only freely licensed files (Wikimedia Commons: public domain, CC0,
 * CC BY, CC BY-SA), always credited with the photographer and license as those licenses require.
 * Looked up on the server and cached for weeks; maps, flags, seals and logos are skipped.
 */
export type Photo = {
  src: string;
  width: number;
  height: number;
  /** Photographer or author, plain text */
  credit: string;
  license: string;
  /** The file's page on Wikimedia Commons (license and full credit) */
  page: string;
};

const API = "https://en.wikipedia.org/w/api.php";
const UA = { "User-Agent": "WRLD trip planner (https://wrldtrips.com; privacy@wrldtrips.com)", "Api-User-Agent": "WRLD trip planner (https://wrldtrips.com)" };
const NOT_A_PHOTO = /(map|flag|seal|coat[_ ]of[_ ]arms|logo|locator|location|diagram|emblem|signature|\.svg$|\.gif$)/i;
const FREE = /^(cc0|cc[ -]by|public domain|pd\b|pd-)/i;

type Page = { title: string; index?: number; pageimage?: string; thumbnail?: { source: string; width: number; height: number } };

async function getJson<T>(params: Record<string, string>): Promise<T | null> {
  const u = new URL(API);
  u.search = new URLSearchParams({ format: "json", formatversion: "2", origin: "*", ...params }).toString();
  try {
    const res = await fetch(u, { headers: UA, signal: AbortSignal.timeout(5000) });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

const imageProps = { prop: "pageimages", piprop: "thumbnail|name", pithumbsize: "800", pilicense: "free" };

/** The best page with a usable lead photo: the exact title first, then a search. */
async function leadImage(title: string, search: string): Promise<Page | null> {
  const exact = await getJson<{ query?: { pages?: Page[] } }>({ action: "query", titles: title, redirects: "1", ...imageProps });
  const ok = (p: Page | undefined) => Boolean(p?.pageimage && p.thumbnail && !NOT_A_PHOTO.test(p.pageimage));
  const hit = exact?.query?.pages?.find(ok);
  if (hit) return hit;
  const found = await getJson<{ query?: { pages?: Page[] } }>({
    action: "query",
    generator: "search",
    gsrsearch: search,
    gsrlimit: "4",
    gsrnamespace: "0",
    ...imageProps,
  });
  return (found?.query?.pages ?? []).sort((a, b) => (a.index ?? 99) - (b.index ?? 99)).find(ok) ?? null;
}

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/** A photo for a place, or null when there's no free photo to show. */
export async function placePhoto(title: string, search: string): Promise<Photo | null> {
  "use cache";
  cacheLife("weeks");
  const page = await leadImage(title, search);
  if (!page?.pageimage || !page.thumbnail) return null;
  const file = `File:${page.pageimage}`;
  type Info = { query?: { pages?: { imageinfo?: { extmetadata?: Record<string, { value?: string }> }[] }[] } };
  const info = await getJson<Info>({
    action: "query",
    titles: file,
    prop: "imageinfo",
    iiprop: "extmetadata",
    iiextmetadatafilter: "Artist|LicenseShortName|Credit",
  });
  const meta = info?.query?.pages?.[0]?.imageinfo?.[0]?.extmetadata ?? {};
  const license = text(meta.LicenseShortName?.value ?? "");
  if (!FREE.test(license)) return null;
  // Wiki user links come through as "Name ( talk ) ( Uploads )": keep just the name.
  const clean = (v: string) => text(v).replace(/\(\s*(talk|uploads|contribs|contributions)\s*\)/gi, "").replace(/\s+/g, " ").trim();
  const credit = clean(meta.Artist?.value ?? "") || clean(meta.Credit?.value ?? "") || "Unknown author";
  return {
    src: page.thumbnail.source,
    width: page.thumbnail.width,
    height: page.thumbnail.height,
    credit: credit.slice(0, 80),
    license,
    page: `https://commons.wikimedia.org/wiki/${encodeURIComponent(file.replace(/ /g, "_"))}`,
  };
}

/** The photo at the top of a destination card, credit on the image. Renders a plain tile when there's no free photo. */
export async function PlacePhoto({ title, search, alt, children }: { title: string; search: string; alt: string; children?: React.ReactNode }) {
  const p = await placePhoto(title, search);
  return (
    <figure className="relative aspect-[16/10] overflow-hidden bg-muted">
      {p && (
        // eslint-disable-next-line @next/next/no-img-element -- Wikimedia's own resized file; no need to re-encode
        <img src={p.src} alt={alt} width={p.width} height={p.height} loading="lazy" decoding="async" className="size-full object-cover" />
      )}
      {children}
      {p && (
        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-1.5 pt-5 text-right text-[10px] leading-tight text-white/90">
          <a href={p.page} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {p.credit}, {p.license}
            <span className="sr-only"> (photo credit, opens Wikimedia Commons in a new tab)</span>
          </a>
        </figcaption>
      )}
    </figure>
  );
}

/** Placeholder while the photo loads: same size, so nothing jumps. */
export function PhotoSkeleton({ children }: { children?: React.ReactNode }) {
  return (
    <div className="relative aspect-[16/10] animate-pulse bg-muted motion-reduce:animate-none" aria-hidden="true">
      {children}
    </div>
  );
}
