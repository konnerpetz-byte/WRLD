import { ExternalLink, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { Avatar } from "@/components/avatar";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type GroupFit, groupFit, type Traveler } from "@/features/group/compatibility";
import { groupRecommendations } from "@/features/group/group-recommendations";
import { ARCHETYPES } from "@/features/traveler-profile/quiz";
import { TravelTypeIcon } from "@/features/traveler-profile/travel-type-icon";
import { getTrip } from "@/features/trips/queries";
import { requireUserId } from "@/lib/supabase/server";

export const metadata = { title: "Group fit" };

export default function FitPage(props: PageProps<"/trips/[tripId]/fit">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <FitContent {...props} />
    </Suspense>
  );
}

async function FitContent({ params }: PageProps<"/trips/[tripId]/fit">) {
  const { tripId } = await params;
  const { supabase, userId } = await requireUserId();
  const [{ trip, stops }, { data: rows }, { data: tags }] = await Promise.all([
    getTrip(tripId),
    supabase.rpc("trip_travel_types", { p_trip_id: tripId }),
    supabase.from("interest_tags").select("slug, label"),
  ]);
  const label = new Map((tags ?? []).map((t) => [t.slug, t.label]));
  const travelers: Traveler[] = (rows ?? []).map((r) => ({
    userId: r.user_id,
    name: r.user_id === userId ? `${r.display_name ?? "You"} (you)` : (r.display_name ?? "Traveler"),
    avatarUrl: r.avatar_url,
    x: r.compass_x === null ? null : Number(r.compass_x),
    y: r.compass_y === null ? null : Number(r.compass_y),
    archetype: r.archetype,
    interests: r.interests ?? {},
  }));
  const fit = groupFit(travelers, (t) => label.get(t) ?? t);
  const meTyped = travelers.find((t) => t.userId === userId)?.x != null;
  const { picks, bookingMode } = await groupRecommendations(supabase, tripId, travelers, stops, trip.currency);

  return (
    <div className="grid gap-8">
      <section aria-labelledby="fit-h" className="grid gap-6 rounded-2xl border bg-card p-5 md:grid-cols-[1fr_16rem]">
        <div className="grid content-start gap-4">
          <h2 id="fit-h" className="flex items-center gap-2 text-xl font-semibold">
            <Users className="size-5" aria-hidden="true" /> How your group travels
          </h2>

          {travelers.length < 2 ? (
            <p className="text-sm">
              Invite people from the{" "}
              <Link href={`/trips/${tripId}/group`} className="font-medium text-primary underline underline-offset-2">
                Group tab
              </Link>{" "}
              to see how your travel types fit together.
            </p>
          ) : !fit ? (
            <p className="text-sm">
              At least two people need a travel type. {meTyped ? "Ask the others" : "Take the quiz, then ask the others"} to take the 2-minute quiz on the Travel type page.
            </p>
          ) : (
            <FitSummary fit={fit} />
          )}

          <ul className="grid gap-2 sm:grid-cols-2">
            {travelers.map((t) => (
              <li key={t.userId} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                <Avatar name={t.name} url={t.avatarUrl} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{t.name}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {t.archetype ? (
                      <>
                        <TravelTypeIcon type={t.archetype} className="size-3.5" /> {ARCHETYPES[t.archetype].name}
                      </>
                    ) : (
                      "No travel type yet"
                    )}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {!meTyped && (
            <Button asChild variant="outline" className="w-fit">
              <Link href="/profile">Take the travel type quiz</Link>
            </Button>
          )}
          <p className="text-xs text-muted-foreground">Everyone on this trip can see each other&apos;s travel type here.</p>
        </div>
        {fit && <GroupCompass fit={fit} />}
      </section>

      <section aria-labelledby="picks-h" className="grid gap-4">
        <div>
          <h2 id="picks-h" className="flex items-center gap-2 text-xl font-semibold">
            <Sparkles className="size-5" aria-hidden="true" /> Recommended for your group
          </h2>
          <p className="text-sm text-muted-foreground">
            Ranked so everyone gets something they like: things one person would hate don&apos;t rise to the top.
          </p>
        </div>
        {!picks.length ? (
          <p className="rounded-xl border border-dashed bg-card p-6 text-sm text-muted-foreground">
            Recommendations appear once people on the trip have a travel type.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {picks.map((p) => (
              <li key={p.key} className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <Badge variant={p.kind === "official" ? "secondary" : "outline"}>
                    {p.kind === "official" ? "Official sight" : p.kind === "bookable" ? (bookingMode === "sample" ? "Bookable · sample" : "Bookable") : "Idea"}
                  </Badge>
                  {p.city && <span className="text-muted-foreground">{p.city}</span>}
                </div>
                <h3 className="text-lg leading-snug font-semibold">{p.title}</h3>
                {p.blurb && <p className="line-clamp-3 text-sm text-muted-foreground">{p.blurb}</p>}
                <p className="text-sm font-medium text-primary">{p.why}</p>
                {p.price && <p className="text-xs text-muted-foreground">From {p.price}</p>}
                <div className="mt-auto flex flex-wrap items-center gap-3">
                  <Button asChild size="sm">
                    <Link href={p.href}>{p.action}</Link>
                  </Button>
                  {p.externalHref && (
                    <a
                      href={p.externalHref}
                      target="_blank"
                      rel={p.kind === "bookable" ? "noopener noreferrer sponsored" : "noopener noreferrer"}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2"
                    >
                      {p.kind === "bookable" ? "Book" : "Official site"} <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {picks.some((p) => p.kind === "bookable") && (
          <p className="text-xs text-muted-foreground">WRLD may earn a commission when you book through these links.</p>
        )}
      </section>
    </div>
  );
}

function FitSummary({ fit }: { fit: GroupFit }) {
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-4">
        <div
          className="grid size-20 shrink-0 place-items-center rounded-full"
          style={{ background: `conic-gradient(var(--primary) ${fit.score * 3.6}deg, var(--muted) 0deg)` }}
          role="img"
          aria-label={`Compatibility ${fit.score} out of 100`}
        >
          <span className="grid size-16 place-items-center rounded-full bg-card font-display text-2xl font-semibold tabular-nums">{fit.score}</span>
        </div>
        <div>
          <p className="text-lg font-semibold">{fit.label}</p>
          <p className="text-sm text-muted-foreground">{fit.summary}</p>
        </div>
      </div>
      {fit.shared.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-medium">You have in common</p>
          <ul className="flex flex-wrap gap-1.5">
            {fit.shared.map((s) => (
              <li key={s.tag} className="rounded-full bg-muted px-2.5 py-1 text-xs">
                {s.tag} <span className="text-muted-foreground">· {s.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ul className="grid gap-2 text-sm">
        {fit.tips.map((t) => (
          <li key={t} className="rounded-lg bg-travel-soft px-3 py-2">
            {t}
          </li>
        ))}
      </ul>
      {fit.missing.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Not counted yet: {fit.missing.map((m) => m.name).join(", ")} (no travel type).
        </p>
      )}
    </div>
  );
}

/** Everyone's dot on the travel compass, plus the group's middle. */
function GroupCompass({ fit }: { fit: GroupFit }) {
  const pos = (v: number) => 100 + v * 8.5; // −10…10 → 15…185
  return (
    <figure className="grid content-start gap-2">
      <svg viewBox="0 0 200 200" className="w-full max-w-64 justify-self-center" role="img" aria-labelledby="gc-title">
        <title id="gc-title">Travel compass with each person&apos;s position</title>
        <rect x="1" y="1" width="198" height="198" rx="12" fill="var(--muted)" opacity="0.4" />
        <line x1="100" y1="10" x2="100" y2="190" stroke="currentColor" strokeOpacity="0.2" />
        <line x1="10" y1="100" x2="190" y2="100" stroke="currentColor" strokeOpacity="0.2" />
        <text x="100" y="9" textAnchor="middle" fontSize="8" fill="currentColor" opacity="0.6" dominantBaseline="hanging">Active</text>
        <text x="100" y="195" textAnchor="middle" fontSize="8" fill="currentColor" opacity="0.6">Relaxing</text>
        <text x="6" y="103" fontSize="8" fill="currentColor" opacity="0.6">Culture</text>
        <text x="194" y="103" textAnchor="end" fontSize="8" fill="currentColor" opacity="0.6">Nature</text>
        <circle cx={pos(fit.center.x)} cy={pos(-fit.center.y)} r="7" fill="none" stroke="var(--primary)" strokeDasharray="2 2" strokeWidth="1.5" />
        {fit.typed.map((t) => (
          <g key={t.userId}>
            <circle cx={pos(t.x!)} cy={pos(-t.y!)} r="9" fill="var(--travel)" stroke="var(--card)" strokeWidth="1.5" />
            <text x={pos(t.x!)} y={pos(-t.y!)} textAnchor="middle" dominantBaseline="central" fontSize="8" fontWeight="600" fill="var(--travel-foreground)">
              {t.name.trim().charAt(0).toUpperCase()}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="text-center text-xs text-muted-foreground">Dashed circle: the group&apos;s middle ground</figcaption>
    </figure>
  );
}
