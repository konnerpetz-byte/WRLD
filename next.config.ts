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
const policy = () => [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://${supabase} wss://${supabase} https://tiles.openfreemap.org ${mapStyle}`.trim(),
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  // GetYourGuide panels are plain sandboxed iframes (src/features/experiences/gyg-widget.tsx).
  "frame-src https://widget.getyourguide.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "manifest-src 'self'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

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
  // Destination photos are free stock from Unsplash (Unsplash License: free for commercial use, no
  // attribution required; credits are kept in src/features/trips/templates.ts anyway).
  images: { remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com", pathname: "/photo-*" }] },
  // Import bookings accepts files up to 5 MB.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  // Reading PDFs without a text layer (OCR): native canvas and Tesseract stay outside the bundle,
  // and the English language data ships with the import pages.
  serverExternalPackages: ["@napi-rs/canvas", "tesseract.js", "tesseract.js-core"],
  // The Tesseract worker runs in its own thread and loads these at runtime, so tracing can't see them.
  // (Keys are globs: "[tripId]" would be read as a character class, hence "*".)
  outputFileTracingIncludes: {
    "/trips/*/import": [
      "./node_modules/@tesseract.js-data/eng/4.0.0/**",
      "./node_modules/tesseract.js/src/**",
      "./node_modules/tesseract.js-core/**",
      ...["bmp-js", "idb-keyval", "is-url", "node-fetch", "whatwg-url", "tr46", "webidl-conversions", "regenerator-runtime", "wasm-feature-detect", "zlibjs"].map(
        (p) => `./node_modules/${p}/**`,
      ),
    ],
  },
  async headers() {
    return [
      { source: "/:path*", headers: headersWith(policy()) },
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
