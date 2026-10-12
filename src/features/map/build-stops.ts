import { distanceKm } from "@/lib/geo";
import { formatDay, formatTime } from "@/lib/format";
import type { DayPlan } from "@/features/trips/queries";
import type { Lodging, TransitSegment } from "@/types/database";

export type MapStop = {
  id: string;
  kind: "activity" | "stay" | "arrive" | "depart";
  /** 1, 2, 3… for activities in visiting order; null for stays and travel */
  number: number | null;
  title: string;
  detail: string;
  latitude: number;
  longitude: number;
};

export type UnplacedStop = { id: string; title: string; detail: string };

export type MapDay = {
  dayId: string;
  label: string;
  stops: MapStop[];
  unplaced: UnplacedStop[];
  km: number;
};

const SLOT = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" } as const;

/** Orders each day's route: arrive or wake up at the stay → activities in block order → back to the stay or off to the airport. */
export function buildMapDays(days: DayPlan[], lodging: Lodging[], transit: TransitSegment[], timezone: string): MapDay[] {
  const live = transit.filter((t) => t.booking_status !== "cancelled");

  return days.map((day) => {
    const dayStart = day.blocks[0]?.starts_at ?? `${day.date}T00:00:00Z`;
    const dayEnd = day.blocks.at(-1)?.ends_at ?? `${day.date}T23:59:59Z`;
    const within = (iso: string) => iso >= dayStart && iso < dayEnd;

    const stay = lodging.find(
      (l) => l.booking_status !== "cancelled" && l.check_in_at < dayEnd && l.check_out_at > dayStart && l.latitude !== null,
    );
    const arriving = live.find((t) => t.direction === "outbound" && within(t.arrive_at) && t.destination_latitude !== null);
    const leaving = live.find((t) => t.direction === "return" && within(t.depart_at) && t.origin_latitude !== null);

    const stops: MapStop[] = [];
    const unplaced: UnplacedStop[] = [];

    if (arriving) {
      stops.push({
        id: `${arriving.id}-arrive`,
        kind: "arrive",
        number: null,
        title: `Land at ${arriving.destination_code ?? "the airport"}`,
        detail: [arriving.service_number, formatTime(arriving.arrive_at, timezone)].filter(Boolean).join(", "),
        latitude: arriving.destination_latitude!,
        longitude: arriving.destination_longitude!,
      });
    } else if (stay && stay.check_in_at < dayStart) {
      stops.push(stayStop(stay, "start"));
    }

    let n = 0;
    for (const block of day.blocks) {
      for (const item of block.items) {
        if (item.booking_status === "cancelled" || item.kind === "note") continue;
        const detail = SLOT[block.slot];
        if (item.latitude === null || item.longitude === null) {
          unplaced.push({ id: item.id, title: item.title, detail });
          continue;
        }
        stops.push({
          id: item.id,
          kind: "activity",
          number: ++n,
          title: item.title,
          detail: [detail, item.address].filter(Boolean).join(", "),
          latitude: item.latitude,
          longitude: item.longitude,
        });
      }
    }

    if (leaving) {
      stops.push({
        id: `${leaving.id}-depart`,
        kind: "depart",
        number: null,
        title: `Fly home from ${leaving.origin_code ?? "the airport"}`,
        detail: [leaving.service_number, formatTime(leaving.depart_at, timezone)].filter(Boolean).join(", "),
        latitude: leaving.origin_latitude!,
        longitude: leaving.origin_longitude!,
      });
    } else if (stay && stay.check_out_at > dayEnd) {
      stops.push(stayStop(stay, "end"));
    }

    let km = 0;
    for (let i = 1; i < stops.length; i++) km += distanceKm(stops[i - 1], stops[i]);

    return { dayId: day.id, label: formatDay(day.date), stops, unplaced, km };
  });
}

function stayStop(stay: Lodging, when: "start" | "end"): MapStop {
  return {
    id: `${stay.id}-${when}`,
    kind: "stay",
    number: null,
    title: stay.name,
    detail: when === "start" ? "Start the day here" : "Back for the night",
    latitude: stay.latitude!,
    longitude: stay.longitude!,
  };
}
