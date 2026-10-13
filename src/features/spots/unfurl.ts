import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import type { SpotSource } from "@/types/database";

/**
 * Reads the public preview of a shared link (TikTok, Instagram, YouTube,
 * Google Maps or any web page): title, author, thumbnail, and for map links
 * the place and coordinates.
 *
 * Safety: the server only fetches public http(s) addresses. Private,
 * loopback and link-local addresses are refused (including after
 * redirects), responses are capped at 512 KB, and every request times out.
 */

export type LinkPreview = {
  url: string;
  source: SpotSource;
  title: string | null;
  author: string | null;
  thumbnailUrl: string | null;
  placeName: string | null;
  latitude: number | null;
  longitude: number | null;
};

const USER_AGENT = "Mozilla/5.0 (compatible; WRLDLinkPreview/1.0; +https://wrldtrips.com)";

export function sourceOf(url: string): SpotSource {
  const host = hostname(url);
  if (!host) return "link";
  if (/(^|\.)tiktok\.com$/.test(host)) return "tiktok";
  if (/(^|\.)instagram\.com$/.test(host) || host === "instagr.am") return "instagram";
  if (/(^|\.)youtube\.com$/.test(host) || host === "youtu.be") return "youtube";
  if (/^maps\.app\.goo\.gl$|^goo\.gl$|(^|\.)google\.[a-z.]+$/.test(host) && /maps|goo\.gl/.test(url)) return "maps";
  if (/(^|\.)maps\.apple\.com$/.test(host)) return "maps";
  return "link";
}

/** First http(s) link in shared text ("Check this out https://vm.tiktok.com/…"). */
export function firstUrl(text: string | null | undefined): string | null {
  const m = text?.match(/https?:\/\/[^\s<>"']+/i);
  return m ? m[0].replace(/[).,!?]+$/, "") : null;
}

export async function unfurl(rawUrl: string): Promise<LinkPreview> {
  const url = rawUrl.trim();
  const source = sourceOf(url);
  const base: LinkPreview = { url, source, title: null, author: null, thumbnailUrl: null, placeName: null, latitude: null, longitude: null };

  try {
    if (source === "tiktok") {
      const o = await oembed(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
      if (o) return { ...base, title: o.title ?? null, author: o.author_name ?? null, thumbnailUrl: httpsOnly(o.thumbnail_url) };
    }
    if (source === "youtube") {
      const o = await oembed(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
      if (o) return { ...base, title: o.title ?? null, author: o.author_name ?? null, thumbnailUrl: httpsOnly(o.thumbnail_url) };
    }

    // Everything else (and fallbacks): read the page's Open Graph tags.
    const page = await safeFetch(url);
    if (!page) return { ...base, ...(source === "maps" ? mapsFromUrl(url) : {}) };
    const fromFinalUrl = source === "maps" ? mapsFromUrl(page.finalUrl) : {};
    const og = (prop: string) => meta(page.html, prop);
    return {
      ...base,
      title: clean(og("og:title") ?? titleTag(page.html)),
      author: clean(og("og:site_name")),
      thumbnailUrl: httpsOnly(og("og:image")),
      ...fromFinalUrl,
    };
  } catch {
    return base;
  }
}

/** Google Maps URLs carry the place name and "@lat,lng" (or "!3dLAT!4dLNG"). */
function mapsFromUrl(url: string): Partial<LinkPreview> {
  try {
    const u = new URL(url);
    const name = /\/place\/([^/]+)/.exec(u.pathname)?.[1];
    const precise = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(url);
    const at = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(url);
    const q = u.searchParams.get("q") ?? u.searchParams.get("query");
    const coords = precise ?? at;
    return {
      placeName: name ? decodeURIComponent(name.replace(/\+/g, " ")) : q,
      latitude: coords ? Number(coords[1]) : null,
      longitude: coords ? Number(coords[2]) : null,
    };
  } catch {
    return {};
  }
}

type OEmbed = { title?: string; author_name?: string; thumbnail_url?: string };
async function oembed(endpoint: string): Promise<OEmbed | null> {
  const r = await safeFetch(endpoint, true);
  if (!r) return null;
  try {
    return JSON.parse(r.html) as OEmbed;
  } catch {
    return null;
  }
}

/** Fetch a public http(s) page (never private addresses), capped at 512 KB. */
export async function safeFetch(start: string, json = false): Promise<{ html: string; finalUrl: string } | null> {
  let url = start;
  for (let hop = 0; hop < 4; hop++) {
    if (!(await isPublicUrl(url))) return null;
    const response = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": USER_AGENT, Accept: json ? "application/json" : "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(5000),
    });
    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get("location");
      if (!next) return null;
      url = new URL(next, url).toString();
      continue;
    }
    if (!response.ok || !response.body) return null;
    return { html: await readCapped(response.body, 512 * 1024), finalUrl: url };
  }
  return null;
}

async function readCapped(body: ReadableStream<Uint8Array>, max: number) {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < max) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    size += value.byteLength;
  }
  reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, max));
}

async function isPublicUrl(raw: string) {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (!["http:", "https:"].includes(u.protocol) || u.username || u.password) return false;
  if (u.port && !["80", "443"].includes(u.port)) return false;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) return false;
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  return addresses.length > 0 && addresses.every((a) => !isPrivateAddress(a.address));
}

function isPrivateAddress(ip: string) {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivateAddress(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224
  );
}

function meta(html: string, prop: string) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop.replace(".", "\\.")}["'][^>]*>`, "i");
  const tag = re.exec(html)?.[0];
  return tag ? decode(/content=["']([^"']*)["']/i.exec(tag)?.[1] ?? "") || null : null;
}
const titleTag = (html: string) => decode(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? "") || null;
const clean = (s: string | null | undefined) => (s ? s.replace(/\s+/g, " ").trim().slice(0, 300) || null : null);
const httpsOnly = (s: string | null | undefined) => (s && /^https:\/\//.test(s) && s.length <= 2000 ? s : null);
function decode(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}
function hostname(url: string) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}
