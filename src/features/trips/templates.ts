/**
 * Starting points for the trips organizers actually plan. A template fills in the new-trip form
 * (name, group size, a starting budget) and adds a checklist built for that kind of trip.
 * Budgets are per person, in USD, set from what Americans actually spend, so the first number the
 * group sees is realistic:
 *   bachelorette $1,300 / bachelor $1,500 per guest: The Knot 2023 Bach Study (average party: 2 days)
 *   milestone birthday $1,450: MMGY Portrait of American Travelers, fall 2026 ($5,655 a year over 3.9 trips)
 *   friends' long weekend $1,050: average domestic fare $522 (BTS, Q1 2026) + shared room at the
 *     $160.54 U.S. average rate (CoStar 2025) for 3 nights + $67.50 a day for food (BLS 2024)
 *   family vacation $1,550: a one-week domestic trip, about $1,556 a person (The Motley Fool, 2026,
 *     from BTS fares, CoStar room rates and BLS food spending)
 * A place to start the group conversation, not a quote.
 */
export type TripTemplate = {
  id: string;
  name: string;
  /** One line for the card */
  blurb: string;
  party: number;
  nights: number;
  perPerson: number;
  /** Free stock photo (Unsplash License: free for commercial use, no attribution required). */
  photo: { src: string; alt: string; focus: string; credit: string; page: string; /** Where the photo was taken, shown on the tile */ place: string };
  todo: string[];
  packing: string[];
};

export const TEMPLATES: TripTemplate[] = [
  {
    id: "bachelorette",
    name: "Bachelorette weekend",
    blurb: "The average guest spends about $1,300. Agree on the number before anyone books the house.",
    party: 8,
    nights: 2,
    perPerson: 1300,
    photo: { src: "https://images.unsplash.com/photo-1693433582807-ab93ea7c297e", alt: "Broadway in downtown Nashville at dusk", focus: "52% 50%", credit: "Isaac Macdonald", page: "https://unsplash.com/photos/a-city-street-filled-with-lots-of-traffic-and-tall-buildings-Z941si-U2pw", place: "Broadway, Nashville, Tennessee" },
    todo: [
      "Agree on the budget per person before booking",
      "Agree what a point is worth if anyone books with points",
      "Book the house",
      "Book the main group activity",
      "Collect deposits for the house",
      "Pick a dinner spot for the big night",
    ],
    packing: ["Outfit for the big night", "Swimsuit", "Phone charger", "ID"],
  },
  {
    id: "bachelor",
    name: "Bachelor weekend",
    blurb: "About $1,500 a guest on average. Flights, a house and one big day out, split so nobody's chasing payments.",
    party: 8,
    nights: 2,
    perPerson: 1500,
    photo: { src: "https://images.unsplash.com/photo-1593810659067-3abb9b4dfa4c", alt: "Friends sitting under a pink and yellow lifeguard tower on Miami Beach", focus: "50% 66%", credit: "Emanuel Ekström", page: "https://unsplash.com/photos/pink-and-yellow-wooden-lifeguard-house-on-beach-during-daytime-HgVE4_VWgos", place: "South Beach, Miami Beach, Florida" },
    todo: [
      "Agree on the budget per person before booking",
      "Agree what a point is worth if anyone books with points",
      "Book the house",
      "Book the big day out (boat, golf, game)",
      "Collect deposits",
    ],
    packing: ["Matching shirts", "Swimsuit", "Phone charger", "ID"],
  },
  {
    id: "birthday",
    name: "Milestone birthday",
    blurb: "A 30th, 40th or 50th: get the friends who say \"I'm in\" to actually book.",
    party: 6,
    nights: 4,
    perPerson: 1450,
    photo: { src: "https://images.unsplash.com/photo-1457537227909-08f41319e53c", alt: "Clear blue water on a sandy beach in Cancún", focus: "50% 72%", credit: "Joe Cooke", page: "https://unsplash.com/photos/clear-blue-ocean-washing-on-the-sandy-shore-on-a-clear-day-in-cancun-MPFiYu__1bA", place: "Cancún, Mexico" },
    todo: [
      "Set the dates with a vote",
      "Agree on the budget per person",
      "Book the birthday dinner",
      "Plan the surprise (keep the birthday person off this list)",
    ],
    packing: ["Something for the birthday dinner", "Card or gift", "Phone charger"],
  },
  {
    id: "friends",
    name: "Friends' long weekend",
    blurb: "Four friends, three nights, one plan instead of four group-chat threads.",
    party: 4,
    nights: 3,
    perPerson: 1050,
    photo: { src: "https://images.unsplash.com/photo-1660525185695-05d8a6435258", alt: "Boats on the Chicago River between downtown towers", focus: "50% 60%", credit: "Zander Betterton", page: "https://unsplash.com/photos/a-river-with-chicago-river-and-boats-ff6MPtScTQM", place: "Chicago River, Chicago, Illinois" },
    todo: ["Vote on where", "Agree on the budget per person", "Book the stay", "Pick one thing each person wants to do"],
    packing: ["Comfortable walking shoes", "Phone charger", "ID"],
  },
  {
    id: "family",
    name: "Family vacation",
    blurb: "Kids, grandparents and two budgets: where everyone sleeps and who pays for what, in one place.",
    party: 6,
    nights: 7,
    perPerson: 1550,
    photo: { src: "https://images.unsplash.com/photo-1571076345370-02c48d31815d", alt: "Sunset over the Grand Canyon from Cape Royal", focus: "50% 50%", credit: "John Fowler", page: "https://unsplash.com/photos/view-of-grand-canyon-during-golde-hour-NRDAqLCv65Q", place: "Cape Royal, Grand Canyon, Arizona" },
    todo: [
      "Agree on dates around school breaks",
      "Decide how costs are split (per person or per household)",
      "Book the rooms or house",
      "Plan one day everyone does together",
      "Check car seats and accessibility needs",
    ],
    packing: ["Medications", "Chargers", "Games for downtime"],
  },
];

export const templateById = (id: string | null | undefined) => TEMPLATES.find((t) => t.id === id) ?? null;
