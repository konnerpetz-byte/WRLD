"use client";

import { useId, useState } from "react";

import { BANKS, bankPointsFor, ratioLabel } from "./transfers";
import { judge, VALUES_CHECKED } from "./values";

type Program = { value: string; label: string };

const VERDICT = {
  great: { title: "Use points. Great value.", tone: "bg-primary text-primary-foreground" },
  good: { title: "Use points.", tone: "bg-primary text-primary-foreground" },
  ok: { title: "Close call. Points work, but it's an average use.", tone: "bg-travel text-travel-foreground" },
  cash: { title: "Pay cash. Save your points.", tone: "bg-sidebar text-brand-cream" },
} as const;

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const num = (s: string) => Number(s.replace(/[^0-9.]/g, ""));

/**
 * The points-or-cash check: the two prices a traveler sees on the airline's
 * site go in, the answer comes out. Nothing to look up, so it's always right
 * for the flight in front of them.
 */
export function PointsOrCash({
  programs,
  held,
  initial,
}: {
  programs: Program[];
  /** Bank balances by bank key, from the traveler's wallet */
  held: Record<string, number>;
  initial: { cash?: string; points?: string; taxes?: string; program?: string };
}) {
  const id = useId();
  const [cash, setCash] = useState(initial.cash ?? "");
  const [points, setPoints] = useState(initial.points ?? "");
  const [taxes, setTaxes] = useState(initial.taxes ?? "");
  const [program, setProgram] = useState(initial.program ?? "");

  const r = judge({ cash: num(cash), points: num(points), taxes: num(taxes) || 0, program: program || null });
  const pointsAt1 = num(points) / 100 + (num(taxes) || 0);
  const max = Math.max(num(cash), pointsAt1, 1);
  const banks = program ? BANKS.filter((b) => b.partners[program]) : [];
  const programName = programs.find((p) => p.value === program)?.label;

  const field =
    "h-11 w-full rounded-lg border bg-background px-3 text-base tabular-nums focus-visible:outline-2 focus-visible:outline-ring";

  return (
    <section id="check" aria-labelledby={`${id}-h`} className="scroll-mt-6 rounded-2xl border bg-card p-5 sm:p-6">
      <h2 id={`${id}-h`} className="text-xl font-semibold">
        Points or cash? Check any flight
      </h2>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        Type the cash price and the points price you see on the airline&rsquo;s site. WRLD tells you which to use and which card points to
        move.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1.5 text-sm font-medium">
          Cash price
          <input inputMode="decimal" placeholder="$129" value={cash} onChange={(e) => setCash(e.target.value)} className={field} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Points price
          <input inputMode="numeric" placeholder="7,500" value={points} onChange={(e) => setPoints(e.target.value)} className={field} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Taxes on the award
          <input inputMode="decimal" placeholder="$6" value={taxes} onChange={(e) => setTaxes(e.target.value)} className={field} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Program
          <select value={program} onChange={(e) => setProgram(e.target.value)} className={field}>
            <option value="">Not sure</option>
            {programs.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div aria-live="polite" className="mt-5">
        {!r ? (
          <p className="rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
            Enter the cash price and the points price to see the answer.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="grid content-start gap-3">
              <p className={`rounded-xl px-4 py-3 text-lg font-semibold ${VERDICT[r.verdict].tone}`}>{VERDICT[r.verdict].title}</p>
              <p className="text-sm">
                Each point is worth <strong className="tabular-nums">{r.cents.toFixed(2)}¢</strong> here.{" "}
                {r.typical ? (
                  <>
                    {programName} points are usually worth about {r.typical}¢.
                  </>
                ) : (
                  <>Card points are worth 1¢ on any card travel site, so anything well above that is a good use.</>
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                {r.saves > 0
                  ? `Using points saves about ${money(r.saves)} compared with paying cash, counting each point at 1¢.`
                  : `Paying cash costs about ${money(-r.saves)} less than spending these points at 1¢ each.`}
              </p>
            </div>
            {/* The comparison, drawn: what each way really costs */}
            <dl className="grid content-start gap-3 text-sm" aria-label="What each way costs">
              <div className="grid gap-1">
                <dt className="flex justify-between">
                  <span>Pay cash</span>
                  <span className="font-semibold tabular-nums">{money(num(cash))}</span>
                </dt>
                <dd className="h-3 rounded-full bg-muted">
                  <span className="block h-3 rounded-full bg-sidebar" style={{ width: `${(num(cash) / max) * 100}%` }} />
                </dd>
              </div>
              <div className="grid gap-1">
                <dt className="flex justify-between gap-3">
                  <span>
                    Use points <span className="text-muted-foreground">({num(points).toLocaleString("en-US")} at 1¢ + taxes)</span>
                  </span>
                  <span className="font-semibold tabular-nums">{money(pointsAt1)}</span>
                </dt>
                <dd className="h-3 rounded-full bg-muted">
                  <span className="block h-3 rounded-full bg-primary" style={{ width: `${(pointsAt1 / max) * 100}%` }} />
                </dd>
              </div>
            </dl>
          </div>
        )}
      </div>

      {r && r.verdict !== "cash" && program && (
        <div className="mt-5 border-t pt-4">
          <h3 className="text-sm font-semibold">How to pay with card points</h3>
          {banks.length ? (
            <ul className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
              {banks.map((b) => {
                const need = bankPointsFor(num(points), b.partners[program]);
                const have = held[b.key] ?? 0;
                return (
                  <li key={b.key} className={`rounded-lg px-3 py-2 ${have >= need ? "bg-open-soft" : "bg-muted/50"}`}>
                    Move {need.toLocaleString("en-US")} {b.short} points ({ratioLabel(b.partners[program])}) at {b.site}
                    {have >= need ? <span className="font-medium text-primary"> · you have {have.toLocaleString("en-US")}</span> : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">No major bank transfers to {programName}. You&rsquo;ll need its own miles.</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Check the seat is still there before you move points. Transfers can&rsquo;t be undone.
          </p>
        </div>
      )}
      <p className="mt-4 text-xs text-muted-foreground">Typical values: The Points Guy, {VALUES_CHECKED}.</p>
    </section>
  );
}
