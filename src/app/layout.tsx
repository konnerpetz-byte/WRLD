import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Layover — trip planner", template: "%s · Layover" },
  description: "Plan trips around real arrival times, use your points, and see the whole budget.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
