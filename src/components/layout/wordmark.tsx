/** App name + a small boarding-pass mark. Rename "Layover" any time. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display text-xl font-semibold ${className}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6">
        <rect x="2" y="5" width="20" height="14" rx="3" fill="var(--board)" />
        <path d="M15 5v14" stroke="var(--sidebar)" strokeWidth="1.5" strokeDasharray="2 2" />
        <path d="M6 12h6m-2-3 3 3-3 3" stroke="var(--sidebar)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </svg>
      Layover
    </span>
  );
}
