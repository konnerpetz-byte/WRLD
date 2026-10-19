import { distanceKm, type LatLng } from "@/lib/geo";

import { type Style, STYLES } from "./costs";
import { extraPlaces } from "./registry";

/**
 * Road trips: weekend and long-weekend getaways you can drive to, priced for the whole group.
 *
 * Costs (all in USD, for the group):
 *   gas    = round-trip road miles / MPG × GAS_PRICE, per car (4 people a car)
 *   hotel  = the place's nightly rate × travel style × rooms (2 people a room) × nights
 *   days   = food, local getting around and one paid thing a day, per person, for nights + 1 days
 *
 * Sources and assumptions (October 2026):
 *   Gas        this week's EIA price for regular (gas-prices.ts), averaged between home and destination;
 *              GAS_PRICE is the fallback: $4.31, the AAA national average on October 17, 2026.
 *   MPG        25: a little under the record 27.2 mpg EPA measured for new 2024 vehicles, since the cars
 *              people actually drive are older (EPA Automotive Trends Report).
 *   Road miles real driving routes from OpenRouteService when ORS_API_KEY is set (routes.ts); otherwise
 *              1.2 × the straight-line distance at 63 mph (highway driving with short stops), which runs short around lakes and borders.
 *   Hotel and daily rates are WRLD's estimates for a 3-star room and casual meals, set around the U.S.
 *   average room rate of $160.54 a night (CoStar, 2025) and about $67.50 a day per person for food
 *   (BLS 2024): pricier places (resort towns, big coastal cities) sit above it, small towns below.
 *   Tolls, parking and resort fees aren't included.
 */
export const GAS_PRICE = 4.31;
export const GAS_PRICE_AS_OF = "October 17, 2026";
export const MPG = 25;
const ROAD_FACTOR = 1.2;
const MPH = 63;
const PEOPLE_PER_CAR = 4;
const PEOPLE_PER_ROOM = 2;

/** Nightly room rate and per-person day costs for a mid-range trip. */
const TIER = {
  1: { hotel: 130, day: 80 },
  2: { hotel: 165, day: 95 },
  3: { hotel: 225, day: 115 },
} as const;

/**
 * Whole-house vacation rentals, for groups of five or more: WRLD's estimate of a typical 3-4 bedroom
 * house that sleeps about 8, per night on a yearly average (then moved by the season like hotels),
 * plus a cleaning fee per stay and the booking site's service fee (about 14% on Airbnb and Vrbo).
 * Groups usually rent a house at a lake or beach; pricing only hotel rooms overstated those trips.
 */
const RENTAL = { 1: 240, 2: 330, 3: 470 } as const;
const RENTAL_SLEEPS = 8;
const RENTAL_CLEANING = 150;
const RENTAL_FEE = 0.14;
/** Travel style moves house prices less than hotel prices (a cheap house still sleeps everyone). */
const RENTAL_STYLE = { budget: 0.8, mid: 1, comfort: 1.5 } as const;
export const RENTAL_MIN_GROUP = 5;

export type Getaway = {
  key: string;
  name: string;
  state: string;
  latitude: number;
  longitude: number;
  tier: 1 | 2 | 3;
  why: string;
  /** Lesser-known places worth the drive */
  gem?: boolean;
  /** Free things to do there (only ones we're sure are free) */
  free?: string[];
  /** Wikipedia article for the photo, when it isn't "Name, State" */
  photo?: string;
};

/** The hand-picked places plus the ones approved from the harvest. */
export const allGetaways = (): Getaway[] => {
  const more = extraPlaces();
  return more.length ? [...GETAWAYS, ...more] : GETAWAYS;
};

/** Popular U.S. drive-to getaways: cities, beach and lake towns, mountain towns, national parks. */
export const GETAWAYS: Getaway[] = [
  // Midwest
  { key: "traverse-city", name: "Traverse City", state: "MI", latitude: 44.763, longitude: -85.621, tier: 2, why: "Lake Michigan beaches and wineries", free: ["Clinch Park beach and the TART lakeside trail"] },
  { key: "mackinac-island", name: "Mackinac Island", state: "MI", latitude: 45.849, longitude: -84.618, tier: 3, why: "Car-free island, bikes and fudge" },
  { key: "saugatuck", name: "Saugatuck", state: "MI", latitude: 42.655, longitude: -86.203, tier: 2, why: "Beach town with galleries and dunes", free: ["The climb up Mount Baldhead for lake views"] },
  { key: "grand-rapids", name: "Grand Rapids", state: "MI", latitude: 42.963, longitude: -85.668, tier: 1, why: "Breweries and riverfront downtown" },
  { key: "chicago", name: "Chicago", state: "IL", latitude: 41.878, longitude: -87.63, tier: 3, why: "Big-city food, architecture, lakefront", free: ["Millennium Park and the Bean", "Lincoln Park Zoo"] },
  { key: "galena", name: "Galena", state: "IL", latitude: 42.417, longitude: -90.429, tier: 1, why: "Historic small town in the hills" },
  { key: "door-county", name: "Door County", state: "WI", latitude: 45.128, longitude: -87.243, tier: 2, why: "Lakeshore villages and cherry orchards" },
  { key: "wisconsin-dells", name: "Wisconsin Dells", state: "WI", latitude: 43.627, longitude: -89.771, tier: 1, why: "Water parks and river canyons" },
  { key: "milwaukee", name: "Milwaukee", state: "WI", latitude: 43.039, longitude: -87.906, tier: 1, why: "Lakefront, breweries, festivals" },
  { key: "hocking-hills", name: "Hocking Hills", state: "OH", latitude: 39.54, longitude: -82.407, tier: 1, why: "Waterfalls, caves and cabins", free: ["Old Man's Cave and Ash Cave trails (Ohio state parks are free)"] },
  { key: "put-in-bay", name: "Put-in-Bay", state: "OH", latitude: 41.652, longitude: -82.818, tier: 2, why: "Lake Erie island by ferry" },
  { key: "cleveland", name: "Cleveland", state: "OH", latitude: 41.499, longitude: -81.694, tier: 1, why: "Rock Hall and a lakefront downtown", free: ["Cleveland Museum of Art"] },
  { key: "cincinnati", name: "Cincinnati", state: "OH", latitude: 39.103, longitude: -84.512, tier: 1, why: "Riverfront, ballparks, chili" },
  { key: "indianapolis", name: "Indianapolis", state: "IN", latitude: 39.768, longitude: -86.158, tier: 1, why: "Downtown sports and food" },
  { key: "indiana-dunes", name: "Indiana Dunes", state: "IN", latitude: 41.653, longitude: -87.052, tier: 1, why: "National park beaches and dunes" },
  { key: "st-louis", name: "St. Louis", state: "MO", latitude: 38.627, longitude: -90.199, tier: 1, why: "The Arch, barbecue, free museums", free: ["Saint Louis Zoo", "Saint Louis Art Museum"] },
  { key: "kansas-city", name: "Kansas City", state: "MO", latitude: 39.1, longitude: -94.578, tier: 1, why: "Barbecue and jazz" },
  { key: "branson", name: "Branson", state: "MO", latitude: 36.644, longitude: -93.218, tier: 1, why: "Shows and Ozark lakes" },
  { key: "minneapolis", name: "Minneapolis", state: "MN", latitude: 44.978, longitude: -93.265, tier: 2, why: "Lakes, trails and a big music scene" },
  { key: "duluth", name: "Duluth", state: "MN", latitude: 46.787, longitude: -92.1, tier: 1, why: "Lake Superior harbor town", free: ["Canal Park and the Aerial Lift Bridge"] },
  { key: "niagara-falls", name: "Niagara Falls", state: "NY", latitude: 43.096, longitude: -79.037, tier: 1, why: "The falls from the U.S. side", free: ["Niagara Falls State Park (free to walk in; parking is extra)"] },
  // Hidden gems: smaller places worth the drive, many with free things to do
  { key: "petoskey", name: "Petoskey", state: "MI", latitude: 45.373, longitude: -84.955, tier: 2, why: "Victorian downtown on Little Traverse Bay", gem: true, free: ["Hunting for Petoskey stones along the shore", "Little Traverse Wheelway bike trail"] },
  { key: "mackinaw-city", name: "Mackinaw City", state: "MI", latitude: 45.778, longitude: -84.727, tier: 1, why: "Mackinac Bridge views and the ferry to the island", gem: true, free: ["Headlands International Dark Sky Park (free, open day and night)", "Mackinac Bridge views from the shoreline parks"] },
  { key: "frankenmuth", name: "Frankenmuth", state: "MI", latitude: 43.332, longitude: -83.738, tier: 1, why: "Bavarian-style town and chicken dinners", gem: true, free: ["Bronner's CHRISTmas Wonderland (free admission)"] },
  { key: "torch-lake", name: "Torch Lake", state: "MI", latitude: 44.95, longitude: -85.3, tier: 2, why: "Michigan's longest inland lake, known for its turquoise water and the sandbar", gem: true, free: ["Torch Lake Township Day Park beach on the west shore"] },
  { key: "charlevoix", name: "Charlevoix", state: "MI", latitude: 45.318, longitude: -85.258, tier: 2, why: "Harbor town between Lake Michigan and Lake Charlevoix", gem: true, free: ["Self-guided walk past Earl Young's mushroom houses", "South Pier lighthouse and Michigan Beach"] },
  { key: "suttons-bay", name: "Suttons Bay", state: "MI", latitude: 44.976, longitude: -85.65, tier: 2, why: "Bayside village and wineries on the Leelanau Peninsula", gem: true },
  { key: "harbor-springs", name: "Harbor Springs", state: "MI", latitude: 45.431, longitude: -84.992, tier: 3, why: "Quiet resort town on Little Traverse Bay", gem: true, free: ["Tunnel of Trees scenic drive (M-119) north to Cross Village"] },
  { key: "leland", name: "Leland", state: "MI", latitude: 45.023, longitude: -85.761, tier: 2, why: "Historic Fishtown and the Leelanau wine trail", gem: true, free: ["Walking the Fishtown shanties and docks"] },
  { key: "sleeping-bear", name: "Sleeping Bear Dunes", state: "MI", latitude: 44.897, longitude: -85.987, tier: 2, why: "The Dune Climb and Lake Michigan overlooks (national park pass required)" },
  { key: "ludington", name: "Ludington", state: "MI", latitude: 43.955, longitude: -86.452, tier: 1, why: "Lake Michigan beach town and the car ferry to Wisconsin", gem: true, free: ["Stearns Park beach and the North Breakwater Light walk"] },
  { key: "south-haven", name: "South Haven", state: "MI", latitude: 42.403, longitude: -86.274, tier: 1, why: "Blueberry country beach town with a red lighthouse", gem: true, free: ["South Beach and the pier lighthouse walk"] },
  { key: "holland", name: "Holland", state: "MI", latitude: 42.787, longitude: -86.109, tier: 1, why: "Dutch heritage town, Tulip Time in May", gem: true, free: ["Downtown Eighth Street and Centennial Park"] },
  { key: "alpena", name: "Alpena", state: "MI", latitude: 45.062, longitude: -83.432, tier: 1, why: "Shipwreck coast on Lake Huron", gem: true, free: ["Great Lakes Maritime Heritage Center (free admission)"] },
  { key: "oscoda", name: "Oscoda", state: "MI", latitude: 44.42, longitude: -83.33, tier: 1, why: "Lake Huron beaches and the Au Sable River", gem: true, free: ["River Road National Scenic Byway and Lumberman's Monument"] },
  { key: "lake-geneva", name: "Lake Geneva", state: "WI", latitude: 42.592, longitude: -88.433, tier: 2, why: "Lake town with Gilded Age estates", gem: true, free: ["The 21-mile public Geneva Lake Shore Path past the estates"] },
  { key: "paducah", name: "Paducah", state: "KY", latitude: 37.083, longitude: -88.6, tier: 1, why: "River town and UNESCO City of Crafts and Folk Art", gem: true, free: ["The Wall to Wall floodwall murals"] },
  { key: "madison-in", name: "Madison", state: "IN", latitude: 38.736, longitude: -85.38, tier: 1, why: "One of the Midwest's best-kept 1800s river towns", gem: true, free: ["Walking the historic downtown and Ohio River front"] },
  { key: "nashville-in", name: "Nashville (Brown County)", state: "IN", latitude: 39.207, longitude: -86.251, tier: 1, why: "Hill-country art town, best in fall color", gem: true, free: ["Browsing the downtown galleries and studios"] },
  { key: "grand-haven", name: "Grand Haven", state: "MI", latitude: 43.063, longitude: -86.228, tier: 1, why: "Beach town with a lighthouse pier", gem: true, free: ["The pier and lighthouse walk", "Musical Fountain shows on summer nights"] },
  { key: "marquette", name: "Marquette", state: "MI", latitude: 46.543, longitude: -87.395, tier: 1, why: "Lake Superior harbor town in the U.P.", gem: true, free: ["Presque Isle Park", "Sugarloaf Mountain hike"] },
  { key: "cuyahoga-valley", name: "Cuyahoga Valley National Park", state: "OH", latitude: 41.28, longitude: -81.57, tier: 1, why: "Waterfalls and towpath trails between Cleveland and Akron", gem: true, free: ["No entrance fee", "Brandywine Falls"] },
  { key: "starved-rock", name: "Starved Rock", state: "IL", latitude: 41.32, longitude: -88.99, tier: 1, why: "Sandstone canyons with seasonal waterfalls", gem: true, free: ["Starved Rock State Park trails (no entrance fee)"] },
  { key: "apostle-islands", name: "Bayfield and the Apostle Islands", state: "WI", latitude: 46.811, longitude: -90.818, tier: 2, why: "Sea caves and island cruises on Lake Superior", gem: true, free: ["Apostle Islands National Lakeshore (no entrance fee)"] },
  { key: "cherry-springs", name: "Cherry Springs", state: "PA", latitude: 41.663, longitude: -77.823, tier: 1, why: "One of the darkest skies in the East", gem: true, free: ["Cherry Springs State Park stargazing (Pennsylvania state parks are free)"] },
  { key: "ithaca", name: "Ithaca", state: "NY", latitude: 42.444, longitude: -76.502, tier: 1, why: "Gorges and waterfalls in a college town", gem: true, free: ["Ithaca Falls", "Cascadilla Gorge trail"] },
  { key: "new-river-gorge", name: "New River Gorge", state: "WV", latitude: 38.053, longitude: -81.104, tier: 1, why: "Rafting, climbing and the big bridge", gem: true, free: ["New River Gorge National Park (no entrance fee)"] },
  { key: "mammoth-cave", name: "Mammoth Cave", state: "KY", latitude: 37.187, longitude: -86.1, tier: 1, why: "The world's longest known cave system", gem: true, free: ["No park entrance fee; surface trails are free (cave tours cost extra)"] },
  { key: "congaree", name: "Congaree National Park", state: "SC", latitude: 33.83, longitude: -80.82, tier: 1, why: "Boardwalk through old-growth swamp forest", gem: true, free: ["No entrance fee", "The boardwalk loop"] },
  { key: "bentonville", name: "Bentonville", state: "AR", latitude: 36.373, longitude: -94.209, tier: 1, why: "Art museum and mountain-bike trails", gem: true, free: ["Crystal Bridges Museum of American Art (free general admission)"] },
  { key: "buffalo-river", name: "Buffalo National River", state: "AR", latitude: 36.02, longitude: -93.19, tier: 1, why: "Ozark bluffs, floating and hiking", gem: true, free: ["No entrance fee", "Lost Valley trail"] },
  // Northeast
  { key: "new-york", name: "New York City", state: "NY", latitude: 40.713, longitude: -74.006, tier: 3, why: "Shows, food, neighborhoods" },
  { key: "finger-lakes", name: "Finger Lakes", state: "NY", latitude: 42.869, longitude: -76.977, tier: 1, why: "Wineries, gorges and lakes" },
  { key: "lake-placid", name: "Lake Placid", state: "NY", latitude: 44.279, longitude: -73.98, tier: 2, why: "Adirondack hiking and Olympic sites" },
  { key: "boston", name: "Boston", state: "MA", latitude: 42.36, longitude: -71.059, tier: 3, why: "History, harbor and food" },
  { key: "cape-cod", name: "Cape Cod", state: "MA", latitude: 41.658, longitude: -70.3, tier: 3, why: "Beaches and seafood shacks" },
  { key: "newport", name: "Newport", state: "RI", latitude: 41.49, longitude: -71.313, tier: 3, why: "Mansions and the Cliff Walk" },
  { key: "portland-me", name: "Portland", state: "ME", latitude: 43.659, longitude: -70.257, tier: 2, why: "Lobster rolls and lighthouses" },
  { key: "bar-harbor", name: "Bar Harbor", state: "ME", latitude: 44.388, longitude: -68.204, tier: 3, why: "Acadia National Park" },
  { key: "burlington", name: "Burlington", state: "VT", latitude: 44.476, longitude: -73.212, tier: 2, why: "Lake Champlain and mountains" },
  { key: "stowe", name: "Stowe", state: "VT", latitude: 44.465, longitude: -72.685, tier: 3, why: "Mountain town, skiing and leaf peeping" },
  { key: "philadelphia", name: "Philadelphia", state: "PA", latitude: 39.953, longitude: -75.165, tier: 2, why: "History and the food scene" },
  { key: "pittsburgh", name: "Pittsburgh", state: "PA", latitude: 40.441, longitude: -79.996, tier: 1, why: "Rivers, bridges and inclines" },
  { key: "poconos", name: "Poconos", state: "PA", latitude: 40.987, longitude: -75.195, tier: 1, why: "Cabins, lakes and waterfalls" },
  { key: "atlantic-city", name: "Atlantic City", state: "NJ", latitude: 39.364, longitude: -74.423, tier: 1, why: "Boardwalk and beach" },
  { key: "washington-dc", name: "Washington", state: "DC", latitude: 38.907, longitude: -77.037, tier: 3, why: "Free museums and monuments", free: ["Smithsonian museums", "The monuments on the National Mall"] },
  // South
  { key: "nashville", name: "Nashville", state: "TN", latitude: 36.163, longitude: -86.781, tier: 2, why: "Live music on Broadway" },
  { key: "gatlinburg", name: "Gatlinburg", state: "TN", latitude: 35.714, longitude: -83.51, tier: 1, why: "Great Smoky Mountains", free: ["Great Smoky Mountains National Park (no entrance fee; parking tag needed)"] },
  { key: "chattanooga", name: "Chattanooga", state: "TN", latitude: 35.046, longitude: -85.309, tier: 1, why: "Outdoors town on the river" },
  { key: "memphis", name: "Memphis", state: "TN", latitude: 35.15, longitude: -90.049, tier: 1, why: "Blues, barbecue, Graceland" },
  { key: "louisville", name: "Louisville", state: "KY", latitude: 38.253, longitude: -85.759, tier: 1, why: "Bourbon trail and Churchill Downs" },
  { key: "asheville", name: "Asheville", state: "NC", latitude: 35.595, longitude: -82.551, tier: 2, why: "Blue Ridge views and breweries", free: ["Blue Ridge Parkway overlooks"] },
  { key: "outer-banks", name: "Outer Banks", state: "NC", latitude: 36.031, longitude: -75.676, tier: 2, why: "Barrier-island beaches" },
  { key: "virginia-beach", name: "Virginia Beach", state: "VA", latitude: 36.853, longitude: -75.978, tier: 2, why: "Boardwalk beach" },
  { key: "williamsburg", name: "Williamsburg", state: "VA", latitude: 37.271, longitude: -76.707, tier: 1, why: "Colonial history and theme parks" },
  { key: "shenandoah", name: "Shenandoah", state: "VA", latitude: 38.665, longitude: -78.459, tier: 1, why: "Skyline Drive and hiking" },
  { key: "charleston", name: "Charleston", state: "SC", latitude: 32.777, longitude: -79.931, tier: 3, why: "Food, history and beaches" },
  { key: "myrtle-beach", name: "Myrtle Beach", state: "SC", latitude: 33.689, longitude: -78.887, tier: 1, why: "Beach and boardwalk" },
  { key: "savannah", name: "Savannah", state: "GA", latitude: 32.081, longitude: -81.091, tier: 2, why: "Oak-lined squares and riverfront" },
  { key: "atlanta", name: "Atlanta", state: "GA", latitude: 33.749, longitude: -84.388, tier: 2, why: "Food, music and the BeltLine" },
  { key: "gulf-shores", name: "Gulf Shores", state: "AL", latitude: 30.246, longitude: -87.701, tier: 2, why: "White-sand Gulf beaches" },
  { key: "new-orleans", name: "New Orleans", state: "LA", latitude: 29.951, longitude: -90.072, tier: 2, why: "Food, jazz and the French Quarter" },
  { key: "destin", name: "Destin", state: "FL", latitude: 30.394, longitude: -86.496, tier: 3, why: "Emerald-water beaches" },
  { key: "st-augustine", name: "St. Augustine", state: "FL", latitude: 29.901, longitude: -81.313, tier: 2, why: "Oldest city and beaches" },
  { key: "orlando", name: "Orlando", state: "FL", latitude: 28.538, longitude: -81.379, tier: 2, why: "Theme parks" },
  { key: "miami", name: "Miami", state: "FL", latitude: 25.762, longitude: -80.192, tier: 3, why: "Beaches and nightlife" },
  { key: "key-west", name: "Key West", state: "FL", latitude: 24.555, longitude: -81.78, tier: 3, why: "Island town at the end of the road" },
  { key: "hot-springs", name: "Hot Springs", state: "AR", latitude: 34.503, longitude: -93.055, tier: 1, why: "Bathhouses and a national park", free: ["Hot Springs National Park and Bathhouse Row (no entrance fee)"] },
  { key: "austin", name: "Austin", state: "TX", latitude: 30.267, longitude: -97.743, tier: 2, why: "Live music and swimming holes" },
  { key: "san-antonio", name: "San Antonio", state: "TX", latitude: 29.424, longitude: -98.494, tier: 1, why: "River Walk and the Alamo" },
  { key: "fredericksburg", name: "Fredericksburg", state: "TX", latitude: 30.275, longitude: -98.872, tier: 2, why: "Hill Country wineries" },
  { key: "galveston", name: "Galveston", state: "TX", latitude: 29.301, longitude: -94.798, tier: 1, why: "Gulf beach town" },
  // West
  { key: "las-vegas", name: "Las Vegas", state: "NV", latitude: 36.17, longitude: -115.14, tier: 1, why: "Shows, pools and the Strip" },
  { key: "lake-tahoe", name: "Lake Tahoe", state: "CA", latitude: 38.94, longitude: -119.977, tier: 2, why: "Alpine lake, hiking and skiing" },
  { key: "palm-springs", name: "Palm Springs", state: "CA", latitude: 33.83, longitude: -116.545, tier: 2, why: "Desert pools and mid-century style" },
  { key: "san-diego", name: "San Diego", state: "CA", latitude: 32.716, longitude: -117.161, tier: 3, why: "Beaches and tacos" },
  { key: "los-angeles", name: "Los Angeles", state: "CA", latitude: 34.052, longitude: -118.244, tier: 3, why: "Beaches, food and studios" },
  { key: "santa-barbara", name: "Santa Barbara", state: "CA", latitude: 34.42, longitude: -119.698, tier: 3, why: "Coast and wine country" },
  { key: "san-francisco", name: "San Francisco", state: "CA", latitude: 37.775, longitude: -122.419, tier: 3, why: "Hills, bay views and food" },
  { key: "napa", name: "Napa Valley", state: "CA", latitude: 38.297, longitude: -122.287, tier: 3, why: "Wine country" },
  { key: "monterey", name: "Monterey and Carmel", state: "CA", latitude: 36.6, longitude: -121.894, tier: 3, why: "Big Sur coast and the aquarium" },
  { key: "yosemite", name: "Yosemite", state: "CA", latitude: 37.865, longitude: -119.538, tier: 2, why: "Granite cliffs and waterfalls" },
  { key: "sedona", name: "Sedona", state: "AZ", latitude: 34.87, longitude: -111.761, tier: 3, why: "Red-rock hikes" },
  { key: "grand-canyon", name: "Grand Canyon", state: "AZ", latitude: 36.056, longitude: -112.14, tier: 2, why: "South Rim views" },
  { key: "scottsdale", name: "Scottsdale", state: "AZ", latitude: 33.494, longitude: -111.926, tier: 2, why: "Desert resorts and golf" },
  { key: "zion", name: "Zion", state: "UT", latitude: 37.188, longitude: -113.0, tier: 2, why: "Canyon hikes" },
  { key: "moab", name: "Moab", state: "UT", latitude: 38.573, longitude: -109.55, tier: 2, why: "Arches and Canyonlands" },
  { key: "park-city", name: "Park City", state: "UT", latitude: 40.646, longitude: -111.498, tier: 3, why: "Mountain town, skiing and trails" },
  { key: "denver", name: "Denver", state: "CO", latitude: 39.739, longitude: -104.99, tier: 2, why: "Breweries and mountain day trips" },
  { key: "estes-park", name: "Estes Park", state: "CO", latitude: 40.377, longitude: -105.521, tier: 2, why: "Rocky Mountain National Park" },
  { key: "santa-fe", name: "Santa Fe", state: "NM", latitude: 35.687, longitude: -105.938, tier: 2, why: "Adobe, art and food" },
  { key: "portland-or", name: "Portland", state: "OR", latitude: 45.515, longitude: -122.679, tier: 2, why: "Food carts and coffee" },
  { key: "cannon-beach", name: "Cannon Beach", state: "OR", latitude: 45.892, longitude: -123.961, tier: 2, why: "Haystack Rock and tide pools" },
  { key: "bend", name: "Bend", state: "OR", latitude: 44.058, longitude: -121.315, tier: 2, why: "High-desert outdoors and breweries" },
  { key: "seattle", name: "Seattle", state: "WA", latitude: 47.606, longitude: -122.332, tier: 3, why: "Waterfront, markets and ferries" },
  { key: "jackson", name: "Jackson", state: "WY", latitude: 43.48, longitude: -110.762, tier: 3, why: "Grand Teton National Park" },
  { key: "west-yellowstone", name: "West Yellowstone", state: "MT", latitude: 44.662, longitude: -111.104, tier: 2, why: "Gateway to Yellowstone" },
];

export type DriveLength = {
  nights: number;
  label: string;
  gas: number;
  /** Where the group sleeps: hotel rooms for two, or whole vacation houses (groups of five or more, when cheaper) */
  hotel: number;
  stay: "hotel" | "rental";
  days: number;
  total: number;
  fits: boolean;
};
/** Gas prices to use: at home, and by destination state. Defaults to the national average in GAS_PRICE. */
export type GasInput = { home: number; at: (state: string) => number };
export type DriveOption = {
  getaway: Getaway;
  roadMiles: number;
  /** One way, hours */
  hours: number;
  /** Miles and hours come from a real road route, not an estimate */
  routed: boolean;
  lengths: DriveLength[];
  /** The longest trip that fits the budget, if any */
  best: DriveLength | null;
  /** $ a gallon used: the average of the price at home and at the destination */
  gasPrice: number;
  /** Hotel price for the month against the place's yearly average, and where that came from */
  season: { factor: number; source: "gsa" | "pattern" };
};
/** Hotel price this month against the yearly average for a place (1 = average). */
export type SeasonFn = (g: Getaway) => { factor: number; source: "gsa" | "pattern" };
const FLAT: SeasonFn = () => ({ factor: 1, source: "pattern" });

/** Getaways close enough that a road trip could make sense (straight line), for asking a router about. */
export function getawaysNear(home: LatLng, maxMiles = 520) {
  return allGetaways().filter((g) => distanceKm(home, g) * 0.621371 <= maxMiles);
}

/** The traveler's state, roughly: the state of the nearest listed getaway (good enough to pick an EIA region). */
export function nearestState(home: LatLng) {
  let best: Getaway | null = null;
  let km = Infinity;
  for (const g of GETAWAYS) {
    const d = distanceKm(home, g);
    if (d < km) [best, km] = [g, d];
  }
  return best && km < 500 ? best.state : null;
}

type PriceCtx = { cash: number; travelers: number; f: number; rentalF: number; cars: number; rooms: number; nightsList: number[]; season: SeasonFn };

function priceDrive(home: LatLng, g: Getaway, c: PriceCtx, gasPrices: GasInput, route: { miles: number; hours: number } | undefined, limitHours: boolean): DriveOption | null {
  const roadMiles = Math.round(route?.miles ?? distanceKm(home, g) * 0.621371 * ROAD_FACTOR);
  if (roadMiles < 60) return null;
  const hours = route?.hours ?? roadMiles / MPH;
  const t = TIER[g.tier];
  const gasPrice = Math.round(((gasPrices.home + gasPrices.at(g.state)) / 2) * 1000) / 1000;
  const gas = Math.round(((roadMiles * 2) / MPG) * gasPrice * c.cars);
  const season = c.season(g);
  const lengths = c.nightsList
    .filter((n) => !limitHours || hours <= maxHoursFor(n))
    .map((n) => {
      const rooms = Math.round(t.hotel * season.factor * c.f * c.rooms * n);
      const houses = Math.ceil(c.travelers / RENTAL_SLEEPS);
      const rental =
        c.travelers >= RENTAL_MIN_GROUP
          ? Math.round((RENTAL[g.tier] * season.factor * c.rentalF * n * (1 + RENTAL_FEE) + RENTAL_CLEANING) * houses)
          : Infinity;
      const stay: DriveLength["stay"] = rental < rooms ? "rental" : "hotel";
      const hotel = Math.min(rooms, rental);
      const days = Math.round(t.day * c.f * c.travelers * (n + 1));
      const total = gas + hotel + days;
      return { nights: n, label: lengthLabel(n), gas, hotel, stay, days, total, fits: total <= c.cash };
    });
  if (!lengths.length) return null;
  const fitting = lengths.filter((l) => l.fits);
  return { getaway: g, roadMiles, hours, lengths, best: fitting.length ? fitting[fitting.length - 1] : null, gasPrice, routed: Boolean(route), season };
}

/** Longest one-way drive WRLD will price when you ask for a place by name. */
export const MAX_DRIVE_HOURS = 14;

/**
 * One place you asked for ("Torch Lake"): a road trip there for your trip length, a weekend and a
 * long weekend, however far it is (up to MAX_DRIVE_HOURS each way). Null when it's too close or too far.
 */
export function driveTo(
  home: LatLng,
  g: Getaway,
  input: { cash: number; travelers: number; style: Style; nights?: number; season?: SeasonFn },
  gasPrices: GasInput = { home: GAS_PRICE, at: () => GAS_PRICE },
  route?: { miles: number; hours: number },
): DriveOption | null {
  const travelers = Math.max(1, input.travelers);
  const n = input.nights && input.nights >= 1 && input.nights <= 14 ? input.nights : null;
  const nightsList = [...new Set([2, 3, ...(n ? [n] : [])])].sort((a, b) => a - b);
  const o = priceDrive(
    home,
    g,
    { cash: input.cash, travelers, f: STYLES[input.style].factor, cars: Math.ceil(travelers / PEOPLE_PER_CAR), rooms: Math.ceil(travelers / PEOPLE_PER_ROOM), rentalF: RENTAL_STYLE[input.style], nightsList, season: input.season ?? FLAT },
    gasPrices,
    route,
    false,
  );
  return o && o.hours <= MAX_DRIVE_HOURS ? o : null;
}

const foldName = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Road-trip places matching what was typed: "torch lake", "Torch Lake, MI", "charlev". */
export function matchGetaways(text: string, limit = 5): Getaway[] {
  const raw = foldName(text);
  const q = raw.replace(/ (?:[a-z]{2}|michigan|wisconsin|ohio|indiana|illinois)$/, "");
  if (q.length < 3) return [];
  const scored: { g: Getaway; score: number }[] = [];
  for (const g of allGetaways()) {
    const name = foldName(g.name);
    const full = `${name} ${g.state.toLowerCase()}`;
    const score = name === q || full === raw ? 100 : name.startsWith(q) ? 60 : name.includes(q) ? 30 : 0;
    if (score) scored.push({ g, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.g);
}

const lengthLabel = (n: number) => (n === 2 ? "Weekend" : n === 3 ? "Long weekend" : `${n} nights`);
/** How far is a reasonable drive for a trip of this length, each way. */
export const maxHoursFor = (nights: number) => (nights <= 2 ? 5 : nights === 3 ? 7 : 9);

export function formatDrive(hours: number) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60 / 5) * 5;
  if (m === 60) return `${h + 1} hr`;
  return h ? `${h} hr${m ? ` ${m} min` : ""}` : `${m} min`;
}

/**
 * Getaways within a reasonable drive of home for a weekend (2 nights), a long weekend (3 nights) and,
 * when asked for, the traveler's own trip length (up to a week). Sorted with the biggest trip that fits first.
 */
export function driveTrips(
  home: LatLng,
  input: { cash: number; travelers: number; style: Style; nights?: number; season?: SeasonFn },
  gasPrices: GasInput = { home: GAS_PRICE, at: () => GAS_PRICE },
  /** Real driving distances and times by getaway key (OpenRouteService), when available */
  routes?: Map<string, { miles: number; hours: number }> | null,
): DriveOption[] {
  const f = STYLES[input.style].factor;
  const travelers = Math.max(1, input.travelers);
  const cars = Math.ceil(travelers / PEOPLE_PER_CAR);
  const rooms = Math.ceil(travelers / PEOPLE_PER_ROOM);
  const nightsList = [...new Set([2, 3, ...(input.nights && input.nights >= 4 && input.nights <= 7 ? [input.nights] : [])])];
  const out: DriveOption[] = [];
  for (const g of allGetaways()) {
    const o = priceDrive(home, g, { ...input, travelers, f, rentalF: RENTAL_STYLE[input.style], cars, rooms, nightsList, season: input.season ?? FLAT }, gasPrices, routes?.get(g.key), true);
    if (o) out.push(o);
  }
  return out.sort(
    (a, b) =>
      Number(Boolean(b.best)) - Number(Boolean(a.best)) ||
      (b.best && a.best ? b.best.nights - a.best.nights || b.best.total - a.best.total : a.lengths[0].total - b.lengths[0].total),
  );
}
