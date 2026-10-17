import type { MetadataRoute } from "next";

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wrldtrips.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/trips", "/profile", "/points$", "/points/", "/invite", "/auth", "/dev", "/api"] },
    sitemap: `${site}/sitemap.xml`,
  };
}
