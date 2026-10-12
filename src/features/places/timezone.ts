import "server-only";

import tzlookup from "@photostructure/tz-lookup";

import { COUNTRY_TIMEZONE } from "@/features/trips/timezones";

/**
 * The time zone for a stop. Coordinates win (the US, Brazil, Australia…
 * have several zones), but near borders the coordinate lookup can pick the
 * neighbor's zone, so when the country's usual zone keeps the same clock
 * on that date we use the country's zone instead.
 */
export function timezoneFor(input: {
  latitude: number | null;
  longitude: number | null;
  countryCode: string | null;
  onDate: string;
}): string {
  const fallback = (input.countryCode && COUNTRY_TIMEZONE[input.countryCode]) || "UTC";
  if (input.latitude === null || input.longitude === null) return fallback;

  let fromCoords: string;
  try {
    fromCoords = tzlookup(input.latitude, input.longitude);
  } catch {
    return fallback;
  }
  if (fallback !== "UTC" && offsetMinutes(fallback, input.onDate) === offsetMinutes(fromCoords, input.onDate)) {
    return fallback;
  }
  return fromCoords;
}

function offsetMinutes(timeZone: string, isoDate: string): number | null {
  try {
    const at = new Date(`${isoDate}T12:00:00Z`);
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" }).formatToParts(at);
    const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
    const m = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
    return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
  } catch {
    return null;
  }
}
