/**
 * "Medellín, Colombia", "Savannah, GA": the city with its country, or its state at home, so a
 * card is never just a city name nobody can place. Country names come from the browser's own
 * list (Intl.DisplayNames), states from the airports WRLD prices.
 */
const US_STATE: Record<string, string> = {
  HNL: "HI", JFK: "NY", LGA: "NY", EWR: "NJ", LAX: "CA", SFO: "CA", ORD: "IL", MIA: "FL", BOS: "MA", SEA: "WA", DEN: "CO",
  LAS: "NV", MCO: "FL", ATL: "GA", DFW: "TX", IAD: "DC", DCA: "DC", DTW: "MI", SAV: "GA", CHS: "SC", SAT: "TX", ABQ: "NM",
  SLC: "UT", BOI: "ID", TUS: "AZ", CHA: "TN", AVL: "NC", BTV: "VT", PWM: "ME", TVC: "MI", MSP: "MN", PHX: "AZ", SAN: "CA",
  AUS: "TX", BNA: "TN", MSY: "LA", PDX: "OR", CLT: "NC", PHL: "PA", IAH: "TX", FLL: "FL", TPA: "FL", RDU: "NC", STL: "MO",
};

const countries = new Intl.DisplayNames(["en"], { type: "region" });

export function placeLabel(code: string, city: string, country: string | undefined) {
  const name = city.replace(/,\s*[^,]+$/, ""); // "Portland, Maine" → "Portland"
  if (country === "US") {
    const st = US_STATE[code];
    return st ? `${name}, ${st}` : city;
  }
  if (!country) return city;
  const nation = country === "PR" ? "Puerto Rico" : (countries.of(country) ?? country);
  // City-states and island names that already say it all: "Singapore", "Hong Kong", "Fiji"
  if (nation === name || name.includes(nation) || nation.startsWith(`${name} `)) return name;
  return `${name}, ${nation}`;
}
