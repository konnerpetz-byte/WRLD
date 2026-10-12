"use client";

/**
 * Phone features. Inside the iOS/Android apps these use native plugins;
 * in a regular browser they fall back to web APIs, so callers don't care where they run.
 */
import { Capacitor } from "@capacitor/core";

export const isNativeApp = () => Capacitor.isNativePlatform();

export type ShareResult = "shared" | "copied" | "cancelled" | "unavailable";

export async function shareLink({ title, text, url }: { title: string; text: string; url: string }): Promise<ShareResult> {
  try {
    if (isNativeApp()) {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title, text, url, dialogTitle: "Share trip" });
      return "shared";
    }
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return "shared";
    }
    await navigator.clipboard.writeText(`${text} ${url}`);
    return "copied";
  } catch (error) {
    // Closing the share sheet throws in both native and web; that's not an error.
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("cancel") || message.includes("abort")) return "cancelled";
    return "unavailable";
  }
}

export type LocationResult =
  | { ok: true; latitude: number; longitude: number; accuracy: number }
  | { ok: false; reason: "denied" | "unavailable" };

export async function currentLocation(): Promise<LocationResult> {
  try {
    if (isNativeApp()) {
      const { Geolocation } = await import("@capacitor/geolocation");
      const permission = await Geolocation.checkPermissions();
      if (permission.location !== "granted") {
        const asked = await Geolocation.requestPermissions({ permissions: ["location"] });
        if (asked.location !== "granted") return { ok: false, reason: "denied" };
      }
      const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10_000 });
      return { ok: true, latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy };
    }
    if (!navigator.geolocation) return { ok: false, reason: "unavailable" };
    return await new Promise((resolve) =>
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ ok: true, latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }),
        (e) => resolve({ ok: false, reason: e.code === e.PERMISSION_DENIED ? "denied" : "unavailable" }),
        { enableHighAccuracy: true, timeout: 10_000 },
      ),
    );
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
