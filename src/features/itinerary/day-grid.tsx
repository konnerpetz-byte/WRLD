import { MapPin, Plane } from "lucide-react";

import { MODE, placeLabel } from "@/features/transit/modes";

import type { DayPlan } from "@/features/trips/queries";
import { formatDay, formatDuration, formatTime } from "@/lib/format";
import type { Lodging, TimeBlock, TransitSegment } from "@/types/database";
import { AddActivityForm } from "./add-activity-form";
import { ItemRow } from "./item-row";

const SLOT_LABEL = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" } as const;
const SLOT_HOURS = { morning: "6 AM – 12 PM", afternoon: "12 – 5 PM", evening: "5 PM – midnight" } as const;

type Trip = { id: string; timezone: string; currency: string; party_size: number };

export function DayGrid({
  trip,
  days,
  transit,
  lodging,
  canEdit,
  votes,
}: {
  votes?: Map<string, { count: number; mine: boolean }>;
  trip: Trip;
  days: DayPlan[];
  transit: TransitSegment[];
  lodging: Lodging[];
  canEdit: boolean;
}) {
  const live = transit.filter((t) => t.booking_status !== "cancelled");
  const lastArrival = live.filter((t) => t.direction === "outbound").map((t) => t.arrive_at).sort().at(-1);

  return (
    <div className="grid gap-3">
      <div className="sticky top-0 z-10 hidden grid-cols-[8rem_repeat(3,minmax(0,1fr))] gap-3 bg-background/95 py-2 text-sm text-muted-foreground backdrop-blur lg:grid">
        <span />
        {(Object.keys(SLOT_LABEL) as (keyof typeof SLOT_LABEL)[]).map((slot) => (
          <span key={slot}>
            <span className="font-medium text-foreground">{SLOT_LABEL[slot]}</span> {SLOT_HOURS[slot]}
          </span>
        ))}
      </div>

      {days.map((day, i) => {
        const prev = days[i - 1];
        const newCity = day.stop && (!prev || prev.stop?.id !== day.stop.id);
        const near =
          day.stop?.latitude != null && day.stop.longitude != null
            ? { latitude: day.stop.latitude, longitude: day.stop.longitude }
            : null;
        return (
        <section
          key={day.id}
          aria-labelledby={`day-${day.id}`}
          className={`grid gap-3 border-t pt-3 lg:grid-cols-[8rem_repeat(3,minmax(0,1fr))] ${newCity && i > 0 ? "border-t-2 border-primary" : ""}`}
        >
          <div className="lg:pt-2">
            <h2 id={`day-${day.id}`} className="text-lg font-semibold">
              {formatDay(day.date)}
            </h2>
            {day.stop && (
              <p className={`flex items-center gap-1 text-sm ${newCity ? "font-medium text-primary" : "text-muted-foreground"}`}>
                <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                {newCity && i > 0 ? `To ${day.stop.city}` : day.stop.city}
              </p>
            )}
          </div>
          {day.blocks.map((block) => (
            <BlockCell
              key={block.id}
              near={near}
              votes={votes}
              trip={{ ...trip, timezone: day.tz }}
              block={block}
              transit={live}
              lodging={lodging}
              beforeArrival={Boolean(lastArrival && block.ends_at <= lastArrival)}
              canEdit={canEdit}
            />
          ))}
        </section>
        );
      })}
    </div>
  );
}

function BlockCell({
  votes,
  near,
  trip,
  block,
  transit,
  lodging,
  beforeArrival,
  canEdit,
}: {
  votes?: Map<string, { count: number; mine: boolean }>;
  near: { latitude: number; longitude: number } | null;
  trip: Trip;
  block: DayPlan["blocks"][number];
  transit: TransitSegment[];
  lodging: Lodging[];
  beforeArrival: boolean;
  canEdit: boolean;
}) {
  const label = <span className="text-xs font-medium text-muted-foreground lg:hidden">{SLOT_LABEL[block.slot]}</span>;
  const inWindow = (iso: string) => iso >= block.starts_at && iso < block.ends_at;

  if (block.travel_event === "arrival") {
    const leg = transit.filter((t) => t.direction === "outbound" && inWindow(t.arrive_at)).at(-1);
    const stay = lodging.find((l) => l.check_in_at <= block.ends_at && l.check_out_at > block.starts_at);
    return (
      <TravelPass label={label} block={block} timezone={trip.timezone}>
        <PassLine leg={leg} verb="Land" time={leg?.arrive_at} timezone={trip.timezone} />
        <p className="text-sm">
          {block.available_minutes >= 45
            ? `Free from ${formatTime(block.available_from, trip.timezone)}`
            : stay
              ? `Then check in at ${stay.name}`
              : "Then check in and settle in"}
        </p>
      </TravelPass>
    );
  }

  if (block.travel_event === "departure") {
    const leg = transit.filter((t) => t.direction === "return" && inWindow(t.depart_at))[0];
    return (
      <TravelPass label={label} block={block} timezone={trip.timezone}>
        <PassLine leg={leg} verb="Depart" time={leg?.depart_at} timezone={trip.timezone} />
        <p className="text-sm">
          {leg ? `${leg.mode === "car" ? "Set off" : `Be at the ${MODE[leg.mode].terminal}`} by ${formatTime(new Date(new Date(leg.depart_at).getTime() - leg.buffer_before_minutes * 60000).toISOString(), trip.timezone)}` : "Heading home"}
        </p>
      </TravelPass>
    );
  }

  if (block.travel_event === "in_transit") {
    const leg = transit.find((t) => t.depart_at < block.ends_at && t.arrive_at > block.starts_at);
    return (
      <TravelPass label={label} block={block} timezone={trip.timezone}>
        <PassLine leg={leg} verb={leg ? ON_BOARD[leg.mode] : "In transit"} time={undefined} timezone={trip.timezone} />
        {block.available_minutes >= 45 && (
          <p className="text-sm">{formatDuration(block.available_minutes)} free</p>
        )}
      </TravelPass>
    );
  }

  if (block.status === "unavailable") {
    return (
      <div className="hatched flex min-h-24 flex-col justify-center rounded-lg border px-3 py-2">
        {label}
        <p className="text-sm text-muted-foreground">{beforeArrival ? "Before you land" : "After you head home"}</p>
      </div>
    );
  }

  return (
    <div className={`flex min-h-24 flex-col gap-2 rounded-lg border bg-card p-3 ${block.items.length ? "" : "border-dashed"}`}>
      {label}
      {block.status === "limited" && (
        <p className="text-xs text-muted-foreground">
          Free {formatTime(block.available_from, trip.timezone)} – {formatTime(block.available_until, trip.timezone)}
        </p>
      )}
      {block.items.length > 0 && (
        <ul className="grid gap-2">
          {block.items.map((item) => (
            <ItemRow key={item.id} votes={votes?.get(item.id)} item={item} tripId={trip.id} partySize={trip.party_size} tripCurrency={trip.currency} canEdit={canEdit} />
          ))}
        </ul>
      )}
      {canEdit && <AddActivityForm tripId={trip.id} timeBlockId={block.id} near={near} />}
    </div>
  );
}

const ON_BOARD = { flight: "In the air", train: "On the train", bus: "On the bus", ferry: "On the ferry", car: "On the road" } as const;

function TravelPass({
  label,
  block,
  children,
}: {
  label: React.ReactNode;
  block: TimeBlock;
  timezone: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`perforated flex min-h-24 flex-col justify-center gap-1 rounded-lg px-4 py-3 ${
        block.travel_event === "arrival" || block.travel_event === "departure" ? "bg-travel text-travel-foreground" : "border border-travel bg-travel-soft"
      }`}
    >
      {label}
      {children}
    </div>
  );
}

function PassLine({
  leg,
  verb,
  time,
  timezone,
}: {
  leg: TransitSegment | undefined;
  verb: string;
  time: string | undefined;
  timezone: string;
}) {
  const Icon = leg ? MODE[leg.mode].icon : Plane;
  // Flight numbers already include the airline code ("TP 212"), so prefer them.
  const name = leg?.service_number ?? leg?.carrier ?? "";
  const fromPlace = leg ? placeLabel(leg.origin_code, leg.origin_name) : null;
  const toPlace = leg ? placeLabel(leg.destination_code, leg.destination_name) : null;
  const route = fromPlace && toPlace ? `${fromPlace} to ${toPlace}` : null;
  return (
    <p className="flex items-center gap-2 font-display text-lg leading-tight font-semibold">
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span>
        {verb}
        {time ? ` ${formatTime(time, timezone)}` : ""}
        {(name || route) && <span className="block text-sm font-normal">{[name, route].filter(Boolean).join(", ")}</span>}
      </span>
    </p>
  );
}
