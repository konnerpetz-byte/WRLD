// photos-refresh: finds a free, credited photo for each place title in public.place_photos.
//
// The lead photo of the place's English Wikipedia article (the one editors chose), only when
// the file is freely licensed (public domain, CC0, CC BY, CC BY-SA), with the author and
// license from Wikimedia Commons. Batched: 50 titles per request, a few requests per run, an
// identifying User-Agent and maxlag, as Wikimedia's API etiquette asks. Stops for the run on a
// rate limit and leaves the rest pending. Rechecks old results every 60 days.
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const API = "https://en.wikipedia.org/w/api.php";
const UA = { "User-Agent": "WRLD trip planner photo lookup (https://wrldtrips.com; privacy@wrldtrips.com)" };
const NOT_A_PHOTO = /(map|flag|seal|coat[_ ]of[_ ]arms|logo|locator|location|diagram|emblem|signature|\.svg$|\.gif$)/i;
const FREE = /^(cc0|cc[ -]by|public domain|pd\b|pd-)/i;

class RateLimited extends Error {}

async function api<T>(params: Record<string, string>): Promise<T> {
  const u = new URL(API);
  u.search = new URLSearchParams({ format: "json", formatversion: "2", maxlag: "5", ...params }).toString();
  const res = await fetch(u, { headers: UA, signal: AbortSignal.timeout(20000) });
  if (res.status === 429 || res.status === 403 || res.status >= 500) throw new RateLimited(`Wikipedia ${res.status}`);
  const body = await res.json();
  if (body?.error?.code === "maxlag") throw new RateLimited("maxlag");
  return body as T;
}

const text = (html: string) =>
  html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, " ").trim();
const clean = (v: string) => text(v).replace(/\(\s*(talk|uploads|contribs|contributions)\s*\)/gi, "").replace(/\s+/g, " ").trim();

type Page = { title: string; pageimage?: string; thumbnail?: { source: string; width: number; height: number }; index?: number };
type Lead = { file: string; src: string; width: number; height: number };

/** Lead images for up to 50 exact titles, keyed by the title as asked. */
async function leads(titles: string[]): Promise<Map<string, Lead>> {
  type R = { query?: { pages?: Page[]; normalized?: { from: string; to: string }[]; redirects?: { from: string; to: string }[] } };
  const r = await api<R>({ action: "query", titles: titles.join("|"), redirects: "1", prop: "pageimages", piprop: "thumbnail|name", pithumbsize: "800", pilicense: "free", pilimit: "50" });
  const back = new Map<string, string>();
  for (const n of r.query?.normalized ?? []) back.set(n.to, n.from);
  for (const n of r.query?.redirects ?? []) back.set(n.to, back.get(n.from) ?? n.from);
  const out = new Map<string, Lead>();
  for (const p of r.query?.pages ?? []) {
    if (!p.pageimage || !p.thumbnail || NOT_A_PHOTO.test(p.pageimage)) continue;
    out.set(back.get(p.title) ?? p.title, { file: p.pageimage, ...p.thumbnail, src: p.thumbnail.source });
  }
  return out;
}

/** The best search hit with a lead image, for a title that has none of its own. */
async function searched(search: string): Promise<Lead | null> {
  const r = await api<{ query?: { pages?: Page[] } }>({
    action: "query", generator: "search", gsrsearch: search, gsrlimit: "4", gsrnamespace: "0",
    prop: "pageimages", piprop: "thumbnail|name", pithumbsize: "800", pilicense: "free",
  });
  const p = (r.query?.pages ?? []).sort((a, b) => (a.index ?? 99) - (b.index ?? 99)).find((x) => x.pageimage && x.thumbnail && !NOT_A_PHOTO.test(x.pageimage));
  return p ? { file: p.pageimage!, src: p.thumbnail!.source, width: p.thumbnail!.width, height: p.thumbnail!.height } : null;
}

/** Author and license for up to 50 files. */
async function credits(files: string[]) {
  type R = { query?: { pages?: { title: string; imageinfo?: { extmetadata?: Record<string, { value?: string }> }[] }[]; normalized?: { from: string; to: string }[] } };
  const r = await api<R>({ action: "query", titles: files.map((f) => `File:${f}`).join("|"), prop: "imageinfo", iiprop: "extmetadata", iiextmetadatafilter: "Artist|LicenseShortName|Credit" });
  const back = new Map<string, string>();
  for (const n of r.query?.normalized ?? []) back.set(n.to, n.from);
  const out = new Map<string, { credit: string; license: string }>();
  for (const p of r.query?.pages ?? []) {
    const meta = p.imageinfo?.[0]?.extmetadata ?? {};
    const license = text(meta.LicenseShortName?.value ?? "");
    const credit = clean(meta.Artist?.value ?? "") || clean(meta.Credit?.value ?? "") || "Unknown author";
    out.set((back.get(p.title) ?? p.title).replace(/^File:/, ""), { credit: credit.slice(0, 80), license });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Use POST" });
  const url = Deno.env.get("SUPABASE_URL")!;
  let secret: string | undefined;
  try { secret = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default; } catch { secret = undefined; }
  secret ??= Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) return json(500, { error: "Not configured" });
  const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const token = req.headers.get("x-wrld-cron") ?? "";
  if (token.length < 32) return json(401, { error: "Unauthorized" });
  const { data: ok } = await db.rpc("award_cron_token_ok", { p_token: token });
  if (ok !== true) return json(401, { error: "Unauthorized" });

  const stale = new Date(Date.now() - 60 * 86400000).toISOString();
  const { data: todo, error } = await db
    .from("place_photos")
    .select("title, search")
    .or(`status.eq.pending,checked_at.lt.${stale}`)
    .order("requested_at")
    .limit(250);
  if (error) return json(500, { error: error.message });
  const rows = (todo ?? []) as { title: string; search: string | null }[];

  let found = 0, none = 0, searchesLeft = 40, stopped: string | null = null;
  try {
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      const lead = await leads(batch.map((r) => r.title));
      const later = new Set<string>(); // out of searches this run: try again next run
      for (const r of batch) {
        if (lead.has(r.title) || !r.search) continue;
        if (searchesLeft <= 0) {
          later.add(r.title);
          continue;
        }
        searchesLeft--;
        const hit = await searched(r.search);
        if (hit) lead.set(r.title, hit);
      }
      const files = [...new Set([...lead.values()].map((l) => l.file))];
      const lic = files.length ? await credits(files) : new Map();
      const now = new Date().toISOString();
      const updates = batch
        .filter((r) => !later.has(r.title))
        .map((r) => {
          const l = lead.get(r.title);
          const c = l ? lic.get(l.file) : undefined;
          if (l && c && FREE.test(c.license)) {
            found++;
            return {
              title: r.title, search: r.search, status: "found", src: l.src, width: l.width, height: l.height,
              credit: c.credit, license: c.license,
              page: `https://commons.wikimedia.org/wiki/${encodeURIComponent(`File:${l.file}`.replace(/ /g, "_"))}`,
              checked_at: now,
            };
          }
          none++;
          return { title: r.title, search: r.search, status: "none", src: null, width: null, height: null, credit: null, license: null, page: null, checked_at: now };
        });
      if (updates.length) {
        const { error: e } = await db.from("place_photos").upsert(updates, { onConflict: "title" });
        if (e) throw new Error(e.message);
      }
    }
  } catch (e) {
    stopped = (e as Error).message; // rate limited or failed: the rest stay pending for the next run
  }
  return json(200, { checked: rows.length, found, none, stopped });
});
