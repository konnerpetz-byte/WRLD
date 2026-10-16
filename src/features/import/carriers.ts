/**
 * Airline and ground-transport names as confirmations write them, so a leg can
 * read "Delta DL 1180" from "DELTA 1180" or "Delta Air Lines Flight 1180".
 * Codes are IATA two-character designators.
 */
export const AIRLINES: Record<string, string> = {
  // North America
  AA: "American", AS: "Alaska", B6: "JetBlue", DL: "Delta", F9: "Frontier", G4: "Allegiant", HA: "Hawaiian", MX: "Breeze",
  NK: "Spirit", SY: "Sun Country", UA: "United", WN: "Southwest", AC: "Air Canada", WS: "WestJet", PD: "Porter", TS: "Air Transat",
  AM: "Aeroméxico", Y4: "Volaris", VB: "Viva Aerobus", CM: "Copa", AV: "Avianca", LA: "LATAM", AR: "Aerolíneas Argentinas",
  // Europe
  AF: "Air France", KL: "KLM", BA: "British Airways", VS: "Virgin Atlantic", LH: "Lufthansa", LX: "SWISS", OS: "Austrian",
  SN: "Brussels Airlines", EI: "Aer Lingus", IB: "Iberia", VY: "Vueling", UX: "Air Europa", TP: "TAP Air Portugal", AZ: "ITA Airways",
  SK: "SAS", AY: "Finnair", DY: "Norwegian", FI: "Icelandair", LO: "LOT", A3: "Aegean", TK: "Turkish Airlines", PC: "Pegasus",
  FR: "Ryanair", U2: "easyJet", W6: "Wizz Air", EW: "Eurowings", DE: "Condor", "4Y": "Discover", LS: "Jet2",
  // Middle East, Africa
  EK: "Emirates", QR: "Qatar Airways", EY: "Etihad", SV: "Saudia", RJ: "Royal Jordanian", MS: "EgyptAir", ET: "Ethiopian",
  KQ: "Kenya Airways", SA: "South African", AT: "Royal Air Maroc", LY: "El Al", WY: "Oman Air", GF: "Gulf Air", FZ: "flydubai",
  // Asia-Pacific
  SQ: "Singapore Airlines", CX: "Cathay Pacific", JL: "Japan Airlines", NH: "ANA", KE: "Korean Air", OZ: "Asiana", BR: "EVA Air",
  CI: "China Airlines", CA: "Air China", MU: "China Eastern", CZ: "China Southern", TG: "Thai Airways", MH: "Malaysia Airlines",
  GA: "Garuda Indonesia", PR: "Philippine Airlines", VN: "Vietnam Airlines", AI: "Air India", "6E": "IndiGo", QF: "Qantas",
  VA: "Virgin Australia", NZ: "Air New Zealand", FJ: "Fiji Airways", JQ: "Jetstar", TR: "Scoot", AK: "AirAsia", "5J": "Cebu Pacific",
};

/** Ways names are written in emails ("DELTA", "Delta Air Lines", "British Airways") → code. Longest names first. */
const NAME_TO_CODE: [RegExp, string][] = Object.entries({
  ...Object.fromEntries(Object.entries(AIRLINES).map(([code, name]) => [name, code])),
  "Delta Air Lines": "DL", "United Airlines": "UA", "American Airlines": "AA", "Alaska Airlines": "AS", "Southwest Airlines": "WN",
  "Spirit Airlines": "NK", "Frontier Airlines": "F9", "Hawaiian Airlines": "HA", "Allegiant Air": "G4", "Sun Country Airlines": "SY",
  "Breeze Airways": "MX", "Swiss International Air Lines": "LX", "Austrian Airlines": "OS", "Turkish": "TK", "Qatar": "QR",
  "Etihad Airways": "EY", "Singapore": "SQ", "Japan Airlines": "JL", "All Nippon Airways": "NH", "Korean": "KE", "Air Canada Rouge": "AC",
  "Qantas Airways": "QF", "Aeromexico": "AM", "LATAM Airlines": "LA", "Avianca": "AV", "Copa Airlines": "CM", "Lufthansa": "LH",
  "Air India": "AI", "Thai": "TG", "EVA Airways": "BR", "Cathay": "CX", "Emirates Airline": "EK", "Icelandair": "FI",
})
  .sort((a, b) => b[0].length - a[0].length)
  .map(([name, code]) => [new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/é/g, "[eé]").replace(/í/g, "[ií]")}\\b`, "i"), code]);

/** "DELTA 1180", "Delta Air Lines Flight 1180", "United flight 958" → "DL 1180". */
export function namedFlightIn(text: string): string | null {
  for (const [re, code] of NAME_TO_CODE) {
    const m = new RegExp(`${re.source}\\s*(?:flight|flt\\.?|#|no\\.?)?\\s*:?\\s*(\\d{1,4})\\b`, "i").exec(text);
    if (m) return `${code} ${Number(m[1])}`;
  }
  return null;
}

export const airlineName = (flight: string | null) => (flight ? (AIRLINES[flight.split(" ")[0]] ?? null) : null);

/** Trains, buses and ferries: how to recognize the operator, and its usual mode. */
export const GROUND: { re: RegExp; name: string; mode: "train" | "bus" | "ferry" }[] = [
  { re: /\bamtrak\b/i, name: "Amtrak", mode: "train" },
  { re: /\bvia rail\b/i, name: "VIA Rail", mode: "train" },
  { re: /\bbrightline\b/i, name: "Brightline", mode: "train" },
  { re: /\beurostar\b/i, name: "Eurostar", mode: "train" },
  { re: /\bdeutsche bahn\b|\bbahn\.de\b|\bDB (?:fernverkehr|ticket|navigator)\b|\bICE\s?\d/i, name: "Deutsche Bahn", mode: "train" },
  { re: /\bsncf\b|\bTGV\b|\binoui\b|\bouigo\b/i, name: "SNCF", mode: "train" },
  { re: /\btrenitalia\b|\bfrecciarossa\b|\bitalo\b/i, name: "Trenitalia", mode: "train" },
  { re: /\brenfe\b|\bAVE\b|\biryo\b/i, name: "Renfe", mode: "train" },
  { re: /\bsbb\b|\bswiss federal railways\b/i, name: "SBB", mode: "train" },
  { re: /\b(?:ns international|nederlandse spoorwegen)\b/i, name: "NS", mode: "train" },
  { re: /\bobb\b|\bnightjet\b|\bÖBB\b/i, name: "ÖBB", mode: "train" },
  { re: /\btrainline\b/i, name: "Trainline", mode: "train" },
  { re: /\blner\b|\bavanti\b|\bgwr\b|\bgreat western railway\b|\bnational rail\b|\bscotrail\b|\bcrosscountry\b/i, name: "National Rail", mode: "train" },
  { re: /\bjr (?:east|central|west|pass)\b|\bshinkansen\b/i, name: "JR", mode: "train" },
  { re: /\bkorail\b|\bKTX\b/i, name: "Korail", mode: "train" },
  { re: /\bflixbus\b|\bflixtrain\b/i, name: "FlixBus", mode: "bus" },
  { re: /\bgreyhound\b/i, name: "Greyhound", mode: "bus" },
  { re: /\bmegabus\b/i, name: "Megabus", mode: "bus" },
  { re: /\bnational express\b/i, name: "National Express", mode: "bus" },
  { re: /\balsa\b/i, name: "ALSA", mode: "bus" },
  { re: /\bourbus\b|\bpeter pan\b|\bwanderu\b|\bbusbud\b/i, name: "Bus", mode: "bus" },
  { re: /\bferry\b|\bferries\b|\bdirect ferries\b|\bstena\b|\bp&o\b|\bbaleària\b/i, name: "Ferry", mode: "ferry" },
];
