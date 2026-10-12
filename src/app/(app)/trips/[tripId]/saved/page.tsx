import { getMembers } from "@/features/group/queries";
import { SaveSpotForm, SpotItem } from "@/features/spots/spot-forms";
import { getItinerary, getTrip } from "@/features/trips/queries";
import { formatDay } from "@/lib/format";
import { requireUserId } from "@/lib/supabase/server";
import type { SavedSpot } from "@/types/database";

export const metadata = { title: "Saved spots" };

export default async function TripSavedPage({ params }: PageProps<"/trips/[tripId]/saved">) {
  const { tripId } = await params;
  const { supabase } = await requireUserId();
  const [{ canEdit }, { days }, { members }, { data }] = await Promise.all([
    getTrip(tripId),
    getItinerary(tripId),
    getMembers(tripId),
    supabase.from("saved_spots").select("*").eq("trip_id", tripId).order("created_at", { ascending: false }),
  ]);
  const spots = (data ?? []) as SavedSpot[];
  const names = new Map(members.map((m) => [m.user_id, m.name]));
  const dayOptions = days
    .filter((d) => d.blocks.some((b) => b.status !== "unavailable"))
    .map((d) => ({ id: d.id, label: `${formatDay(d.date)}${d.stop ? ` · ${d.stop.city}` : ""}` }));
  const itemDay = new Map<string, string>();
  for (const d of days) for (const b of d.blocks) for (const i of b.items) itemDay.set(i.id, formatDay(d.date));

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
      <section aria-labelledby="spots-h" className="order-2 lg:order-1">
        <h2 id="spots-h" className="mb-1 text-xl font-semibold">
          Saved for this trip
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Reels, TikToks and links the group wants to try. Pin one to a place, then add it to a day.
        </p>
        {spots.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card p-6 text-sm text-muted-foreground">
            Nothing saved yet. Paste a link here, drop one in the group chat, or share straight from TikTok or Instagram with the
            WRLD app.
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {spots.map((s) => (
              <SpotItem
                key={s.id}
                spot={s}
                tripId={tripId}
                days={dayOptions}
                canEdit={canEdit}
                savedBy={s.user_id ? names.get(s.user_id) : "Former member"}
                onItinerary={s.itinerary_item_id ? (itemDay.get(s.itinerary_item_id) ?? null) : null}
              />
            ))}
          </ul>
        )}
      </section>
      <aside className="order-1 lg:order-2" aria-label="Save a spot">
        <SaveSpotForm tripId={tripId} />
      </aside>
    </div>
  );
}
