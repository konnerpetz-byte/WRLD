import { distanceKm } from "@/lib/geo";
import { formatDay, formatTime } from "@/lib/format";
import type { DayPlan } from "@/features/trips/queries";
import { MODE, placeLabel } from "@/features/transit/modes";
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
  /** The city that day, used to frame the map when nothing is placed yet */
  city: string | null;
  center: [number, number] | null;
  stops: MapStop[];
  unplaced: UnplacedStop[];
  km: number;
};

const SLOT = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" } as const;

/** Orders each day's route: arrive or wake up at the stay → activities in block order → back to the stay or off to the airport. */
export function buildMapDays(days: DayPlan[], lodging: Lodging[], transit: TransitSegment[], tripTimezone: string): MapDay[] {
  const live = transit.filter((t) => t.booking_status !== "cancelled");

  return days.map((day) => {
    const timezone = day.tz ?? tripTimezone;
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
        title: `${MODE[arriving.mode].arriveVerb} ${placeLabel(arriving.destination_code, arriving.destination_name) ?? `the ${MODE[arriving.mode].terminal}`}`,
        detail: [arriving.service_number, formatTime(arriving.arrive_at, timezone)].filter(Boolean).join(", "),
        latitude: arriving.destination_latitude!,
        longitude: arriving.destination_longitude!,
      });
    } else if (stay && stay.check_in_at < dayStart) {
      stops.push(stayStop(stay, "start"));
    }

    // Trains, buses, ferries and drives between stops (or day trips) that day,
    // slotted into the part of the day they happen in: arrivals open their
    // block; departures open it if they leave in its first half, else close it.
    const travel: { stop: MapStop; at: string; edge: "open" | "close" }[] = [];
    const blockOf = (iso: string) => {
      const i = day.blocks.findIndex((b) => iso >= b.starts_at && iso < b.ends_at);
      return i < 0 ? (iso < dayStart ? 0 : day.blocks.length - 1) : i;
    };
    for (const leg of live.filter((t) => t.direction === "within")) {
      const m = MODE[leg.mode];
      const name = leg.service_number ?? leg.carrier ?? m.label;
      if (within(leg.depart_at) && leg.origin_latitude !== null && leg.origin_longitude !== null) {
        const b = day.blocks[blockOf(leg.depart_at)];
        const mid = b ? new Date((Date.parse(b.starts_at) + Date.parse(b.ends_at)) / 2).toISOString() : leg.depart_at;
        travel.push({
          at: leg.depart_at,
          edge: leg.depart_at < mid ? "open" : "close",
          stop: {
            id: `${leg.id}-board`,
            kind: "depart",
            number: null,
            title: `${m.label} from ${placeLabel(leg.origin_code, leg.origin_name) ?? `the ${m.terminal}`}`,
            detail: [name, formatTime(leg.depart_at, timezone)].filter(Boolean).join(", "),
            latitude: leg.origin_latitude,
            longitude: leg.origin_longitude,
          },
        });
      }
      if (within(leg.arrive_at) && leg.destination_latitude !== null && leg.destination_longitude !== null) {
        travel.push({
          at: leg.arrive_at,
          edge: "open",
          stop: {
            id: `${leg.id}-alight`,
            kind: "arrive",
            number: null,
            title: `${m.arriveVerb} ${placeLabel(leg.destination_code, leg.destination_name) ?? `the ${m.terminal}`}`,
            detail: [name, formatTime(leg.arrive_at, timezone)].filter(Boolean).join(", "),
            latitude: leg.destination_latitude,
            longitude: leg.destination_longitude,
          },
        });
      }
    }
    travel.sort((a, b) => a.at.localeCompare(b.at));

    let n = 0;
    day.blocks.forEach((block, i) => {
      const here = travel.filter((t) => blockOf(t.at) === i);
      for (const t of here) if (t.edge === "open") stops.push(t.stop);
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
      for (const t of here) if (t.edge === "close") stops.push(t.stop);
    });
    if (!day.blocks.length) stops.push(...travel.map((t) => t.stop));

    if (leaving) {
      stops.push({
        id: `${leaving.id}-depart`,
        kind: "depart",
        number: null,
        title: `${leaving.mode === "flight" ? "Fly" : leaving.mode === "car" ? "Drive" : `Take the ${MODE[leaving.mode].label.toLowerCase()}`} home from ${placeLabel(leaving.origin_code, leaving.origin_name) ?? `the ${MODE[leaving.mode].terminal}`}`,
        detail: [leaving.service_number, formatTime(leaving.depart_at, timezone)].filter(Boolean).join(", "),
        latitude: leaving.origin_latitude!,
        longitude: leaving.origin_longitude!,
      });
    } else if (stay && stay.check_out_at > dayEnd) {
      stops.push(stayStop(stay, "end"));
    }

    let km = 0;
    for (let i = 1; i < stops.length; i++) km += distanceKm(stops[i - 1], stops[i]);

    const center: [number, number] | null =
      day.stop?.latitude != null && day.stop.longitude != null ? [day.stop.latitude, day.stop.longitude] : null;
    return { dayId: day.id, label: formatDay(day.date), city: day.stop?.city ?? null, center, stops, unplaced, km };
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
