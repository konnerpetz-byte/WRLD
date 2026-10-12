import { Suspense } from "react";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RecommendationCarousel } from "@/features/recommendations/carousel";
import { getRecommendations } from "@/features/recommendations/recommend";
import { TravelCompass } from "@/features/traveler-profile/compass";
import {
  TravelTypeBadge,
  TravelTypeIcon,
} from "@/features/traveler-profile/travel-type-icon";
import { ARCHETYPES } from "@/features/traveler-profile/quiz";
import { toNumber } from "@/lib/format";
import { requireUserId } from "@/lib/supabase/server";

export const metadata = { title: "Travel type" };

export default function ProfilePage(props: PageProps<"/profile">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProfilePageContent {...props} />
    </Suspense>
  );
}

async function ProfilePageContent({ searchParams }: PageProps<"/profile">) {
  const { new: justFinished } = await searchParams;
  const { supabase, userId } = await requireUserId();
  const [{ data: traveler }, { data: interests }, { data: tags }, recs] =
    await Promise.all([
      supabase
        .from("traveler_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("traveler_interests")
        .select("tag_slug, weight")
        .eq("user_id", userId)
        .gt("weight", 0)
        .order("weight", { ascending: false }),
      supabase.from("interest_tags").select("slug, label"),
      getRecommendations(),
    ]);
  const label = new Map((tags ?? []).map((t) => [t.slug, t.label]));
  const type = traveler?.archetype ? ARCHETYPES[traveler.archetype] : null;

  return (
    <div className="mx-auto grid max-w-5xl gap-12">
      <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
        <div>
          {type ? (
            <>
              <TravelTypeBadge type={type.id} size={72} />
              <p className="mt-4 text-muted-foreground">
                {justFinished ? "You are" : "Your travel type"}
              </p>
              <h1 className="mt-1 text-5xl font-semibold">{type.name}</h1>
              <p className="mt-3 font-display text-xl">{type.tagline}</p>
              <p className="mt-4 max-w-prose text-muted-foreground">
                {type.description}
              </p>
              {!!interests?.length && (
                <div className="mt-6">
                  <h2 className="mb-2 text-base font-semibold">
                    What you&rsquo;re into
                  </h2>
                  <ul className="flex flex-wrap gap-2">
                    {interests.map((i) => (
                      <li key={i.tag_slug}>
                        <Badge variant="secondary">
                          {label.get(i.tag_slug) ?? i.tag_slug}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <Button asChild variant="outline" className="mt-8">
                <Link href="/profile/quiz">Retake the quiz</Link>
              </Button>
            </>
          ) : (
            <>
              <h1 className="text-5xl font-semibold">
                What kind of traveler are you?
              </h1>
              <p className="mt-4 max-w-prose text-muted-foreground">
                Take a 10-question quiz to land on the compass. We use your type
                and interests to suggest activities that fit how you like to
                travel.
              </p>
              <Button asChild size="lg" className="mt-8">
                <Link href="/profile/quiz">Take the quiz</Link>
              </Button>
            </>
          )}
        </div>
        <TravelCompass
          x={toNumber(traveler?.compass_x)}
          y={toNumber(traveler?.compass_y)}
          archetype={traveler?.archetype ?? null}
        />
      </div>
      <section aria-labelledby="types-h">
        <h2 id="types-h" className="mb-3 text-xl font-semibold">
          The five travel types
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Object.values(ARCHETYPES).map((a) => {
            const mine = a.id === type?.id;
            return (
              <li
                key={a.id}
                aria-current={mine ? "true" : undefined}
                className={`grid content-start gap-2 rounded-xl border bg-card p-4 ${
                  mine ? "border-primary ring-1 ring-primary" : ""
                }`}
              >
                <TravelTypeIcon
                  type={a.id}
                  className={`size-7 ${
                    mine ? "text-primary" : "text-muted-foreground"
                  }`}
                />
                <span className="font-display font-semibold">
                  {a.name}
                  {mine && (
                    <span className="ml-1 text-xs font-normal text-primary">
                      (you)
                    </span>
                  )}
                </span>
                <span className="text-sm text-muted-foreground">
                  {a.tagline}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
      {recs.items.length > 0 && (
        <RecommendationCarousel
          items={recs.items}
          links={recs.bookingLinks}
          sample={recs.bookingMode === "sample"}
          subtitle={
            recs.nextTrip
              ? `Picked for ${type?.name ?? "you"}, with ideas for ${
                  recs.nextTrip.cities.join(" and ") || recs.nextTrip.title
                }.`
              : `Picked for ${
                  type?.name ?? "you"
                }. Start a trip and these turn into one-tap additions.`
          }
        />
      )}
    </div>
  );
}
