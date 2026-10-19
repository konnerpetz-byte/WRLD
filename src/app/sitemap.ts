import type { MetadataRoute } from "next";

import { allTicketPlaces } from "@/features/tickets/data";

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wrldtrips.com";

/** Public pages only; trips are private. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const main: [string, number, "weekly" | "monthly" | "yearly"][] = [
    ["", 1, "weekly"],
    ["/plan", 0.9, "weekly"],
    ["/tickets", 0.9, "weekly"],
    ["/points-check", 0.7, "monthly"],
    ["/signup", 0.4, "yearly"],
    ["/privacy", 0.2, "yearly"],
    ["/terms", 0.2, "yearly"],
    ["/accessibility", 0.2, "yearly"],
    ["/how-wrld-works", 0.4, "monthly"],
  ];
  const tickets = (await allTicketPlaces()).map((p) => ({
    url: `${site}/tickets/${p.slug}`,
    lastModified: p.verified_on ?? undefined,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));
  return [...main.map(([p, priority, changeFrequency]) => ({ url: `${site}${p}`, changeFrequency, priority })), ...tickets];
}
