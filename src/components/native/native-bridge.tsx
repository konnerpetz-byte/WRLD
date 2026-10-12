"use client";

import { useEffect } from "react";

import { isNativeApp } from "@/lib/native";

/**
 * Runs once inside the iOS/Android apps: status bar colors, Android back button.
 * Renders nothing, and does nothing in a regular browser.
 */
export function NativeBridge() {
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
      removeBack = () => void handle.remove();
    })();

    return () => removeBack?.();
  }, []);

  return null;
}
