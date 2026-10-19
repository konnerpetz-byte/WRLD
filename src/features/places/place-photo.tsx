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
  const credit = text(meta.Artist?.value ?? "") || text(meta.Credit?.value ?? "") || "Unknown author";
  return {
    src: page.thumbnail.source,
    width: page.thumbnail.width,
    height: page.thumbnail.height,
    credit: credit.slice(0, 80),
    license,
    page: `https://commons.wikimedia.org/wiki/${encodeURIComponent(file.replace(/ /g, "_"))}`,
  };
}

/** The photo at the top of a destination card, with its credit. Renders nothing when there's no free photo. */
export async function PlacePhoto({ title, search, alt, wide = false }: { title: string; search: string; alt: string; wide?: boolean }) {
  const p = await placePhoto(title, search);
  if (!p) return null;
  return (
    <figure className="-mx-5 -mt-5 mb-1 overflow-hidden rounded-t-2xl">
      {/* eslint-disable-next-line @next/next/no-img-element -- Wikimedia's own resized file; no need to re-encode */}
      <img src={p.src} alt={alt} width={p.width} height={p.height} loading="lazy" decoding="async" className={`w-full bg-muted object-cover ${wide ? "h-44 sm:h-56" : "aspect-[16/9]"}`} />
      <figcaption className="px-5 pt-1.5 text-[11px] leading-tight text-muted-foreground">
        Photo:{" "}
        <a href={p.page} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          {p.credit}, {p.license}
          <span className="sr-only"> (opens Wikimedia Commons in a new tab)</span>
        </a>
      </figcaption>
    </figure>
  );
}
