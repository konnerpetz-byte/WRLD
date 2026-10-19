import { AIRPORT_CITY } from "@/features/awards/regions";
import { airportByCode } from "@/features/places/airports";

import type { Getaway } from "./drive";

/** Which Wikipedia article's lead photo shows each place. Most U.S. towns follow "Town, State". */
const STATE: Record<string, string> = {
  AL: "Alabama", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DC: "D.C.", DE: "Delaware",
  FL: "Florida", GA: "Georgia", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
  ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia",
  WI: "Wisconsin", WY: "Wyoming",
};

const DRIVE_TITLE: Record<string, string> = {
  "torch-lake": "Torch Lake (Antrim County, Michigan)",
  "sleeping-bear": "Sleeping Bear Dunes National Lakeshore",
  "mackinac-island": "Mackinac Island",
  "door-county": "Door County, Wisconsin",
  "apostle-islands": "Apostle Islands National Lakeshore",
  "hocking-hills": "Hocking Hills State Park",
  "indiana-dunes": "Indiana Dunes National Park",
  "cuyahoga-valley": "Cuyahoga Valley National Park",
  "starved-rock": "Starved Rock State Park",
  "cherry-springs": "Cherry Springs State Park",
  "new-river-gorge": "New River Gorge National Park and Preserve",
  "mammoth-cave": "Mammoth Cave National Park",
  congaree: "Congaree National Park",
  "buffalo-river": "Buffalo National River",
  "finger-lakes": "Finger Lakes",
  "cape-cod": "Cape Cod",
  "outer-banks": "Outer Banks",
  poconos: "Pocono Mountains",
  shenandoah: "Shenandoah National Park",
  "new-york": "New York City",
  "washington-dc": "Washington, D.C.",
  "nashville-in": "Nashville, Indiana",
  "madison-in": "Madison, Indiana",
  "niagara-falls": "Niagara Falls",
  "lake-tahoe": "Lake Tahoe",
  "grand-canyon": "Grand Canyon",
  yosemite: "Yosemite National Park",
  zion: "Zion National Park",
  napa: "Napa Valley AVA",
  monterey: "Monterey, California",
  "key-west": "Key West",
  "las-vegas": "Las Vegas",
  "los-angeles": "Los Angeles",
  "san-francisco": "San Francisco",
  chicago: "Chicago",
  "new-orleans": "New Orleans",
  philadelphia: "Philadelphia",
  "kansas-city": "Kansas City, Missouri",
  "st-louis": "St. Louis",
  "portland-me": "Portland, Maine",
  "portland-or": "Portland, Oregon",
  "lake-geneva": "Lake Geneva, Wisconsin",
  "put-in-bay": "Put-in-Bay, Ohio",
};

/** Article title and a fallback search for a road-trip place. */
export function driveTitle(g: Pick<Getaway, "key" | "name" | "state" | "photo">) {
  const name = g.name.replace(/\s*\(.*?\)/g, "");
  const state = STATE[g.state] ?? g.state;
  return { title: DRIVE_TITLE[g.key] ?? g.photo ?? `${name}, ${state}`, search: `${name} ${state}` };
}

const FLY_TITLE: Record<string, string> = {
  HND: "Tokyo", NRT: "Tokyo", KIX: "Osaka", ICN: "Seoul", MXP: "Milan", FRA: "Frankfurt", FCO: "Rome", CDG: "Paris", LHR: "London",
  IAD: "Washington, D.C.", JFK: "New York City", ORD: "Chicago", DFW: "Dallas", DTW: "Detroit", YYZ: "Toronto", YVR: "Vancouver",
  SJD: "Cabo San Lucas", PUJ: "Punta Cana", LIR: "Guanacaste Province", CUN: "Cancún", NAN: "Nadi", PPT: "Papeete",
  SJU: "San Juan, Puerto Rico", MCO: "Orlando, Florida", LAS: "Las Vegas", SFO: "San Francisco", LAX: "Los Angeles", MIA: "Miami",
  BOS: "Boston", SEA: "Seattle", DEN: "Denver", ATL: "Atlanta", HNL: "Honolulu", MEX: "Mexico City", GRU: "São Paulo", EZE: "Buenos Aires",
  SCL: "Santiago", BOG: "Bogotá", LIM: "Lima", DEL: "New Delhi", BKK: "Bangkok", MNL: "Manila", SIN: "Singapore", HKG: "Hong Kong",
  TPE: "Taipei", DXB: "Dubai", DOH: "Doha", AUH: "Abu Dhabi", TLV: "Tel Aviv", CAI: "Cairo", CPT: "Cape Town", JNB: "Johannesburg",
  NBO: "Nairobi", RAK: "Marrakesh", SYD: "Sydney", MEL: "Melbourne", BNE: "Brisbane", AKL: "Auckland", IST: "Istanbul",
  SAV: "Savannah, Georgia", CHS: "Charleston, South Carolina", SAT: "San Antonio", ABQ: "Albuquerque, New Mexico",
  SLC: "Salt Lake City", BOI: "Boise, Idaho", TUS: "Tucson, Arizona", CHA: "Chattanooga, Tennessee", AVL: "Asheville, North Carolina",
  BTV: "Burlington, Vermont", PWM: "Portland, Maine", YQB: "Quebec City", YUL: "Montreal", OPO: "Porto", SVQ: "Seville",
  VLC: "Valencia", NAP: "Naples", KRK: "Kraków", BUD: "Budapest", LJU: "Ljubljana", TBS: "Tbilisi", OAX: "Oaxaca City",
  GDL: "Guadalajara", MDE: "Medellín", PTY: "Panama City", HAN: "Hanoi", CNX: "Chiang Mai",
};

/** Article title and a fallback search for a flight destination. */
export function flyTitle(code: string) {
  const a = airportByCode(code);
  const city = AIRPORT_CITY[code] ?? a?.city ?? code;
  return { title: FLY_TITLE[code] ?? city, search: `${city} ${a?.country ?? ""} city` };
}
