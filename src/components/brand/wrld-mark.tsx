import {
  COMPASS_FULL,
  SMALL_CARD_LIT,
  SMALL_CARD_SHADE,
  SMALL_DIAG_LIT,
  SMALL_DIAG_SHADE,
} from "./wrld-mark-paths";

/**
 * The WRLD mark: the compass rose on a diamond tile.
 *
 *  detail="full"  – the original symbol with both rings. Use at 40px and larger.
 *  detail="small" – the star alone, for 32px and below (header, favicon),
 *                   where the rings would blur.
 */

type Variant = "tile" | "dark" | "plain";

const COLORS: Record<Variant, { tile: string | null; ink: string; shade: string }> = {
  tile: { tile: "#5E7F73", ink: "#FBE8D8", shade: "#AEBBAF" },
  dark: { tile: "#253A33", ink: "#FBE8D8", shade: "#7E8F86" },
  plain: { tile: null, ink: "#5E7F73", shade: "#A9BCB4" },
};

const FULL_SIZE = 66; // symbol diameter inside the 100-unit tile
const FULL_OFFSET = (100 - FULL_SIZE) / 2;

export function WrldMark({
  className = "size-10",
  variant = "tile",
  detail = "full",
  title,
}: {
  className?: string;
  variant?: Variant;
  detail?: "full" | "small";
  title?: string;
}) {
  const c = COLORS[variant];
  const viewBox =
    variant === "plain"
      ? detail === "full"
        ? `${FULL_OFFSET} ${FULL_OFFSET} ${FULL_SIZE} ${FULL_SIZE}`
        : "15 15 70 70"
      : "0 0 100 100";

  return (
    <svg viewBox={viewBox} className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      {c.tile && <path d="M50 4 96 50 50 96 4 50Z" fill={c.tile} stroke={c.tile} strokeWidth="6" strokeLinejoin="round" />}
      {detail === "full" ? (
        <g transform={`translate(${FULL_OFFSET} ${FULL_OFFSET}) scale(${FULL_SIZE / 1024})`}>
          <path d={COMPASS_FULL} fill={c.ink} fillRule="evenodd" />
        </g>
      ) : (
        <>
          <path d={SMALL_DIAG_SHADE} fill={c.shade} />
          <path d={SMALL_DIAG_LIT} fill={c.ink} />
          <path d={SMALL_CARD_SHADE} fill={c.shade} />
          <path d={SMALL_CARD_LIT} fill={c.ink} />
        </>
      )}
    </svg>
  );
}
