import { Suspense } from "react";

import { PageSkeleton } from "@/components/layout/page-skeleton";
import { SOURCE_PROGRAM } from "@/features/awards/regions";
import { ShareFromAirline } from "@/features/awards/share-from-airline";
import { requireUserId } from "@/lib/supabase/server";

export const metadata = { title: "Share seats" };

export default function SharePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ShareContent />
    </Suspense>
  );
}

async function ShareContent() {
  const { supabase, userId } = await requireUserId();
  const { data: profile } = await supabase.from("profiles").select("home_airport").eq("id", userId).maybeSingle();
  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-xl font-semibold">Share what the airline showed you</h2>
        <p className="text-sm text-muted-foreground">
          WRLD read the dates, points and taxes on the page you were looking at. Nothing else from that page is kept.
        </p>
      </div>
      <ShareFromAirline
        home={profile?.home_airport?.toUpperCase() ?? ""}
        programs={Object.entries(SOURCE_PROGRAM)
          .map(([source, p]) => ({ source, name: p.name }))
          .sort((a, b) => a.name.localeCompare(b.name))}
      />
    </div>
  );
}
