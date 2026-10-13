"use client";

import { useEffect } from "react";

const SRC = "https://tp-em.com/NTg1MTAx.js?t=585101";

/**
 * Travelpayouts "Drive" partner script, on the public home page only.
 *
 * Third-party code never runs where trip data or a sign-in lives:
 * - not loaded for signed-in visitors (their sign-in cookie is readable by page scripts)
 * - not loaded when the browser sends Global Privacy Control or Do Not Track
 * - not loaded for visitors in Europe or the UK, where it would need consent first
 * Disclosed in the Privacy and Cookie policies.
 */
export function PartnerScript() {
  useEffect(() => {
    try {
      if (document.cookie.split(/;\s*/).some((c) => /^sb-[^=]*-auth-token/.test(c))) return;
      const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
      if (nav.globalPrivacyControl === true || navigator.doNotTrack === "1") return;
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
      if (/^Europe\//.test(tz) || /^Atlantic\/(Reykjavik|Canary|Madeira|Azores|Faroe)$/.test(tz)) return;
      if (document.querySelector("script[data-wrld-partner]")) return;
      const s = document.createElement("script");
      s.async = true;
      s.src = SRC;
      s.setAttribute("data-cmp-ab", "2");
      s.setAttribute("data-wrld-partner", "travelpayouts");
      document.head.appendChild(s);
    } catch {
      // Never let a partner script break the page.
    }
  }, []);
  return null;
}
