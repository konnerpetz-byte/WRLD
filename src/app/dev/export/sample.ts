import type { ExportData } from "@/features/export/data";

/** Development-only sample trip for checking the export formats without signing in. */
export const SAMPLE = {
  raw: {
    transit: [
      { id: "t1", depart_at: "2026-11-10T22:05:00Z", arrive_at: "2026-11-11T10:20:00Z" },
      { id: "t2", depart_at: "2026-11-15T11:30:00Z", arrive_at: "2026-11-15T15:40:00Z" },
    ],
    lodging: [{ id: "l1", check_in_at: "2026-11-11T15:00:00Z", check_out_at: "2026-11-15T11:00:00Z" }],
    items: [{ id: "i1", startUtc: "2026-11-12T10:00:00Z", endUtc: "2026-11-12T12:00:00Z" }],
  },
  trip: { id: "x", title: "Lisbon, finally", start_date: "2026-11-10", end_date: "2026-11-15", party_size: 2, budget: 3000, currency: "USD", destination: "Lisbon", notes: "Anniversary trip.", timezone: "Europe/Lisbon" },
  stops: [{ city: "Lisbon", country_code: "PT", arrive_date: "2026-11-11", leave_date: "2026-11-15" }],
  budget: { projected_total: 2480 },
  days: ["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"].map((date) => ({ date, title: null, notes: null, city: "Lisbon" })),
  transit: [
    { key: "t-t1", type: "transit", bookingType: "transit", bookingId: "t1", date: "2026-11-10", time: "5:05 PM", sortAt: "2026-11-10T22:05:00Z", title: "Flight DTW → LIS · Delta 128", lines: ["Departs Tue, Nov 10 5:05 PM from Detroit", "Arrives Wed, Nov 11 10:20 AM at Lisbon", "Economy, seat 23A"], confirmation: "H7KQ2P", status: "booked", cost: "$0 + 60,000 points", url: null },
    { key: "t-t2", type: "transit", bookingType: "transit", bookingId: "t2", date: "2026-11-15", time: "11:30 AM", sortAt: "2026-11-15T11:30:00Z", title: "Flight LIS → DTW · Delta 129", lines: ["Departs Sun, Nov 15 11:30 AM from Lisbon", "Arrives Sun, Nov 15 3:40 PM at Detroit"], confirmation: "H7KQ2P", status: "booked", cost: "$612", url: null },
  ],
  stays: [
    { key: "in-l1", type: "stay_in", bookingType: "lodging", bookingId: "l1", date: "2026-11-11", time: "3:00 PM", sortAt: "2026-11-11T15:00:00Z", title: "Check in: Memmo Alfama", lines: ["Travessa das Merceeiras 27, Lisbon", "Check out Sun, Nov 15 11:00 AM"], confirmation: "88412093", status: "booked", cost: "$980", url: "https://www.memmohotels.com" },
    { key: "out-l1", type: "stay_out", bookingType: "lodging", bookingId: "l1", date: "2026-11-15", time: "11:00 AM", sortAt: "2026-11-15T11:00:00Z", title: "Check out: Memmo Alfama", lines: [], confirmation: "88412093", status: "booked", cost: null, url: null },
  ],
  items: [
    { key: "i-i1", type: "item", bookingType: "item", bookingId: "i1", date: "2026-11-12", time: "10:00 AM", sortAt: "2026-11-12T10:00", title: "Tile museum + Alfama walk", lines: ["Morning · Museu Nacional do Azulejo"], confirmation: "GYG-55120", status: "booked", cost: "$48", url: "https://www.getyourguide.com" },
  ],
  checklist: [
    { list: "documents", title: "Passport valid 3+ months past return", done: true, due_on: null },
    { list: "packing", title: "Walking shoes", done: false, due_on: null },
  ],
  members: [{ name: "Konner", role: "owner" }, { name: "Shane", role: "editor" }],
  files: [
    { id: "f1", name: "Boarding pass DL128.pdf", path: "x/f1", mime: "application/pdf", size: 182000, bookingType: "transit", bookingId: "t1", url: null },
    { id: "f2", name: "Memmo confirmation.pdf", path: "x/f2", mime: "application/pdf", size: 96000, bookingType: "lodging", bookingId: "l1", url: null },
  ],
} as unknown as ExportData;
