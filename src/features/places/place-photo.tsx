import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { publicClient } from "@/lib/supabase/public";

/**
 * A representative photo of a place: the lead photo of its Wikipedia article, the one editors
 * chose to show the place. Only freely licensed files (Wikimedia Commons: public domain, CC0,
 * CC BY, CC BY-SA), always credited with the photographer and license as those licenses require.
 * Found by the photos-refresh worker and stored in place_photos; maps, flags, seals and logos are skipped.
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

/** Every photo found so far, by article title. One query, cached; new photos show up within the hour. */
async function storedPhotos(): Promise<Map<string, Photo | null>> {
  "use cache";
  cacheLife("hours");
  cacheTag("place-photos");
  const out = new Map<string, Photo | null>();
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await publicClient()
      .from("place_photos")
      .select("title, status, src, width, height, credit, license, page")
      .neq("status", "pending")
      .order("title")
      .range(from, from + 999);
    if (error || !data?.length) break;
    for (const r of data) {
      out.set(
        r.title,
        r.status === "found" && r.src && r.page
          ? { src: r.src, width: r.width ?? 800, height: r.height ?? 500, credit: r.credit ?? "Unknown author", license: r.license ?? "", page: r.page }
          : null,
      );
    }
    if (data.length < 1000) break;
  }
  return out;
}

// Titles asked for in this server process, so each is requested once, in small batches.
const asked = new Set<string>();
let queue: { title: string; search: string }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
function request(title: string, search: string) {
  if (asked.has(title) || asked.size > 5000) return;
  asked.add(title);
  queue.push({ title, search });
  timer ??= setTimeout(() => {
    const batch = queue.splice(0, 100);
    queue = [];
    timer = null;
    void publicClient().rpc("request_place_photos", { p_places: batch }).then(() => undefined, () => undefined);
  }, 50);
}

/**
 * A photo for a place, or null when there's none (yet). Photos are looked up in the background by
 * the photos-refresh worker; a place shown for the first time gets its photo within about 10 minutes.
 */
export async function placePhoto(title: string, search: string): Promise<Photo | null> {
  const stored = await storedPhotos();
  if (stored.has(title)) return stored.get(title) ?? null;
  request(title, search);
  return null;
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
