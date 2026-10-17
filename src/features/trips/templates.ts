/**
 * Starting points for the trips organizers actually plan. A template fills in the new-trip form
 * (name, group size, a starting budget) and adds a checklist built for that kind of trip.
 * Budgets are per person, in USD, for a long weekend in the US or a short hop abroad; they're a
 * place to start the group conversation, not a quote.
 */
export type TripTemplate = {
  id: string;
  name: string;
  /** One line for the card */
  blurb: string;
  party: number;
  nights: number;
  perPerson: number;
  photo: { src: string; alt: string; focus: string };
  todo: string[];
  packing: string[];
};

export const TEMPLATES: TripTemplate[] = [
  {
    id: "bachelorette",
    name: "Bachelorette weekend",
    blurb: "Ten people, one house, a budget the whole group signs off on before anyone books.",
    party: 10,
    nights: 3,
    perPerson: 1400,
    photo: { src: "/photos/lisbon-alfama-sunset.webp", alt: "Lisbon rooftops at sunset", focus: "50% 62%" },
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
    blurb: "Flights, a house and one big day out, split so nobody's chasing payments afterward.",
    party: 8,
    nights: 3,
    perPerson: 1300,
    photo: { src: "/photos/marseille-calanque.webp", alt: "A turquoise cove among limestone cliffs", focus: "45% 60%" },
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
    nights: 3,
    perPerson: 1100,
    photo: { src: "/photos/arrabida-beach.webp", alt: "A wide sandy beach with calm blue water", focus: "50% 70%" },
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
    perPerson: 900,
    photo: { src: "/photos/porto-douro-dusk.webp", alt: "Dusk over the river in Porto", focus: "50% 50%" },
    todo: ["Vote on where", "Agree on the budget per person", "Book the stay", "Pick one thing each person wants to do"],
    packing: ["Comfortable walking shoes", "Phone charger", "ID"],
  },
  {
    id: "family",
    name: "Family vacation",
    blurb: "Kids, grandparents and two budgets: where everyone sleeps and who pays for what, in one place.",
    party: 6,
    nights: 5,
    perPerson: 900,
    photo: { src: "/photos/annecy-canal.webp", alt: "A canal lined with flower boxes, mountains behind", focus: "45% 55%" },
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
