import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TravelCompass } from "@/features/traveler-profile/compass";
import { ARCHETYPES } from "@/features/traveler-profile/quiz";
import { toNumber } from "@/lib/format";
import { requireUserId } from "@/lib/supabase/server";

export const metadata = { title: "Travel type" };

export default async function ProfilePage({ searchParams }: PageProps<"/profile">) {
  const { new: justFinished } = await searchParams;
  const { supabase, userId } = await requireUserId();
  const [{ data: traveler }, { data: interests }, { data: tags }] = await Promise.all([
    supabase.from("traveler_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("traveler_interests").select("tag_slug, weight").eq("user_id", userId).gt("weight", 0).order("weight", { ascending: false }),
    supabase.from("interest_tags").select("slug, label"),
  ]);
  const label = new Map((tags ?? []).map((t) => [t.slug, t.label]));
  const type = traveler?.archetype ? ARCHETYPES[traveler.archetype] : null;

  return (
    <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
      <div>
        {type ? (
          <>
            <p className="text-muted-foreground">{justFinished ? "You are" : "Your travel type"}</p>
            <h1 className="mt-1 text-5xl font-semibold">{type.name}</h1>
            <p className="mt-3 font-display text-xl">{type.tagline}</p>
            <p className="mt-4 max-w-prose text-muted-foreground">{type.description}</p>
            {!!interests?.length && (
              <div className="mt-6">
                <h2 className="mb-2 text-base font-semibold">What you&rsquo;re into</h2>
                <ul className="flex flex-wrap gap-2">
                  {interests.map((i) => (
                    <li key={i.tag_slug}>
                      <Badge variant="secondary">{label.get(i.tag_slug) ?? i.tag_slug}</Badge>
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
            <h1 className="text-5xl font-semibold">What kind of traveler are you?</h1>
            <p className="mt-4 max-w-prose text-muted-foreground">
              Take a 10-question quiz to land on the compass. We use your type and interests to suggest activities that fit how you like to travel.
            </p>
            <Button asChild size="lg" className="mt-8">
              <Link href="/profile/quiz">Take the quiz</Link>
            </Button>
          </>
        )}
      </div>
      <TravelCompass x={toNumber(traveler?.compass_x)} y={toNumber(traveler?.compass_y)} archetype={traveler?.archetype ?? null} />
    </div>
  );
}
