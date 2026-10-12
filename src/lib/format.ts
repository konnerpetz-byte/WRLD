/** Display helpers. All amounts arrive from the database as numbers or numeric strings. */

export function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function formatMoney(value: number | string | null | undefined, currency = "USD", opts: { cents?: boolean } = {}) {
  const n = toNumber(value);
  if (n === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: opts.cents === false || Number.isInteger(n) ? 0 : 2,
    minimumFractionDigits: opts.cents === false || Number.isInteger(n) ? 0 : 2,
  }).format(n);
}

export function formatPoints(value: number | string | null | undefined) {
  const n = toNumber(value);
  return n === null ? "—" : new Intl.NumberFormat("en-US").format(n);
}

/** "2:00 PM" in the given timezone. */
export function formatTime(iso: string | null | undefined, timeZone: string) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(iso));
}

/** "Sun, Nov 1" for a YYYY-MM-DD date (no timezone shift). */
export function formatDay(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

export function formatDateRange(start: string, end: string) {
  const fmt = (s: string, withYear: boolean) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      ...(withYear ? { year: "numeric" } : {}),
      timeZone: "UTC",
    }).format(new Date(Date.UTC(y, m - 1, d)));
  };
  return `${fmt(start, false)} – ${fmt(end, true)}`;
}

export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/**
 * Convert a wall-clock time in a timezone ("2026-11-01T23:00" in "Europe/Lisbon")
 * to a UTC ISO string. Used for flight and hotel times typed into forms.
 */
export function zonedTimeToUtc(local: string, timeZone: string): string {
  const [datePart, timePart = "00:00"] = local.split("T");
  const [y, mo, d] = datePart.split("-").map(Number);
  const [h, mi] = timePart.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);

  const offsetAt = (ms: number) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(new Date(ms));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute")) - ms;
  };

  // Two passes handle the hour around daylight-saving changes.
  let utc = guess - offsetAt(guess);
  utc = guess - offsetAt(utc);
  return new Date(utc).toISOString();
}
