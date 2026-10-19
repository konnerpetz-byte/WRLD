/** The small "est." after an estimated total; the full word for screen readers. */
export function EstMark() {
  return (
    <span className="ml-1 align-baseline text-xs font-medium tracking-normal text-muted-foreground" title="Estimate: check live prices before booking">
      <span aria-hidden="true">est.</span>
      <span className="sr-only"> estimated</span>
    </span>
  );
}
