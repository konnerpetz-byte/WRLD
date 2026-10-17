import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";

import { NativeBridge } from "@/components/native/native-bridge";
import { UsdRates } from "@/components/usd-rates";
import { setUsdRates } from "@/lib/currency";
import { liveUsdRates } from "@/lib/usd-rates";

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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://wrldtrips.com"),
  title: { default: "WRLD: group trips, planned together and split fairly", template: "%s · WRLD" },
  description:
    "Turn the group chat into a trip. Plan the days together, see what everyone's points cover, and split it fairly, even when someone pays in miles. Free for the group.",
  applicationName: "WRLD",
  appleWebApp: { capable: true, title: "WRLD", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0f3d33" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1a16" },
  ],
  // Draw edge to edge on phones; content pads itself with the safe-area insets.
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Every price on the site is shown in USD, converted at today's rate.
  const rates = await liveUsdRates();
  setUsdRates(rates);
  return (
    <html lang="en" className={`${wrldSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        <UsdRates rates={rates} />
        <NativeBridge />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
