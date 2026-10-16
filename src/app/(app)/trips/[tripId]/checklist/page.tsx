import { Suspense } from "react";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { ChecklistCard } from "@/features/checklist/checklist";
import { tripDocContext } from "@/features/documents/context";
import { DocumentsCard } from "@/features/documents/documents-card";
import { TravelExtras } from "@/features/documents/travel-extras";
import { env } from "@/lib/env";
import { documentsFor } from "@/features/documents/rules";
import { getMembers } from "@/features/group/queries";
import { requireUserId } from "@/lib/supabase/server";
import type { ChecklistItem } from "@/types/database";

export const metadata = { title: "Checklist" };

export default function ChecklistPage(
  props: PageProps<"/trips/[tripId]/checklist">
) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ChecklistPageContent {...props} />
    </Suspense>
  );
}

async function ChecklistPageContent({
  params,
}: PageProps<"/trips/[tripId]/checklist">) {
  const { tripId } = await params;
  const { supabase, userId } = await requireUserId();
  const [{ members }, { data }, ctx] = await Promise.all([
    getMembers(tripId),
    supabase
      .from("checklist_items")
      .select("*")
      .eq("trip_id", tripId)
      .order("position"),
    tripDocContext(supabase, userId, tripId),
  ]);
  const items = (data ?? []) as ChecklistItem[];
  const people = members.map((m) => ({
    user_id: m.user_id,
    name: m.name,
    avatar_url: m.avatar_url,
  }));

  // Abroad = any stop outside the traveler's home country (or outside the U.S. when home isn't set).
  const abroad = Boolean(ctx?.countries.some((c) => c !== (ctx.home ?? "US")));
  const safe = (u: string | undefined) => (u && /^https:\/\//.test(u) ? u : null);

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      {abroad && <TravelExtras tripId={tripId} esimUrl={safe(env("AFFILIATE_ESIM_URL"))} insuranceUrl={safe(env("AFFILIATE_INSURANCE_URL"))} />}
      {ctx && (
        <DocumentsCard
          tripId={tripId}
          start={ctx.start}
          docs={documentsFor(ctx)}
          saved={items.filter((i) => i.list === "documents" && i.assigned_to === userId)}
          hasHome={Boolean(ctx.home)}
        />
      )}
      <ChecklistCard
        tripId={tripId}
        list="todo"
        title="To-do before you go"
        hint="Bookings to make, tickets to buy, who's doing what."
        items={items.filter((i) => i.list === "todo")}
        people={people}
      />
      <ChecklistCard
        tripId={tripId}
        list="packing"
        title="Packing list"
        hint="Shared with everyone on the trip. Tick things off as you pack."
        items={items.filter((i) => i.list === "packing")}
        people={people}
      />
    </div>
  );
}
