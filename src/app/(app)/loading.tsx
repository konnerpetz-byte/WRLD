export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-10 w-56 rounded-md bg-muted" />
      <div className="mt-3 h-4 w-80 rounded bg-muted" />
      <div className="mt-8 grid gap-3">
        <div className="h-20 rounded-xl bg-muted" />
        <div className="h-20 rounded-xl bg-muted" />
        <div className="h-20 rounded-xl bg-muted" />
      </div>
    </div>
  );
}
