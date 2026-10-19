import type { RegionKey } from "@/features/awards/regions";

/**
 * Hidden gems you can fly to: smaller or cheaper places than the big-city list, each with free
 * things to do. Only things we're sure are free are listed; a place with a fee is left off or
 * says so. Priced like every other destination (fares, per diem or WRLD's estimate).
 */
export type FlyGem = { code: string; city: string; region: RegionKey; why: string; free: string[] };

export const FLY_GEMS: FlyGem[] = [
  // U.S. & Canada
  { code: "SAV", city: "Savannah", region: "north_america", why: "Walkable historic squares under live oaks", free: ["Forsyth Park and the 22 historic squares", "River Street waterfront"] },
  { code: "CHS", city: "Charleston", region: "north_america", why: "Pastel row houses, Lowcountry food", free: ["The Battery and White Point Garden", "Waterfront Park and Rainbow Row"] },
  { code: "SAT", city: "San Antonio", region: "north_america", why: "River Walk and Spanish missions", free: ["San Antonio Missions National Historical Park (free entry)", "The River Walk"] },
  { code: "ABQ", city: "Albuquerque", region: "north_america", why: "High-desert city, New Mexican food", free: ["Old Town Plaza", "Rinconada and Piedras Marcadas canyon trails at Petroglyph National Monument"] },
  { code: "SLC", city: "Salt Lake City", region: "north_america", why: "Mountains 30 minutes from downtown", free: ["Temple Square and its gardens", "Ensign Peak trail for a city view"] },
  { code: "BOI", city: "Boise", region: "north_america", why: "Easygoing river city with foothill trails", free: ["The Boise River Greenbelt", "Table Rock trail at sunset"] },
  { code: "TUS", city: "Tucson", region: "north_america", why: "Sonoran Desert and some of the best Mexican food in the U.S.", free: ["Mission San Xavier del Bac (free, donations welcome)", "Walking Barrio Viejo"] },
  { code: "CHA", city: "Chattanooga", region: "north_america", why: "Outdoor town on the Tennessee River", free: ["Walnut Street Bridge and Coolidge Park"] },
  { code: "AVL", city: "Asheville", region: "north_america", why: "Blue Ridge mountain town, breweries", free: ["Blue Ridge Parkway overlooks (no entrance fee)"] },
  { code: "BTV", city: "Burlington", region: "north_america", why: "Lake Champlain college town", free: ["Church Street Marketplace", "The waterfront bike path at sunset"] },
  { code: "PWM", city: "Portland, Maine", region: "north_america", why: "Lobster rolls and a working harbor", free: ["Eastern Promenade", "Walking the Old Port"] },
  { code: "YQB", city: "Quebec City", region: "north_america", why: "A walled old town without flying to Europe", free: ["Dufferin Terrace and the city walls", "Plains of Abraham"] },
  { code: "YUL", city: "Montreal", region: "north_america", why: "European feel, a short flight away", free: ["Mount Royal Park lookout", "Walking Old Montreal"] },
  // Europe
  { code: "OPO", city: "Porto", region: "europe", why: "Cheaper, hillier cousin of Lisbon", free: ["Ribeira riverfront and the Dom Luís I bridge", "Crystal Palace Gardens"] },
  { code: "SVQ", city: "Seville", region: "europe", why: "Orange trees, flamenco and tapas", free: ["Plaza de España and María Luisa Park", "Walking Triana"] },
  { code: "VLC", city: "Valencia", region: "europe", why: "Beach city and the home of paella", free: ["Turia Gardens, a 9 km park in the old riverbed", "Malvarrosa beach"] },
  { code: "NAP", city: "Naples", region: "europe", why: "Pizza capital and the door to Pompeii and the Amalfi Coast", free: ["Walking Spaccanapoli", "The Lungomare seafront"] },
  { code: "KRK", city: "Kraków", region: "europe", why: "Medieval old town at Central European prices", free: ["Main Market Square", "Wawel Hill grounds", "Walking Kazimierz"] },
  { code: "BUD", city: "Budapest", region: "europe", why: "Grand city at about half of Vienna's prices", free: ["Margaret Island", "Danube promenade and Castle Hill streets"] },
  { code: "LJU", city: "Ljubljana", region: "europe", why: "Small, green capital near lakes and the Alps", free: ["Tivoli Park", "Triple Bridge and the old town riverfront"] },
  { code: "TBS", city: "Tbilisi", region: "europe", why: "Wine country and sulfur baths, very low prices", free: ["Old Town and the walk up to Narikala Fortress", "Rike Park and the Bridge of Peace"] },
  // Mexico & Latin America
  { code: "OAX", city: "Oaxaca", region: "latin_america", why: "Mexico's food capital", free: ["The Zócalo and Templo de Santo Domingo", "Walking the Jalatlaco neighborhood"] },
  { code: "GDL", city: "Guadalajara", region: "latin_america", why: "Birthplace of mariachi and tequila", free: ["Walking Tlaquepaque", "The historic center and cathedral"] },
  { code: "MDE", city: "Medellín", region: "latin_america", why: "Spring weather all year", free: ["Comuna 13's murals and outdoor escalators", "Plaza Botero"] },
  { code: "PTY", city: "Panama City", region: "latin_america", why: "Skyline, old town and the canal", free: ["Walking Casco Viejo", "Cinta Costera and the Amador Causeway"] },
  // Asia
  { code: "HAN", city: "Hanoi", region: "asia", why: "Street food and the Old Quarter", free: ["Hoan Kiem Lake", "Walking the Old Quarter"] },
  { code: "CNX", city: "Chiang Mai", region: "asia", why: "Temples and mountains at backpacker prices", free: ["Old City temples like Wat Phan Tao", "Sunday Walking Street market"] },
];

const BY_CODE = new Map(FLY_GEMS.map((g) => [g.code, g]));
export const flyGem = (code: string) => BY_CODE.get(code) ?? null;
