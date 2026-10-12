import type { TravelArchetype } from "@/types/database";

/**
 * How well a trip's travelers fit together, from each person's travel type
 * (compass: culture −10 ↔ +10 nature, relaxing −10 ↔ +10 active) and their
 * interests.
 *
 *   score = 15 + 85 × (60% compass closeness + 40% shared interests)
 *
 * Plus plain-language tips for where the group pulls in different directions.
 */

export type Traveler = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  x: number | null;
  y: number | null;
  archetype: TravelArchetype | null;
  interests: Record<string, number>;
};

export type GroupFit = {
  score: number;
  label: string;
  summary: string;
  center: { x: number; y: number };
  typed: Traveler[];
  missing: Traveler[];
  shared: { tag: string; count: number; names: string[] }[];
  tips: string[];
  closest: [Traveler, Traveler] | null;
  furthest: [Traveler, Traveler] | null;
};

const DIAGONAL = Math.hypot(20, 20);

function pairs<T>(list: T[]): [T, T][] {
  const out: [T, T][] = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) out.push([list[i], list[j]]);
  return out;
}

function jaccard(a: Record<string, number>, b: Record<string, number>) {
  const ka = new Set(Object.keys(a));
  const kb = new Set(Object.keys(b));
  if (!ka.size || !kb.size) return 0;
  let both = 0;
  for (const k of ka) if (kb.has(k)) both++;
  return both / (ka.size + kb.size - both);
}

const first = (t: Traveler) => t.name.split(" ")[0];

export function groupFit(members: Traveler[], labelFor: (tag: string) => string): GroupFit | null {
  const typed = members.filter((m) => m.x !== null && m.y !== null);
  const missing = members.filter((m) => m.x === null || m.y === null);
  if (typed.length < 2) return null;

  const center = {
    x: typed.reduce((s, m) => s + m.x!, 0) / typed.length,
    y: typed.reduce((s, m) => s + m.y!, 0) / typed.length,
  };
  const ps = pairs(typed);
  const dist = (a: Traveler, b: Traveler) => Math.hypot(a.x! - b.x!, a.y! - b.y!);
  const avgDist = ps.reduce((s, [a, b]) => s + dist(a, b), 0) / ps.length;
  // Two people 14+ points apart on the compass (about a quadrant) is "far".
  const compass = Math.max(0, 1 - avgDist / (DIAGONAL / 2));
  // Interest overlap tops out naturally around 0.5; scale so that counts as full.
  const interest = Math.min(1, (ps.reduce((s, [a, b]) => s + jaccard(a.interests, b.interests), 0) / ps.length) / 0.5);
  // Any group can travel together, so the scale starts at 15.
  const score = Math.round(15 + 85 * (0.6 * compass + 0.4 * interest));

  const sortedPairs = [...ps].sort((p, q) => dist(p[0], p[1]) - dist(q[0], q[1]));

  // Interests at least half the group shares, most common first.
  const counts = new Map<string, string[]>();
  for (const m of typed) for (const tag of Object.keys(m.interests)) counts.set(tag, [...(counts.get(tag) ?? []), first(m)]);
  const shared = [...counts.entries()]
    .filter(([, names]) => names.length >= Math.max(2, Math.ceil(typed.length / 2)))
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 6)
    .map(([tag, names]) => ({ tag: labelFor(tag), count: names.length, names }));

  // Where the group pulls apart.
  const tips: string[] = [];
  const ys = typed.map((m) => m.y!);
  const xs = typed.map((m) => m.x!);
  const active = typed.reduce((a, b) => (b.y! > a.y! ? b : a));
  const relaxed = typed.reduce((a, b) => (b.y! < a.y! ? b : a));
  const nature = typed.reduce((a, b) => (b.x! > a.x! ? b : a));
  const culture = typed.reduce((a, b) => (b.x! < a.x! ? b : a));
  if (Math.max(...ys) - Math.min(...ys) >= 8) {
    tips.push(`Pace: ${first(active)} likes full days and ${first(relaxed)} likes slow ones. Alternate a packed day with an easy one, or plan a free afternoon where people split up.`);
  }
  if (Math.max(...xs) - Math.min(...xs) >= 8) {
    tips.push(`Culture vs nature: ${first(culture)} leans toward museums and cities, ${first(nature)} toward the outdoors. Pair a museum morning with a hike or beach afternoon.`);
  }
  if (shared.length) {
    tips.push(`Start with what everyone likes: ${shared.slice(0, 3).map((s) => s.tag).join(", ")}.`);
  }
  if (typed.length >= 3 && ps.some(([a, b]) => dist(a, b) >= 14)) {
    tips.push("With a bigger group, plan one split-up block a day so everyone gets their kind of time.");
  }
  if (!tips.length) tips.push("You're close on pace and interests, so most plans will suit everyone.");

  const label = score >= 80 ? "Easy match" : score >= 60 ? "Good match" : score >= 40 ? "Some trade-offs" : "Very different styles";
  const summary =
    score >= 80
      ? "You want the same kind of trip. Plan freely."
      : score >= 60
        ? "You agree on most things. A couple of compromises will keep everyone happy."
        : score >= 40
          ? "You travel differently. Build in variety and some time apart."
          : "Your styles are far apart. Mix days that suit each person, and split up for part of each day.";

  return {
    score,
    label,
    summary,
    center,
    typed,
    missing,
    shared,
    tips,
    closest: sortedPairs[0] ?? null,
    furthest: sortedPairs.length > 1 ? sortedPairs[sortedPairs.length - 1] : null,
  };
}
