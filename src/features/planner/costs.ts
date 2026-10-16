/**
 * What a day on the ground costs, by destination airport, in USD (2026).
 *
 * WRLD estimates for a mid-range trip:
 *   hotel: one standard double room in a 3-star hotel in a central area, per night
 *   day:   per person per day: three meals at casual restaurants, local transit,
 *          and one paid sight or activity
 * These are WRLD's own rough estimates, written by hand (October 2026). They
 * are NOT pulled from a dataset or checked city by city. Replace them with a
 * sourced table (e.g. the State Department per diem Excel at
 * allowances.state.gov/ExcelVersion.asp, scaled to leisure travel) before
 * calling them accurate. Season moves hotels a lot (summer Europe, winter
 * Caribbean): treat these as a starting point, not a quote.
 */
export const DEST_COSTS: Record<string, { hotel: number; day: number }> = {
  // Europe
  LHR: { hotel: 230, day: 110 }, CDG: { hotel: 210, day: 100 }, AMS: { hotel: 210, day: 95 }, FRA: { hotel: 150, day: 80 },
  MUC: { hotel: 170, day: 85 }, MAD: { hotel: 150, day: 75 }, BCN: { hotel: 170, day: 80 }, LIS: { hotel: 140, day: 70 },
  FCO: { hotel: 170, day: 85 }, ATH: { hotel: 130, day: 65 }, DUB: { hotel: 210, day: 95 }, ZRH: { hotel: 260, day: 140 },
  VIE: { hotel: 150, day: 80 }, CPH: { hotel: 210, day: 110 }, IST: { hotel: 110, day: 55 }, EDI: { hotel: 190, day: 90 },
  MXP: { hotel: 170, day: 85 }, PRG: { hotel: 110, day: 60 },
  // Asia
  HND: { hotel: 150, day: 75 }, NRT: { hotel: 150, day: 75 }, KIX: { hotel: 120, day: 65 }, ICN: { hotel: 120, day: 65 },
  TPE: { hotel: 110, day: 55 }, HKG: { hotel: 170, day: 85 }, SIN: { hotel: 200, day: 85 }, BKK: { hotel: 80, day: 45 },
  MNL: { hotel: 80, day: 45 }, DEL: { hotel: 80, day: 40 },
  // Mexico, Caribbean & Latin America
  CUN: { hotel: 180, day: 80 }, MEX: { hotel: 110, day: 55 }, SJD: { hotel: 250, day: 100 }, SJU: { hotel: 200, day: 90 },
  PUJ: { hotel: 200, day: 80 }, LIR: { hotel: 150, day: 75 }, BOG: { hotel: 80, day: 40 }, LIM: { hotel: 100, day: 50 },
  GRU: { hotel: 100, day: 55 }, EZE: { hotel: 90, day: 50 }, SCL: { hotel: 100, day: 55 },
  // Middle East & Africa
  DXB: { hotel: 170, day: 85 }, DOH: { hotel: 160, day: 80 }, AUH: { hotel: 150, day: 80 }, TLV: { hotel: 230, day: 100 },
  CAI: { hotel: 80, day: 40 }, CPT: { hotel: 120, day: 55 }, JNB: { hotel: 100, day: 50 }, NBO: { hotel: 120, day: 55 },
  RAK: { hotel: 100, day: 50 },
  // Australia & Pacific
  SYD: { hotel: 200, day: 95 }, MEL: { hotel: 170, day: 90 }, BNE: { hotel: 160, day: 85 }, AKL: { hotel: 160, day: 85 },
  HNL: { hotel: 280, day: 110 }, NAN: { hotel: 200, day: 80 }, PPT: { hotel: 300, day: 120 },
  // U.S. & Canada
  JFK: { hotel: 300, day: 120 }, LAX: { hotel: 220, day: 100 }, SFO: { hotel: 250, day: 110 }, ORD: { hotel: 200, day: 95 },
  MIA: { hotel: 230, day: 100 }, BOS: { hotel: 260, day: 105 }, SEA: { hotel: 220, day: 100 }, DEN: { hotel: 180, day: 90 },
  LAS: { hotel: 150, day: 90 }, MCO: { hotel: 160, day: 90 }, YYZ: { hotel: 180, day: 85 }, YVR: { hotel: 200, day: 90 },
  ATL: { hotel: 170, day: 85 }, DFW: { hotel: 160, day: 85 }, IAD: { hotel: 230, day: 100 }, DTW: { hotel: 150, day: 80 },
};

/** How the traveler likes to travel: scales hotel and daily costs. */
export const STYLES = {
  budget: { label: "Budget", hint: "hostels, guesthouses, street food", factor: 0.6 },
  mid: { label: "Mid-range", hint: "3-star hotels, casual restaurants", factor: 1 },
  comfort: { label: "Comfort", hint: "4–5 star hotels, nicer dinners", factor: 1.7 },
} as const;
export type Style = keyof typeof STYLES;

/** Hotel and daily spending for the stay, in USD. Rooms hold two travelers. */
export function groundCost(code: string, nights: number, travelers: number, style: Style) {
  const c = DEST_COSTS[code];
  if (!c) return null;
  const f = STYLES[style].factor;
  const rooms = Math.ceil(travelers / 2);
  const hotel = Math.round(c.hotel * f * rooms * nights);
  // Days on the ground: one more than the nights (arrival and departure days).
  const days = Math.round(c.day * f * travelers * (nights + 1));
  return { hotel, days, total: hotel + days };
}
