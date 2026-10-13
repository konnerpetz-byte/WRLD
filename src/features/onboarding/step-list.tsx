import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export type Step = {
  key: string;
  title: string;
  /** What this step does for you, in a sentence. */
  body: string;
  done: boolean;
  /** Shown once done, e.g. "Explorer" or "3 programs added". */
  doneNote?: string;
  href: string;
  cta: string;
  secondary?: { href: string; label: string };
};

/**
 * A short numbered path: finished steps collapse to a tick, the next one is
 * open with its button, later ones wait quietly. Works for the first-run
 * guide and for each trip's plan.
 */
export function StepList({ id, title, intro, steps }: { id: string; title: string; intro?: string; steps: Step[] }) {
  const next = steps.findIndex((s) => !s.done);
  const doneCount = steps.filter((s) => s.done).length;
  return (
    <section aria-labelledby={id} className="rounded-2xl border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="text-xl font-semibold">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground tabular-nums">
          {doneCount} of {steps.length} done
        </p>
      </div>
      {intro && <p className="mt-1 max-w-prose text-sm text-muted-foreground">{intro}</p>}
      <div className="mt-3 flex gap-1" aria-hidden="true">
        {steps.map((s) => (
          <span key={s.key} className={`h-1 flex-1 rounded-full ${s.done ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>
      <ol className="mt-4 grid gap-2">
        {steps.map((s, i) => {
          const current = i === next;
          return (
            <li
              key={s.key}
              aria-current={current ? "step" : undefined}
              className={`grid grid-cols-[2rem_minmax(0,1fr)] gap-3 rounded-xl px-3 py-3 ${current ? "bg-open-soft" : ""}`}
            >
              <span
                className={`grid size-8 place-items-center rounded-full text-sm font-semibold ${
                  s.done ? "bg-primary text-primary-foreground" : current ? "bg-travel text-travel-foreground" : "border text-muted-foreground"
                }`}
              >
                {s.done ? <Check className="size-4" aria-label="Done" /> : i + 1}
              </span>
              <div className="min-w-0 self-center">
                <p className={`font-medium ${s.done ? "text-muted-foreground" : ""}`}>
                  {s.done ? (
                    <Link href={s.href} className="rounded underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">
                      {s.title}
                    </Link>
                  ) : (
                    s.title
                  )}
                  {s.done && s.doneNote ? <span className="font-normal"> · {s.doneNote}</span> : null}
                </p>
                {!s.done && <p className="text-sm text-muted-foreground">{s.body}</p>}
                {current && (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Button asChild>
                      <Link href={s.href}>
                        {s.cta} <ArrowRight aria-hidden="true" />
                      </Link>
                    </Button>
                    {s.secondary && (
                      <Link
                        href={s.secondary.href}
                        className="rounded text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        {s.secondary.label}
                      </Link>
                    )}
                  </div>
                )}
                {!current && !s.done && (
                  <Link href={s.href} className="mt-1 inline-block rounded text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">
                    {s.cta}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
