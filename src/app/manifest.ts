import type { MetadataRoute } from "next";

/** Lets WRLD install to a home screen from Safari or Chrome, and seeds the store apps. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "WRLD — trip planner",
    short_name: "WRLD",
    description: "Plan days around real arrival times, map your route, use your points, and see the whole budget.",
    start_url: "/trips",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fdf6f0",
    theme_color: "#253a33",
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
