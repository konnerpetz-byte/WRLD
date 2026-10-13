/** Where the explorer searches when you pick a region instead of airports. */
export const REGIONS = {
  europe: {
    label: "Europe",
    airports: ["LHR", "CDG", "AMS", "FRA", "MUC", "MAD", "BCN", "LIS", "FCO", "ATH", "DUB", "ZRH", "VIE", "CPH", "IST", "EDI", "MXP", "PRG"],
  },
  asia: { label: "Asia", airports: ["HND", "NRT", "KIX", "ICN", "TPE", "HKG", "SIN", "BKK", "MNL", "DEL"] },
  latin_america: { label: "Mexico, Caribbean & Latin America", airports: ["CUN", "MEX", "SJD", "SJU", "PUJ", "LIR", "BOG", "LIM", "GRU", "EZE", "SCL"] },
  middle_east_africa: { label: "Middle East & Africa", airports: ["DXB", "DOH", "AUH", "TLV", "CAI", "CPT", "JNB", "NBO", "RAK"] },
  oceania: { label: "Australia & Pacific", airports: ["SYD", "MEL", "BNE", "AKL", "HNL", "NAN", "PPT"] },
  north_america: {
    label: "U.S. & Canada",
    airports: ["JFK", "LAX", "SFO", "ORD", "MIA", "BOS", "SEA", "DEN", "LAS", "MCO", "YYZ", "YVR", "ATL", "DFW", "IAD", "DTW"],
  },
} as const;

export type RegionKey = keyof typeof REGIONS;

/** City names for airport codes the explorer shows most often. */
export const AIRPORT_CITY: Record<string, string> = {
  LHR: "London", CDG: "Paris", AMS: "Amsterdam", FRA: "Frankfurt", MUC: "Munich", MAD: "Madrid", BCN: "Barcelona",
  LIS: "Lisbon", FCO: "Rome", ATH: "Athens", DUB: "Dublin", ZRH: "Zurich", VIE: "Vienna", CPH: "Copenhagen",
  IST: "Istanbul", EDI: "Edinburgh", MXP: "Milan", PRG: "Prague", HND: "Tokyo Haneda", NRT: "Tokyo Narita",
  KIX: "Osaka", ICN: "Seoul", TPE: "Taipei", HKG: "Hong Kong", SIN: "Singapore", BKK: "Bangkok", MNL: "Manila",
  DEL: "Delhi", CUN: "Cancún", MEX: "Mexico City", SJD: "Los Cabos", SJU: "San Juan", PUJ: "Punta Cana",
  LIR: "Liberia, Costa Rica", BOG: "Bogotá", LIM: "Lima", GRU: "São Paulo", EZE: "Buenos Aires", SCL: "Santiago",
  DXB: "Dubai", DOH: "Doha", AUH: "Abu Dhabi", TLV: "Tel Aviv", CAI: "Cairo", CPT: "Cape Town", JNB: "Johannesburg",
  NBO: "Nairobi", RAK: "Marrakech", SYD: "Sydney", MEL: "Melbourne", BNE: "Brisbane", AKL: "Auckland",
  HNL: "Honolulu", NAN: "Fiji", PPT: "Tahiti", JFK: "New York", LAX: "Los Angeles", SFO: "San Francisco",
  ORD: "Chicago", MIA: "Miami", BOS: "Boston", SEA: "Seattle", DEN: "Denver", LAS: "Las Vegas", MCO: "Orlando",
  YYZ: "Toronto", YVR: "Vancouver", ATL: "Atlanta", DFW: "Dallas", IAD: "Washington", DTW: "Detroit",
};

export const CABINS = {
  economy: { label: "Economy", key: "Y" },
  premium: { label: "Premium economy", key: "W" },
  business: { label: "Business", key: "J" },
  first: { label: "First", key: "F" },
} as const;
export type Cabin = keyof typeof CABINS;

/**
 * Seats.aero mileage programs ("sources") → WRLD loyalty_programs.slug,
 * so results can say "your points can book this".
 */
export const SOURCE_PROGRAM: Record<string, { name: string; slug?: string; url: string }> = {
  aeroplan: { name: "Air Canada Aeroplan", slug: "aircanada_aeroplan", url: "https://www.aircanada.com/aeroplan" },
  american: { name: "American AAdvantage", slug: "american_aadvantage", url: "https://www.aa.com/aadvantage" },
  delta: { name: "Delta SkyMiles", slug: "delta_skymiles", url: "https://www.delta.com/skymiles" },
  united: { name: "United MileagePlus", slug: "united_mileageplus", url: "https://www.united.com/mileageplus" },
  flyingblue: { name: "Air France-KLM Flying Blue", slug: "flying_blue", url: "https://www.flyingblue.com" },
  jetblue: { name: "JetBlue TrueBlue", slug: "jetblue_trueblue", url: "https://www.jetblue.com/trueblue" },
  british: { name: "British Airways Club", slug: "british_airways_club", url: "https://www.britishairways.com" },
  alaska: { name: "Atmos Rewards (Alaska)", url: "https://www.alaskaair.com" },
  virginatlantic: { name: "Virgin Atlantic Flying Club", url: "https://www.virginatlantic.com" },
  emirates: { name: "Emirates Skywards", url: "https://www.emirates.com" },
  etihad: { name: "Etihad Guest", url: "https://www.etihad.com" },
  qatar: { name: "Qatar Privilege Club", url: "https://www.qatarairways.com" },
  qantas: { name: "Qantas Frequent Flyer", url: "https://www.qantas.com" },
  singapore: { name: "Singapore KrisFlyer", url: "https://www.singaporeair.com" },
  turkish: { name: "Turkish Miles&Smiles", url: "https://www.turkishairlines.com" },
  lifemiles: { name: "Avianca LifeMiles", url: "https://www.lifemiles.com" },
  smiles: { name: "GOL Smiles", url: "https://www.smiles.com.br" },
  eurobonus: { name: "SAS EuroBonus", url: "https://www.flysas.com" },
  velocity: { name: "Virgin Australia Velocity", url: "https://www.velocityfrequentflyer.com" },
  aeromexico: { name: "Aeroméxico Rewards", url: "https://www.aeromexico.com" },
  connectmiles: { name: "Copa ConnectMiles", url: "https://www.copaair.com" },
  aerlingus: { name: "Aer Lingus AerClub", url: "https://www.aerlingus.com" },
  iberia: { name: "Iberia Plus", url: "https://www.iberia.com" },
  cathay: { name: "Cathay Asia Miles", url: "https://www.cathaypacific.com" },
  ana: { name: "ANA Mileage Club", url: "https://www.ana.co.jp/en/us/" },
  jal: { name: "JAL Mileage Bank", url: "https://www.jal.co.jp/en/" },
  tap: { name: "TAP Miles&Go", url: "https://www.flytap.com" },
  finnair: { name: "Finnair Plus", url: "https://www.finnair.com" },
  eva: { name: "EVA Infinity MileageLands", url: "https://www.evaair.com" },
  thai: { name: "Thai Royal Orchid Plus", url: "https://www.thaiairways.com" },
  southwest: { name: "Southwest Rapid Rewards", slug: "southwest_rapid_rewards", url: "https://www.southwest.com" },
  lufthansa: { name: "Lufthansa Miles & More", url: "https://www.miles-and-more.com" },
  ethiopian: { name: "Ethiopian ShebaMiles", url: "https://www.ethiopianairlines.com" },
  saudia: { name: "Saudia AlFursan", url: "https://www.saudia.com" },
  azul: { name: "Azul Fidelidade", url: "https://www.voeazul.com.br" },
  frontier: { name: "Frontier Miles", url: "https://www.flyfrontier.com" },
  spirit: { name: "Spirit Free Spirit", url: "https://www.spirit.com" },
};
