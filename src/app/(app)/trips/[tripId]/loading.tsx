export default function Loading() {
  return (
    <div className="grid animate-pulse gap-3" aria-busy="true" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <div key={i} className="grid gap-3 border-t pt-3 lg:grid-cols-[8rem_repeat(3,minmax(0,1fr))]">
          <div className="h-6 w-24 rounded bg-muted" />
          <div className="h-24 rounded-lg bg-muted" />
          <div className="h-24 rounded-lg bg-muted" />
          <div className="h-24 rounded-lg bg-muted" />
        </div>
      ))}
    </div>
  );
}
