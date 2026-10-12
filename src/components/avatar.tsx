import { cn } from "@/lib/utils";

/** Profile photo, or initials on sage when there isn't one. */
export function Avatar({
  name,
  url,
  size = 32,
  className,
}: {
  name: string | null | undefined;
  url: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const initials =
    (name ?? "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?";
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.4)) };
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- user photos come from Supabase Storage at any size
      <img src={url} alt="" width={size} height={size} style={style} className={cn("shrink-0 rounded-full object-cover", className)} />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={style}
      className={cn("inline-grid shrink-0 place-items-center rounded-full bg-brand font-semibold text-brand-cream", className)}
    >
      {initials}
    </span>
  );
}
