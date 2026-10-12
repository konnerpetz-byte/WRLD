/** Shown while a signed-in page loads its data (streams in behind <Suspense>). */
export function PageSkeleton() {
  return (
    <div className="grid animate-pulse gap-4" aria-busy="true" aria-label="Loading">
      <div className="h-9 w-56 rounded-md bg-muted" />
      <div className="h-4 w-80 max-w-full rounded bg-muted" />
      <div className="mt-2 grid gap-3 md:grid-cols-2">
        <div className="h-40 rounded-xl bg-muted" />
        <div className="h-40 rounded-xl bg-muted" />
      </div>
    </div>
  );
}
