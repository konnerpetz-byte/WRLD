import type { NextConfig } from "next";

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host : "*.supabase.co";
const mapStyle = process.env.NEXT_PUBLIC_MAP_STYLE_URL ? new URL(process.env.NEXT_PUBLIC_MAP_STYLE_URL).origin : "";
const dev = process.env.NODE_ENV !== "production";

/**
 * Content Security Policy. Next.js streams inline scripts, and static
 * (prerendered) pages can't carry per-request nonces, so inline scripts are
 * allowed, but only from this site. Everything else is locked to the hosts
 * the app really uses: Supabase (sign-in, chat, photos) and the map tiles.
 */
const policy = (extra: { script?: string; connect?: string; frame?: string; style?: string; font?: string } = {}) => [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}${extra.script ?? ""}`,
  `style-src 'self' 'unsafe-inline'${extra.style ?? ""}`,
  "img-src 'self' data: blob: https:",
  `font-src 'self' data:${extra.font ?? ""}`,
  `connect-src 'self' https://${supabase} wss://${supabase} https://tiles.openfreemap.org ${mapStyle}${extra.connect ?? ""}`.trim(),
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  // GetYourGuide panels are plain sandboxed iframes (src/features/experiences/gyg-widget.tsx).
  `frame-src https://widget.getyourguide.com${extra.frame ?? ""}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "manifest-src 'self'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

/**
 * The public home page also loads the Travelpayouts partner script
 * (src/components/partners/partner-script.tsx), only for signed-out visitors.
 * It pulls widgets from hosts Travelpayouts doesn't publish, so this one page
 * allows HTTPS scripts. No signed-in page does: the app keeps the strict policy.
 */
const homeCsp = policy({
  script: " https:",
  connect: " https:",
  frame: " https:",
  style: " https://fonts.googleapis.com",
  font: " https://fonts.gstatic.com",
});

const headersWith = (csp: string) => [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=(), usb=(), browsing-topics=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  poweredByHeader: false,
  // Import bookings accepts files up to 5 MB.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  async headers() {
    return [
      { source: "/", headers: headersWith(homeCsp) },
      { source: "/:path+", headers: headersWith(policy()) },
    ];
  },
  // Points wallet and Points flights became one Points explorer.
  async redirects() {
    return [
      { source: "/wallet", destination: "/points/wallet", permanent: true },
      { source: "/flights", destination: "/points", permanent: true },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
