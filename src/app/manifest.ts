import type { MetadataRoute } from "next";

/** Lets WRLD install to a home screen from Safari or Chrome, and seeds the store apps. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "WRLD — trip planner",
    short_name: "WRLD",
    description: "The dream trip, on a budget the whole group can do: where your money goes furthest, official ticket sites, and a fair split.",
    start_url: "/trips",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f3f7f4",
    theme_color: "#0f3d33",
    categories: ["travel", "navigation"],
    // Installed on Android, WRLD shows up in the share sheet (TikTok, Instagram, Maps…).
    share_target: { action: "/share", method: "GET", params: { title: "title", text: "text", url: "url" } },
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
