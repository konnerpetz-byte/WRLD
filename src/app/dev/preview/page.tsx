import { notFound } from "next/navigation";

import { DayGrid } from "@/features/itinerary/day-grid";
import { TravelCompass } from "@/features/traveler-profile/compass";
import type { DayPlan } from "@/features/trips/queries";
import type { ItineraryItem, Lodging, TimeBlock, TransitSegment } from "@/types/database";

/**
 * Development-only: renders key components with sample data so they can be
 * reviewed without a database. Returns 404 in production.
 */
export default function PreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const tripId = "00000000-0000-0000-0000-000000000001";
  const ts = "2026-10-12T00:00:00Z";
  const block = (id: string, day: string, slot: TimeBlock["slot"], date: string, extra: Partial<TimeBlock> = {}): TimeBlock => {
    const hours = { morning: ["06", "12"], afternoon: ["12", "17"], evening: ["17", "24"] }[slot];
    const end = hours[1] === "24" ? `${nextDay(date)}T00:00:00Z` : `${date}T${hours[1]}:00:00Z`;
    return {
      id, trip_id: tripId, day_id: day, slot, starts_at: `${date}T${hours[0]}:00:00Z`, ends_at: end,
      status: "open", available_minutes: 300, available_from: `${date}T${hours[0]}:00:00Z`, available_until: end,
      travel_event: null, notes: null, created_at: ts, updated_at: ts, ...extra,
    };
  };
  const item = (id: string, blockId: string, title: string, unit: number | null, extra: Partial<ItineraryItem> = {}): ItineraryItem => ({
    id, trip_id: tripId, time_block_id: blockId, kind: "activity", title, description: null, start_time: null, end_time: null,
    location_name: null, address: null, latitude: null, longitude: null, tags: [], booking_status: "idea", booking_url: null,
    provider: null, provider_ref: null, cost: unit === null ? null : unit * 2, currency: "EUR", position: 0, created_by: null,
    unit_price: unit, quantity: null, price_source: unit === null ? null : "estimate", price_checked_at: null,
    created_at: ts, updated_at: ts, ...extra,
  });

  const days: DayPlan[] = [
    {
      id: "d1", trip_id: tripId, date: "2026-11-01", title: null, notes: null, created_at: ts, updated_at: ts,
      blocks: [
        { ...block("b1", "d1", "morning", "2026-11-01", { status: "unavailable", available_minutes: 0, available_from: null, available_until: null }), items: [] },
        { ...block("b2", "d1", "afternoon", "2026-11-01", { status: "unavailable", available_minutes: 0, available_from: null, available_until: null, travel_event: "in_transit" }), items: [] },
        { ...block("b3", "d1", "evening", "2026-11-01", { status: "unavailable", available_minutes: 0, available_from: null, available_until: null, travel_event: "arrival" }), items: [] },
      ],
    },
    {
      id: "d2", trip_id: tripId, date: "2026-11-02", title: null, notes: null, created_at: ts, updated_at: ts,
      blocks: [
        { ...block("b4", "d2", "morning", "2026-11-02"), items: [item("i1", "b4", "Tram 28 and the Alfama", null, { kind: "sightseeing" })] },
        { ...block("b5", "d2", "afternoon", "2026-11-02"), items: [item("i2", "b5", "Pena Palace, Sintra", 20, { booking_status: "booked", price_source: "provider" })] },
        { ...block("b6", "d2", "evening", "2026-11-02"), items: [item("i3", "b6", "Fado show in Mouraria", 45, { quantity: 2 })] },
      ],
    },
    {
      id: "d3", trip_id: tripId, date: "2026-11-03", title: null, notes: null, created_at: ts, updated_at: ts,
      blocks: [
        { ...block("b7", "d3", "morning", "2026-11-03"), items: [item("i4", "b7", "Gulbenkian Museum", 25, { price_source: "manual" })] },
        { ...block("b8", "d3", "afternoon", "2026-11-03", { status: "unavailable", available_minutes: 0, available_from: null, available_until: null, travel_event: "departure" }), items: [] },
        { ...block("b9", "d3", "evening", "2026-11-03", { status: "unavailable", available_minutes: 0, available_from: null, available_until: null, travel_event: "in_transit" }), items: [] },
      ],
    },
  ];

  const leg = (id: string, direction: TransitSegment["direction"], num: string, from: string, to: string, dep: string, arr: string): TransitSegment => ({
    id, trip_id: tripId, mode: "flight", direction, carrier: "TAP", service_number: num, origin_code: from, origin_name: null,
    origin_timezone: null, destination_code: to, destination_name: null, destination_timezone: null, depart_at: dep, arrive_at: arr,
    buffer_before_minutes: 120, buffer_after_minutes: 90, ...COORDS[from], ...TO[to], cabin_class: null, seat: null, confirmation_code: null,
    booking_status: "booked", booking_url: null, provider: null, provider_ref: null, cost: 640, currency: "EUR",
    loyalty_program_id: null, loyalty_account_id: null, points_used: null, notes: null, created_by: null, created_at: ts, updated_at: ts,
  });
  const transit = [
    leg("t1", "outbound", "TP 212", "DTW", "LIS", "2026-11-01T15:30:00Z", "2026-11-01T23:00:00Z"),
    leg("t2", "return", "TP 213", "LIS", "DTW", "2026-11-03T14:00:00Z", "2026-11-03T22:00:00Z"),
  ];
  const lodging: Lodging[] = [
    {
      id: "l1", trip_id: tripId, name: "Memmo Alfama", address: null, latitude: null, longitude: null,
      check_in_at: "2026-11-01T23:30:00Z", check_out_at: "2026-11-03T11:00:00Z", confirmation_code: null,
      booking_status: "booked", booking_url: null, provider: null, provider_ref: null, cost: 410, currency: "EUR",
      loyalty_program_id: null, loyalty_account_id: null, points_used: null, notes: null, created_by: null, created_at: ts, updated_at: ts,
    },
  ];

  return (
    <div className="grid gap-16 p-8">
      <section>
        <h1 className="mb-6 text-4xl font-semibold">Lisbon long weekend</h1>
        <DayGrid trip={{ id: tripId, timezone: "Europe/Lisbon", currency: "EUR", party_size: 2 }} days={days} transit={transit} lodging={lodging} canEdit />
      </section>
      <section className="max-w-xl">
        <TravelCompass x={-6.2} y={4.8} archetype="itinerary_athlete" others={[{ name: "Travel buddy", x: 5.5, y: 6 }]} />
      </section>
    </div>
  );
}

const AIRPORTS: Record<string, [number, number]> = { EWR: [40.6895, -74.1745], LIS: [38.7742, -9.1342] };
const COORDS: Record<string, { origin_latitude: number; origin_longitude: number }> = Object.fromEntries(
  Object.entries(AIRPORTS).map(([k, [la, lo]]) => [k, { origin_latitude: la, origin_longitude: lo }]),
);
const TO: Record<string, { destination_latitude: number; destination_longitude: number }> = Object.fromEntries(
  Object.entries(AIRPORTS).map(([k, [la, lo]]) => [k, { destination_latitude: la, destination_longitude: lo }]),
);

function nextDay(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
