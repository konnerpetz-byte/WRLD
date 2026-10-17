import type { MetadataRoute } from "next";

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wrldtrips.com";

/** Public pages only; trips are private. */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/points-check", "/signup", "/privacy", "/terms", "/cookies", "/refunds", "/accessibility"];
  return pages.map((p) => ({ url: `${site}${p}`, changeFrequency: p === "" || p === "/points-check" ? "weekly" : "yearly", priority: p === "" ? 1 : p === "/points-check" ? 0.8 : 0.3 }));
}
