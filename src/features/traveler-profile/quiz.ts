/**
 * Travel-type quiz: questions, scoring, and the five travel types.
 *
 * Compass axes (each −10 … +10):
 *   x  Culture (−)  ↔  Nature (+)          where you want to be
 *   y  Relaxing (−) ↔  Active (+)          how much energy you want to spend
 *
 * The database recomputes the archetype from x/y on save
 * (private.archetype_for in migration 06). `archetypeFor` below must
 * stay in sync with it — it's used to show the result instantly.
 */

import type { TravelArchetype } from '@/types/database';

export const QUIZ_VERSION = 1;

export type QuizOption = {
  id: string;
  label: string;
  /** Lean on each axis, −2 … +2 */
  x: number;
  y: number;
  /** Interest tags this answer signals (slugs from public.interest_tags) */
  tags: string[];
};

export type QuizQuestion = {
  id: string;
  prompt: string;
  options: QuizOption[];
};

export const QUIZ: QuizQuestion[] = [
  {
    id: 'first_morning',
    prompt: "It's your first morning somewhere new. You…",
    options: [
      { id: 'a', label: 'Lace up for a sunrise hike to the best view in town', x: 2, y: 2, tags: ['hiking', 'viewpoints'] },
      { id: 'b', label: "Are first in line when the city's big museum opens", x: -2, y: 1, tags: ['museums', 'landmarks'] },
      { id: 'c', label: 'Find a corner café and watch the neighborhood wake up', x: -1, y: -1, tags: ['cafes', 'neighborhoods'] },
      { id: 'd', label: 'Sleep in, then wander to the beach with a book', x: 1, y: -2, tags: ['beaches', 'relaxation'] },
    ],
  },
  {
    id: 'souvenir',
    prompt: 'Your favorite souvenir is…',
    options: [
      { id: 'a', label: 'A photo from a summit most people never reach', x: 2, y: 1, tags: ['hiking', 'viewpoints'] },
      { id: 'b', label: 'Bags from the most famous shopping street', x: -2, y: 1, tags: ['shopping', 'landmarks'] },
      { id: 'c', label: 'A bottle from a tiny wine shop the owner recommended', x: -1, y: -1, tags: ['wine', 'markets'] },
      { id: 'd', label: 'A smooth stone from a beach with nobody on it', x: 1, y: -1, tags: ['beaches'] },
    ],
  },
  {
    id: 'day_shape',
    prompt: 'How full should a vacation day be?',
    options: [
      { id: 'a', label: 'Packed. Every hour has a plan.', x: 0, y: 2, tags: [] },
      { id: 'b', label: 'Two or three big things, with room to wander', x: 0, y: 1, tags: [] },
      { id: 'c', label: 'One thing, then see where the day goes', x: 0, y: -1, tags: [] },
      { id: 'd', label: 'Having no plan is the plan', x: 0, y: -2, tags: [] },
    ],
  },
  {
    id: 'afternoon',
    prompt: 'Pick an afternoon:',
    options: [
      { id: 'a', label: 'Kayaking along a rocky coastline', x: 2, y: 1, tags: ['kayaking', 'water_sports'] },
      { id: 'b', label: 'A guided walk through the historic old town', x: -2, y: 1, tags: ['history', 'walking_tours'] },
      { id: 'c', label: 'A cooking class with a local chef', x: -1, y: -1, tags: ['cooking_classes', 'street_food'] },
      { id: 'd', label: 'Soaking in hot springs with a mountain view', x: 1, y: -2, tags: ['wellness'] },
    ],
  },
  {
    id: 'sleep',
    prompt: 'Where do you sleep best?',
    options: [
      { id: 'a', label: 'A tent or a mountain hut', x: 2, y: 1, tags: ['camping'] },
      { id: 'b', label: 'A central hotel, walking distance to everything', x: -2, y: 1, tags: ['landmarks'] },
      { id: 'c', label: 'A quirky guesthouse in a local neighborhood', x: -1, y: -1, tags: ['neighborhoods'] },
      { id: 'd', label: 'A cabin or villa right by the water', x: 1, y: -2, tags: ['beaches', 'relaxation'] },
    ],
  },
  {
    id: 'dinner',
    prompt: 'Dinner tonight is…',
    options: [
      { id: 'a', label: 'Whatever tastes amazing after a 15-mile day', x: 2, y: 2, tags: ['hiking'] },
      { id: 'b', label: 'The restaurant everyone told you not to miss', x: -2, y: 1, tags: ['fine_dining'] },
      { id: 'c', label: 'Wherever the locals are lined up', x: -1, y: 0, tags: ['street_food', 'markets'] },
      { id: 'd', label: 'A picnic timed perfectly for sunset', x: 1, y: -2, tags: ['picnics', 'viewpoints'] },
    ],
  },
  {
    id: 'rain',
    prompt: 'It rains all day. You…',
    options: [
      { id: 'a', label: 'Grab a rain jacket. Waterfalls are better wet.', x: 2, y: 2, tags: ['hiking', 'wildlife'] },
      { id: 'b', label: 'Finally get to every gallery on your list', x: -2, y: 1, tags: ['art', 'museums'] },
      { id: 'c', label: 'Settle into a long lunch and a good bookstore', x: -1, y: -2, tags: ['bookstores', 'cafes'] },
      { id: 'd', label: 'Watch the storm from somewhere cozy with a view', x: 1, y: -2, tags: ['relaxation'] },
    ],
  },
  {
    id: 'bucket_list',
    prompt: 'Pick a bucket-list trip:',
    options: [
      { id: 'a', label: 'Trekking through Patagonia', x: 2, y: 2, tags: ['hiking', 'camping'] },
      { id: 'b', label: 'Paris, Rome and Barcelona in ten days', x: -2, y: 2, tags: ['landmarks', 'museums'] },
      { id: 'c', label: 'A month living in a Lisbon apartment', x: -1, y: -2, tags: ['neighborhoods', 'cafes'] },
      { id: 'd', label: 'Island-hopping between quiet beaches', x: 1, y: -1, tags: ['beaches', 'scenic_journeys'] },
    ],
  },
  {
    id: 'night',
    prompt: 'After dark, you are…',
    options: [
      { id: 'a', label: 'Asleep. The trailhead opens at 6.', x: 1, y: 1, tags: ['hiking'] },
      { id: 'b', label: 'At a rooftop bar, then a show', x: -2, y: 2, tags: ['nightlife', 'live_music'] },
      { id: 'c', label: 'Sharing a bottle at a tiny wine bar', x: -1, y: -1, tags: ['wine'] },
      { id: 'd', label: 'Somewhere dark enough to see the Milky Way', x: 2, y: -1, tags: ['stargazing'] },
    ],
  },
  {
    id: 'getting_around',
    prompt: 'Between places, you prefer to…',
    options: [
      { id: 'a', label: 'Rent a car and cover serious ground', x: 1, y: 2, tags: ['road_trips'] },
      { id: 'b', label: 'Take fast trains city to city', x: -2, y: 1, tags: ['landmarks'] },
      { id: 'c', label: 'Stay put in one place and walk everywhere', x: 0, y: -2, tags: ['neighborhoods'] },
      { id: 'd', label: 'Take the slow, scenic train or ferry', x: 1, y: -1, tags: ['scenic_journeys'] },
    ],
  },
];

// ---------------------------------------------------------------------------
// Travel types
// ---------------------------------------------------------------------------
export type ArchetypeInfo = {
  id: TravelArchetype;
  name: string;
  tagline: string;
  description: string;
  /** Quadrant on the compass, for placing labels */
  quadrant: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  examples: string[];
};

export const ARCHETYPES: Record<TravelArchetype, ArchetypeInfo> = {
  itinerary_athlete: {
    id: 'itinerary_athlete',
    name: 'The Itinerary Athlete',
    tagline: 'Sleep is for the flight home.',
    description:
      'You see the famous sights, in order, before the crowds. Museums at opening, three neighborhoods by lunch, a show at night.',
    quadrant: 'top-left',
    examples: ['Skip-the-line museum tickets', 'Food-hall crawls', 'Rooftop bars'],
  },
  flaneur: {
    id: 'flaneur',
    name: 'The Flâneur',
    tagline: 'No plan, just a good café.',
    description:
      'You travel to live somewhere for a while. Long lunches, side streets, bookstores, and the wine bar only locals know.',
    quadrant: 'bottom-left',
    examples: ['Cooking classes', 'Neighborhood walks', 'Wine tastings'],
  },
  trailblazer: {
    id: 'trailblazer',
    name: 'The Trailblazer',
    tagline: "If there's a ridge, you're on it.",
    description:
      'You measure trips in elevation gained. Sunrise hikes, kayaks, dive boats and anything with a waiver.',
    quadrant: 'top-right',
    examples: ['Guided summit hikes', 'Sea kayaking', 'Canyoning'],
  },
  sunset_collector: {
    id: 'sunset_collector',
    name: 'The Sunset Collector',
    tagline: 'Golden hour is the itinerary.',
    description:
      'You want nature at a relaxing pace. Beaches, hot springs, scenic drives and a good view at the end of every day.',
    quadrant: 'bottom-right',
    examples: ['Sunset sails', 'Hot springs', 'Stargazing tours'],
  },
  wildcard: {
    id: 'wildcard',
    name: 'The Wildcard',
    tagline: 'A little of everything, please.',
    description:
      "You're right in the middle. A museum morning and a hike afternoon both sound great, so your trips change with the place.",
    quadrant: 'center',
    examples: ['Mixed day tours', 'Food + nature combos', 'Local favorites'],
  },
};

/** Distance from center below which someone is a Wildcard. Matches the DB. */
export const WILDCARD_RADIUS = 2.5;

export function archetypeFor(x: number, y: number): TravelArchetype {
  if (Math.hypot(x, y) < WILDCARD_RADIUS) return 'wildcard';
  if (x < 0) return y >= 0 ? 'itinerary_athlete' : 'flaneur';
  return y >= 0 ? 'trailblazer' : 'sunset_collector';
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------
export type QuizAnswers = Record<string, string>; // questionId → optionId

export type QuizResult = {
  x: number; // −10 … +10, one decimal
  y: number;
  archetype: TravelArchetype;
  /** Interest tag → how many answers pointed to it (becomes traveler_interests.weight, capped at 3) */
  interests: Record<string, number>;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export function scoreQuiz(answers: QuizAnswers): QuizResult {
  let sumX = 0, sumY = 0, maxX = 0, maxY = 0;
  const interests: Record<string, number> = {};

  for (const question of QUIZ) {
    const option = question.options.find((o) => o.id === answers[question.id]);
    if (!option) continue; // unanswered questions don't count
    sumX += option.x;
    sumY += option.y;
    maxX += Math.max(...question.options.map((o) => Math.abs(o.x)));
    maxY += Math.max(...question.options.map((o) => Math.abs(o.y)));
    for (const tag of option.tags) interests[tag] = Math.min((interests[tag] ?? 0) + 1, 3);
  }

  const x = maxX ? round1((sumX / maxX) * 10) : 0;
  const y = maxY ? round1((sumY / maxY) * 10) : 0;
  return { x, y, archetype: archetypeFor(x, y), interests };
}
