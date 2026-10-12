export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-9 w-48 rounded-md bg-muted" />
      <div className="mt-3 h-4 w-64 rounded bg-muted" />
      <div className="mt-8 grid gap-4">
        <div className="h-9 rounded-md bg-muted" />
        <div className="h-9 rounded-md bg-muted" />
        <div className="h-10 rounded-md bg-muted" />
      </div>
    </div>
  );
}
