"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { saveQuiz, type QuizState } from "./actions";
import { QUIZ } from "./quiz";

export function QuizStepper({ initial = {} }: { initial?: Record<string, string> }) {
  const [state, action, pending] = useActionState<QuizState, FormData>(saveQuiz, {});
  const [answers, setAnswers] = useState<Record<string, string>>(initial);
  const [step, setStep] = useState(0);
  const [missing, setMissing] = useState(false);
  const q = QUIZ[step];
  const last = step === QUIZ.length - 1;

  return (
    <form action={action} className="grid gap-6">
      {Object.entries(answers).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}

      <div>
        <p className="mb-2 text-sm text-muted-foreground">
          Question {step + 1} of {QUIZ.length}
        </p>
        <Progress value={((step + (answers[q.id] ? 1 : 0)) / QUIZ.length) * 100} />
      </div>

      <fieldset className="grid gap-3" aria-describedby={missing ? "quiz-missing" : undefined}>
        <legend className="mb-3 font-display text-3xl font-semibold text-balance">{q.prompt}</legend>
        {q.options.map((o) => {
          const checked = answers[q.id] === o.id;
          return (
            <label
              key={o.id}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border bg-card px-4 py-4 transition-colors hover:border-primary has-focus-visible:outline-2 has-focus-visible:outline-ring ${
                checked ? "border-primary bg-secondary" : ""
              }`}
            >
              <input
                type="radio"
                name={`choice-${q.id}`}
                value={o.id}
                checked={checked}
                onChange={() => {
                  setAnswers((a) => ({ ...a, [q.id]: o.id }));
                  setMissing(false);
                }}
                className="size-4 accent-primary"
              />
              <span>{o.label}</span>
            </label>
          );
        })}
      </fieldset>

      {missing && (
        <p id="quiz-missing" role="alert" className="text-sm text-destructive">
          Pick an answer to continue.
        </p>
      )}
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex justify-between gap-3">
        <Button type="button" variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
        {last ? (
          <Button type="submit" size="lg" disabled={pending || !answers[q.id]}>
            {pending ? "Finding your type…" : "See my travel type"}
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            onClick={() => (answers[q.id] ? setStep((s) => s + 1) : setMissing(true))}
          >
            Next
          </Button>
        )}
      </div>
    </form>
  );
}
