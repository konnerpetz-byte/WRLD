import { ARCHETYPES, WILDCARD_RADIUS } from "./quiz";
import { TYPE_PATHS } from "./travel-type-icon";
import type { TravelArchetype } from "@/types/database";

/**
 * The 4-quadrant travel-type chart.
 * x: −10 Culture … +10 Nature (left → right)
 * y: −10 Relaxing … +10 Active (bottom → top)
 */
export function TravelCompass({
  x,
  y,
  archetype,
  others = [],
}: {
  x: number | null;
  y: number | null;
  archetype: TravelArchetype | null;
  others?: { name: string; x: number; y: number }[];
}) {
  const size = 400;
  const half = size / 2;
  const toPx = (v: number) => (v / 10) * (half - 12);
  const quad = (id: TravelArchetype) => (archetype === id ? 1 : 0.55);

  return (
    <figure className="w-full max-w-[28rem]">
      <svg viewBox={`-60 -30 ${size + 120} ${size + 60}`} role="img" aria-labelledby="compass-title compass-desc" className="w-full">
        <title id="compass-title">Travel type compass</title>
        <desc id="compass-desc">
          {x === null
            ? "Take the quiz to place yourself on the compass."
            : `Your position: ${x > 0 ? "nature" : "culture"} side ${Math.abs(x)}, ${y! > 0 ? "active" : "relaxing"} side ${Math.abs(y!)}.`}
        </desc>

        <rect x={0} y={0} width={half} height={half} fill="var(--primary)" opacity={0.18 * quad("itinerary_athlete") + 0.05} />
        <rect x={half} y={0} width={half} height={half} fill="var(--open)" opacity={0.25 * quad("trailblazer") + 0.05} />
        <rect x={0} y={half} width={half} height={half} fill="var(--muted-foreground)" opacity={0.18 * quad("flaneur") + 0.04} />
        <rect x={half} y={half} width={half} height={half} fill="var(--travel)" opacity={0.35 * quad("sunset_collector") + 0.06} />
        <rect x={0} y={0} width={size} height={size} fill="none" stroke="var(--border)" />
        <line x1={0} y1={half} x2={size} y2={half} stroke="var(--border)" />
        <line x1={half} y1={0} x2={half} y2={size} stroke="var(--border)" />
        <circle
          cx={half}
          cy={half}
          r={toPx(WILDCARD_RADIUS)}
          fill="var(--card)"
          stroke="var(--border)"
          opacity={archetype === "wildcard" ? 1 : 0.85}
        />

        {(
          [
            ["itinerary_athlete", half / 2, 28],
            ["trailblazer", half + half / 2, 28],
            ["flaneur", half / 2, size - 22],
            ["sunset_collector", half + half / 2, size - 22],
          ] as const
        ).map(([id, tx, ty]) => (
          <g key={id}>
            {/* icon above (top row) or below (bottom row) the name */}
            <g
              transform={`translate(${tx - 12}, ${ty < half ? ty + 10 : ty - 46})`}
              fill="none"
              stroke="var(--foreground)"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={archetype === id ? 1 : 0.55}
              aria-hidden="true"
            >
              {TYPE_PATHS[id].map((d) => (
                <path key={d} d={d} />
              ))}
            </g>
            <text
              x={tx}
              y={ty}
              textAnchor="middle"
              className="font-display"
              fontSize={15}
              fontWeight={archetype === id ? 700 : 500}
              fill="var(--foreground)"
            >
              {ARCHETYPES[id].name}
            </text>
          </g>
        ))}
        <g
          transform={`translate(${half - 9}, ${half - 26}) scale(0.75)`}
          fill="none"
          stroke="var(--muted-foreground)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {TYPE_PATHS.wildcard.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <text x={half} y={half + 10} textAnchor="middle" fontSize={12} fill="var(--muted-foreground)">Wildcard</text>

        <text x={-8} y={half + 4} textAnchor="end" fontSize={13} fill="var(--muted-foreground)">Culture</text>
        <text x={size + 8} y={half + 4} textAnchor="start" fontSize={13} fill="var(--muted-foreground)">Nature</text>
        <text x={half} y={-12} textAnchor="middle" fontSize={13} fill="var(--muted-foreground)">Active</text>
        <text x={half} y={size + 22} textAnchor="middle" fontSize={13} fill="var(--muted-foreground)">Relaxing</text>

        {others.map((o) => (
          <g key={o.name}>
            <circle cx={half + toPx(o.x)} cy={half - toPx(o.y)} r={6} fill="var(--card)" stroke="var(--primary)" strokeWidth={2} />
            <text x={half + toPx(o.x) + 10} y={half - toPx(o.y) + 4} fontSize={12} fill="var(--foreground)">{o.name}</text>
          </g>
        ))}
        {x !== null && y !== null && (
          <g>
            <circle cx={half + toPx(x)} cy={half - toPx(y)} r={10} fill="var(--primary)" stroke="var(--card)" strokeWidth={3} />
            <text x={half + toPx(x) + 15} y={half - toPx(y) + 5} fontSize={14} fontWeight={700} fill="var(--foreground)">You</text>
          </g>
        )}
      </svg>
    </figure>
  );
}
