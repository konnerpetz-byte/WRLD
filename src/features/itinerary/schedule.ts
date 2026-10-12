import type { TimeBlock, TimeBlockSlot } from "@/types/database";

/**
 * Picks a start time for something added to a Morning/Afternoon/Evening
 * block, in the local time of that day's city.
 *
 *  - Starts after anything already planned in the block.
 *  - Uses the sight's suggested start (opening / first good entry) when it
 *    fits in the block's free time.
 *  - Otherwise a sensible hour for the block, rounded up to :00 or :30.
 */

const SLOT_DEFAULT: Record<TimeBlockSlot, string> = { morning: "09:00", afternoon: "13:30", evening: "18:30" };
export const DEFAULT_VISIT_MINUTES = 90;

export function localHHMM(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(
    new Date(iso),
  );
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${h}:${m}`;
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export function planTime(input: {
  block: Pick<TimeBlock, "slot" | "starts_at" | "ends_at" | "available_from" | "available_until">;
  timeZone: string;
  /** End times ("HH:MM") of things already in the block */
  busyUntil: (string | null)[];
  suggestedStart: string | null;
  durationMinutes: number | null;
}): { start: string; end: string | null; fitsSuggested: boolean } {
  const { block, timeZone } = input;
  const freeStart = toMin(localHHMM(block.available_from ?? block.starts_at, timeZone));
  let freeEnd = toMin(localHHMM(block.available_until ?? block.ends_at, timeZone));
  if (freeEnd <= freeStart) freeEnd = 24 * 60; // evening runs to midnight

  const after = Math.max(freeStart, ...input.busyUntil.filter(Boolean).map((t) => toMin(t!)));
  const suggested = input.suggestedStart ? toMin(input.suggestedStart) : null;

  let start: number;
  let fitsSuggested = false;
  if (suggested !== null && suggested >= after && suggested < freeEnd) {
    start = suggested;
    fitsSuggested = true;
  } else {
    start = Math.max(after, toMin(SLOT_DEFAULT[block.slot]));
    start = Math.ceil(start / 30) * 30;
    if (start >= freeEnd) start = Math.ceil(after / 30) * 30;
    if (start >= 24 * 60) start = after;
  }

  const duration = input.durationMinutes ?? DEFAULT_VISIT_MINUTES;
  const endMin = start + duration;
  return { start: toHHMM(start), end: endMin < 24 * 60 ? toHHMM(endMin) : null, fitsSuggested };
}

/** "09:30" → "9:30 AM" */
export function formatClock(hhmm: string | null | undefined) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}
