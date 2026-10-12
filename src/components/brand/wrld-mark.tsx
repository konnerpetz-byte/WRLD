/**
 * The WRLD mark: an eight-point compass rose on a diamond tile.
 * North is the longest point; each cardinal point is split light/shade
 * in the classic compass-rose style. Solid shapes only, so it stays
 * crisp down to 16px.
 */

const CARD_LIT = "M50 50 L50.0 13.0 L56.72 43.28 Z M50 50 L79.0 50.0 L56.72 56.72 Z M50 50 L50.0 79.0 L43.28 56.72 Z M50 50 L21.0 50.0 L43.28 43.28 Z";
const CARD_SHADE = "M50 50 L50.0 13.0 L43.28 43.28 Z M50 50 L79.0 50.0 L56.72 43.28 Z M50 50 L50.0 79.0 L56.72 56.72 Z M50 50 L21.0 50.0 L43.28 56.72 Z";
const DIAG_LIT = "M50 50 L62.02 37.98 L56.5 50.0 Z M50 50 L62.02 62.02 L50.0 56.5 Z M50 50 L37.98 62.02 L43.5 50.0 Z M50 50 L37.98 37.98 L50.0 43.5 Z";
const DIAG_SHADE = "M50 50 L62.02 37.98 L50.0 43.5 Z M50 50 L62.02 62.02 L56.5 50.0 Z M50 50 L37.98 62.02 L50.0 56.5 Z M50 50 L37.98 37.98 L43.5 50.0 Z";

type Variant = "tile" | "dark" | "plain";

const COLORS: Record<Variant, { tile: string | null; lit: string; shade: string; diagLit: string; diagShade: string; hole: string }> = {
  tile: { tile: "#5E7F73", lit: "#FBE8D8", shade: "#C9CDBE", diagLit: "#E4DCCB", diagShade: "#B3BCAD", hole: "#5E7F73" },
  dark: { tile: "#253A33", lit: "#FBE8D8", shade: "#8E9C93", diagLit: "#C9C2B2", diagShade: "#6F8279", hole: "#253A33" },
  plain: { tile: null, lit: "#5E7F73", shade: "#9DB3AA", diagLit: "#7F978D", diagShade: "#BFCDC6", hole: "#FDF6F0" },
};

export function WrldMark({
  className = "size-8",
  variant = "tile",
  title,
}: {
  className?: string;
  variant?: Variant;
  title?: string;
}) {
  const c = COLORS[variant];
  return (
    <svg
      viewBox={variant === "plain" ? "10 10 80 80" : "0 0 100 100"}
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      {c.tile && <path d="M50 4 96 50 50 96 4 50Z" fill={c.tile} stroke={c.tile} strokeWidth="6" strokeLinejoin="round" />}
      <path d={DIAG_SHADE} fill={c.diagShade} />
      <path d={DIAG_LIT} fill={c.diagLit} />
      <path d={CARD_SHADE} fill={c.shade} />
      <path d={CARD_LIT} fill={c.lit} />
      <circle cx="50" cy="50" r="2.8" fill={c.hole} />
    </svg>
  );
}
