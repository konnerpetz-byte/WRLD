"use client";

import { useState } from "react";

const PRESETS = [800, 1200, 1500, 2000];

/** "What can you spend?": a slider and a few one-tap amounts, posted as `amount`. */
export function MaxPicker({ initial = 1200 }: { initial?: number }) {
  const [max, setMax] = useState(initial);
  return (
    <div className="grid gap-4 rounded-2xl border bg-background p-5 text-left">
      <label htmlFor="max" className="text-sm font-medium text-muted-foreground">
        My max, per person
      </label>
      <output htmlFor="max" className="font-display text-4xl font-bold tabular-nums tracking-[-0.03em]">
        ${max.toLocaleString("en-US")}
      </output>
      <input
        id="max"
        name="amount"
        type="range"
        min={300}
        max={5000}
        step={50}
        value={max}
        onChange={(e) => setMax(Number(e.target.value))}
        className="h-11 w-full accent-primary"
      />
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setMax(v)}
            aria-pressed={max === v}
            className={`tap min-h-11 rounded-full border px-4 text-[15px] ${max === v ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
          >
            ${v.toLocaleString("en-US")}
          </button>
        ))}
      </div>
      <p className="rounded-xl bg-muted px-3.5 py-3 text-sm">
        Private. Not even the organizer can see it. The group only sees the lowest answer, once everyone&rsquo;s in. You can change it any
        time before booking.
      </p>
    </div>
  );
}
