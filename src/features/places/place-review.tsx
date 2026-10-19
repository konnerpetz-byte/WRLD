"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VIBES } from "@/features/planner/vibes";

import { reviewPlace } from "./review-actions";

export type Candidate = {
  qid: string;
  name: string;
  region: string;
  country: "US" | "CA";
  latitude: number;
  longitude: number;
  county: string | null;
  description: string | null;
  kind: "city" | "park" | "region";
  quality: string | null;
  population: number | null;
  wikivoyage: string;
  wikipedia: string | null;
  intro: string | null;
  suggested_vibes: string[];
  suggested_tier: 1 | 2 | 3 | null;
  suggested_gem: boolean;
  gsa_lodging: number | null;
  listedAs: string | null;
};

const TIERS = { 1: "$ hotels around $130", 2: "$$ around $165", 3: "$$$ around $225" } as const;

/** A short "why" to start from: the guide's first sentence, without the place's own name. */
function draftWhy(c: Candidate) {
  const first = (c.intro ?? c.description ?? "").split(/(?<=[.!?])\s/)[0] ?? "";
  const trimmed = first
    .replace(new RegExp(`^${c.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(is|are)\\s+(an?|the)?\\s*`, "i"), "")
    .replace(/\.$/, "");
  const out = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return out.length > 110 ? `${out.slice(0, 107).replace(/\s+\S*$/, "")}…` : out;
}

/** Wikipedia's summary photo, for the reviewer only (the public cards check the license separately). */
function usePreview(title: string | null) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!title) return;
    const ctrl = new AbortController();
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setSrc(j?.thumbnail?.source ?? null))
      .catch(() => {});
    return () => ctrl.abort();
  }, [title]);
  return src;
}

export function PlaceReview({ queue }: { queue: Candidate[] }) {
  const [i, setI] = useState(0);
  const [done, setDone] = useState({ approved: 0, rejected: 0 });
  const [failed, setFailed] = useState<string | null>(null);
  const [, start] = useTransition();
  const c = queue[i];

  const save = (payload: Parameters<typeof reviewPlace>[0], name: string) => {
    setI((n) => n + 1);
    if (payload.status !== "pending") setDone((d) => ({ ...d, [payload.status as "approved" | "rejected"]: d[payload.status as "approved" | "rejected"] + 1 }));
    start(async () => {
      const r = await reviewPlace(payload);
      if (!r.ok) setFailed(`${name} wasn't saved: ${r.error}`);
    });
  };

  if (!c) {
    return (
      <p className="rounded-lg border p-6 text-center">
        Nothing left to review here. {done.approved} approved, {done.rejected} rejected this session.
      </p>
    );
  }
  return (
    <>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {failed}
        </p>
      )}
      <ReviewCard
        key={c.qid}
        c={c}
        position={`${i + 1} of ${queue.length}`}
        tally={`${done.approved} approved, ${done.rejected} rejected`}
        onSave={save}
        onSkip={() => setI((n) => n + 1)}
        onBack={i > 0 ? () => setI((n) => n - 1) : undefined}
      />
    </>
  );
}

function ReviewCard({
  c,
  position,
  tally,
  onSave,
  onSkip,
  onBack,
}: {
  c: Candidate;
  position: string;
  tally: string;
  onSave: (payload: Parameters<typeof reviewPlace>[0], name: string) => void;
  onSkip: () => void;
  onBack?: () => void;
}) {
  const [vibes, setVibes] = useState<string[]>(c.suggested_vibes);
  const [tier, setTier] = useState<1 | 2 | 3>(c.suggested_tier ?? 1);
  const [gem, setGem] = useState(c.suggested_gem);
  const [why, setWhy] = useState(() => draftWhy(c));
  const [error, setError] = useState<string | null>(null);
  const photo = usePreview(c.wikipedia);

  const decide = useCallback(
    (status: "approved" | "rejected" | "skip") => {
      if (status === "skip") return onSkip();
      if (status === "approved" && (!why.trim() || !vibes.length)) return setError("Add a short why and at least one vibe.");
      onSave({ qid: c.qid, status, vibes, tier, gem, why: why.trim() }, c.name);
    },
    [c, vibes, tier, gem, why, onSave, onSkip],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "a") decide("approved");
      else if (k === "r") decide("rejected");
      else if (k === "s") decide("skip");
      else if (k === "t") setTier((t) => ((t % 3) + 1) as 1 | 2 | 3);
      else if (k === "g") setGem((g) => !g);
      else if (/^[0-9]$/.test(k)) {
        const v = VIBES[(Number(k) + 9) % 10]?.key;
        if (v) setVibes((list) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]));
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide]);

  const meta = useMemo(() => {
    const bits = [
      c.kind === "city" ? "Town or city" : c.kind === "park" ? "Park" : "Region",
      c.county,
      c.population ? `${c.population.toLocaleString("en-US")} people` : null,
      c.gsa_lodging ? `GSA hotel rate $${Math.round(c.gsa_lodging)}` : null,
      c.quality ? `${c.quality} guide` : null,
    ];
    return bits.filter(Boolean).join(", ");
  }, [c]);

  return (
    <section aria-label={`Review ${c.name}`} className="grid gap-4 rounded-xl border p-4">
      <div className="flex items-baseline justify-between gap-3 text-sm text-muted-foreground">
        <span>{position}</span>
        <span>{tally}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
        <div className="grid content-start gap-2">
          <h2 className="text-2xl font-semibold">
            {c.name}, {c.region}
          </h2>
          <p className="text-sm text-muted-foreground">{meta}</p>
          {c.listedAs && <p className="text-sm font-medium text-amber-700">Already listed nearby as {c.listedAs}. Reject unless it&apos;s a different trip.</p>}
          <p className="text-sm leading-relaxed">{c.intro ?? c.description ?? "No guide text."}</p>
          <p className="flex flex-wrap gap-3 text-sm">
            <a className="underline" href={`https://en.wikivoyage.org/wiki/${encodeURIComponent(c.wikivoyage.replace(/ /g, "_"))}`} target="_blank" rel="noopener noreferrer">
              Wikivoyage guide
            </a>
            {c.wikipedia && (
              <a className="underline" href={`https://en.wikipedia.org/wiki/${encodeURIComponent(c.wikipedia.replace(/ /g, "_"))}`} target="_blank" rel="noopener noreferrer">
                Wikipedia
              </a>
            )}
            <a className="underline" href={`https://www.openstreetmap.org/?mlat=${c.latitude}&mlon=${c.longitude}#map=10/${c.latitude}/${c.longitude}`} target="_blank" rel="noopener noreferrer">
              Map
            </a>
          </p>
        </div>
        <div className="aspect-[4/3] overflow-hidden rounded-lg bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- reviewer preview only */}
          {photo && <img src={photo} alt="" className="size-full object-cover" />}
        </div>
      </div>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Vibes</legend>
        <div className="flex flex-wrap gap-1.5">
          {VIBES.map((v, n) => {
            const on = vibes.includes(v.key);
            return (
              <button
                key={v.key}
                type="button"
                aria-pressed={on}
                onClick={() => setVibes((list) => (on ? list.filter((x) => x !== v.key) : [...list, v.key]))}
                className={`rounded-full border px-3 py-1 text-sm ${on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                <span className="mr-1 text-xs opacity-60">{(n + 1) % 10}</span>
                {v.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">Price tier</legend>
          <div role="radiogroup" className="flex gap-1 rounded-lg border p-1 text-sm">
            {([1, 2, 3] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={tier === t}
                onClick={() => setTier(t)}
                className={`flex-1 rounded-md px-2 py-1 ${tier === t ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                title={TIERS[t]}
              >
                {"$".repeat(t)}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{TIERS[tier]}</p>
        </fieldset>
        <label className="flex items-center gap-2 self-center text-sm">
          <input type="checkbox" checked={gem} onChange={(e) => setGem(e.target.checked)} className="size-4" />
          Hidden gem (lesser-known)
        </label>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Why go (shown on the card)</span>
        <Input value={why} maxLength={120} onChange={(e) => setWhy(e.target.value)} placeholder="Lake Michigan beaches and wineries" />
      </label>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => decide("approved")}>Approve</Button>
        <Button variant="outline" onClick={() => decide("rejected")}>
          Reject
        </Button>
        <Button variant="ghost" onClick={() => decide("skip")}>
          Skip
        </Button>
        {onBack && (
          <Button variant="ghost" className="ml-auto" onClick={onBack}>
            Back
          </Button>
        )}
      </div>
    </section>
  );
}
