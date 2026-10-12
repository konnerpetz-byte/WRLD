import { useId } from "react";

/**
 * The WRLD compass: an eight-point pinwheel star in a broken ring,
 * on a diamond tile. Colors default to the brand pair.
 */
export function WrldMark({
  className = "size-8",
  tile = "var(--brand)",
  ink = "var(--brand-cream)",
  title,
}: {
  className?: string;
  tile?: string;
  ink?: string;
  title?: string;
}) {
  const id = useId();
  return (
    <svg viewBox="0 0 100 100" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <path d="M50 4 96 50 50 96 4 50Z" fill={tile} stroke={tile} strokeWidth="6" strokeLinejoin="round" />
      <g fill={ink} transform="rotate(14 50 50)">
        <g id={`${id}-arm`}>
          <path d="M46.6 48.2 51.5 27 56.2 46.4 50 50Z" />
          <path d="M54.4 46.8 64.6 35.4 57.4 51.2Z" />
        </g>
        <use href={`#${id}-arm`} transform="rotate(90 50 50)" />
        <use href={`#${id}-arm`} transform="rotate(180 50 50)" />
        <use href={`#${id}-arm`} transform="rotate(270 50 50)" />
      </g>
      <g fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" transform="rotate(-10 50 50)">
        <path id={`${id}-arc`} d="M36.4 25.6 A28 28 0 0 1 63.6 25.6" />
        <use href={`#${id}-arc`} transform="rotate(90 50 50)" />
        <use href={`#${id}-arc`} transform="rotate(180 50 50)" />
        <use href={`#${id}-arc`} transform="rotate(270 50 50)" />
      </g>
      <circle cx="50" cy="50" r="2.4" fill={tile} />
    </svg>
  );
}
