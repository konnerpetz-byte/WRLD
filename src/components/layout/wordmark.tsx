import { WrldMark } from "@/components/brand/wrld-mark";

/** Compass mark + "WRLD" set in WRLD Sans Bold with open tracking. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <WrldMark className="size-8 shrink-0" />
      <span className="font-display text-xl font-bold tracking-[0.18em]">WRLD</span>
    </span>
  );
}
