import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";

import { NativeBridge } from "@/components/native/native-bridge";

import "./globals.css";

/** WRLD Sans: Outfit with diamond dots, built by scripts/build-font.py (SIL OFL 1.1). */
const wrldSans = localFont({
  variable: "--font-wrld",
  display: "swap",
  src: [
    { path: "./fonts/wrld-sans-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/wrld-sans-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/wrld-sans-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/wrld-sans-700.woff2", weight: "700", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: { default: "WRLD — plan the trip you'll actually take", template: "%s · WRLD" },
  description: "Plan days around real arrival times, map your route, use your points, and see the whole budget.",
  applicationName: "WRLD",
  appleWebApp: { capable: true, title: "WRLD", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#253a33" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1713" },
  ],
  // Draw edge to edge on phones; content pads itself with the safe-area insets.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${wrldSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        <NativeBridge />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
