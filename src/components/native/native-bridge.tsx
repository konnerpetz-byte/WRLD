"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { isNativeApp } from "@/lib/native";

/**
 * Runs once inside the iOS/Android apps: status bar colors, Android back
 * button, and links from the iOS share extension.
 * Renders nothing, and does nothing in a regular browser.
 */
export function NativeBridge() {
  const router = useRouter();
  useEffect(() => {
    if (!isNativeApp()) return;
    let removeBack: (() => void) | undefined;

    (async () => {
      document.documentElement.dataset.native = "true";

      const { StatusBar, Style } = await import("@capacitor/status-bar");
      await StatusBar.setStyle({ style: Style.Dark }).catch(() => {});

      const { App } = await import("@capacitor/app");
      const handle = await App.addListener("backButton", ({ canGoBack }) => {
        // Back goes back through pages; on the first screen it closes the app.
        if (canGoBack) window.history.back();
        else App.exitApp();
      });
      // iOS share extension → wrld://share?url=…&text=… → the /share page.
      const open = await App.addListener("appUrlOpen", ({ url }) => {
        try {
          const u = new URL(url);
          if (u.protocol === "wrld:" && (u.host === "share" || u.pathname.replace(/^\/+/, "") === "share")) {
            router.push(`/share${u.search}`);
          }
        } catch {
          // ignore malformed links
        }
      });
      removeBack = () => {
        void handle.remove();
        void open.remove();
      };
    })();

    return () => removeBack?.();
  }, [router]);

  return null;
}
