/**
 * Experience ideas WRLD can suggest anywhere, matched to a traveler's
 * interests and compass. They're kinds of things to do, not specific
 * businesses, so they never go stale; "Add to trip" searches for the real
 * place in that trip's city.
 *
 * x: culture (−2) ↔ nature (+2)    y: relaxing (−2) ↔ active (+2)
 */
export type Idea = {
  id: string;
  title: string; // "{city}" is replaced with the trip's city when there is one
  blurb: string;
  search: string; // what to look up in the trip's city
  tags: string[];
  x: number;
  y: number;
};

export const IDEAS: Idea[] = [
  { id: "sunrise-hike", title: "Sunrise hike above {city}", blurb: "Start before the crowds and earn the best view of the trip.", search: "hiking trail viewpoint", tags: ["hiking", "viewpoints"], x: 2, y: 2 },
  { id: "kayak", title: "Kayak or paddleboard the coast", blurb: "See the shoreline from the water, usually with a guide and all gear included.", search: "kayak tour", tags: ["kayaking", "water_sports"], x: 2, y: 1 },
  { id: "surf-lesson", title: "Surf or dive lesson", blurb: "A beginner session is a half day and a story for years.", search: "surf school", tags: ["water_sports"], x: 2, y: 2 },
  { id: "wildlife", title: "Wildlife or nature reserve day", blurb: "Birds, dolphins or whatever the region is famous for, with a local guide.", search: "nature reserve", tags: ["wildlife"], x: 2, y: 0 },
  { id: "stargazing", title: "Stargazing away from the city lights", blurb: "A clear night outside town beats any rooftop.", search: "stargazing", tags: ["stargazing"], x: 2, y: -1 },
  { id: "scenic-ride", title: "Scenic train or ferry ride", blurb: "Let the route be the attraction for an afternoon.", search: "scenic train ferry", tags: ["scenic_journeys", "road_trips"], x: 1, y: -1 },
  { id: "beach-day", title: "A slow beach day near {city}", blurb: "Pick a quieter beach, pack a lunch, and don't plan anything else.", search: "beach", tags: ["beaches", "relaxation", "picnics"], x: 2, y: -2 },
  { id: "hot-springs", title: "Spa, baths or hot springs", blurb: "A reset day in the middle of the trip pays off.", search: "spa thermal baths", tags: ["wellness", "relaxation"], x: 1, y: -2 },
  { id: "park-picnic", title: "Picnic in {city}'s best park", blurb: "Grab bread, cheese and fruit at a market and find a patch of grass.", search: "park garden", tags: ["picnics", "markets"], x: 1, y: -2 },
  { id: "old-town-walk", title: "Guided walk through the old town", blurb: "Two hours with a local guide explains everything you'll see after.", search: "walking tour old town", tags: ["walking_tours", "history", "architecture"], x: -2, y: 1 },
  { id: "big-museum", title: "{city}'s headline museum", blurb: "Go at opening time and pick one wing instead of trying to see it all.", search: "museum", tags: ["museums", "art", "history"], x: -2, y: 1 },
  { id: "small-gallery", title: "A small gallery or design museum", blurb: "Less famous, less crowded, often more memorable.", search: "art gallery", tags: ["art", "museums"], x: -2, y: -1 },
  { id: "architecture", title: "Architecture highlights on foot", blurb: "Map the buildings worth seeing and walk between them.", search: "architecture landmark", tags: ["architecture", "landmarks"], x: -1, y: 1 },
  { id: "market", title: "Morning at the food market", blurb: "Eat your way through breakfast where locals shop.", search: "food market", tags: ["markets", "street_food"], x: -1, y: 0 },
  { id: "food-tour", title: "Street food tour", blurb: "Ten tastes in three hours, and you'll know where to eat for the rest of the trip.", search: "food tour", tags: ["street_food", "walking_tours"], x: -1, y: 1 },
  { id: "cooking-class", title: "Cooking class with a local chef", blurb: "Learn one dish you'll keep making at home.", search: "cooking class", tags: ["cooking_classes"], x: -1, y: -1 },
  { id: "wine", title: "Wine or tasting afternoon", blurb: "A bar or vineyard that pours local bottles you can't get at home.", search: "wine tasting", tags: ["wine"], x: -1, y: -1 },
  { id: "special-dinner", title: "One really good dinner", blurb: "Book ahead for the place everyone in {city} talks about.", search: "restaurant", tags: ["fine_dining"], x: -2, y: 0 },
  { id: "cafe-morning", title: "Café crawl in a local neighborhood", blurb: "Three coffees, no agenda, lots of people-watching.", search: "cafe", tags: ["cafes", "neighborhoods"], x: -1, y: -2 },
  { id: "bookshop", title: "Old bookshops and quiet corners", blurb: "Many cities have a bookstore worth the trip by itself.", search: "bookstore", tags: ["bookstores", "neighborhoods"], x: -1, y: -2 },
  { id: "live-music", title: "Live music or a show", blurb: "Whatever {city} is known for — fado, jazz, flamenco, theater.", search: "live music", tags: ["live_music", "nightlife"], x: -2, y: 1 },
  { id: "night-out", title: "A night out where locals go", blurb: "Skip the tourist strip; ask your host where they'd go.", search: "bar", tags: ["nightlife"], x: -2, y: 2 },
  { id: "shopping-street", title: "Shopping street and design shops", blurb: "Local brands and makers over the global chains.", search: "shopping street", tags: ["shopping"], x: -2, y: 1 },
  { id: "camping", title: "A night under the stars", blurb: "A campsite or mountain hut turns a day trip into a story.", search: "campsite", tags: ["camping", "stargazing"], x: 2, y: 1 },
];
